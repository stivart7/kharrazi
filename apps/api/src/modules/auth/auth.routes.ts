import { Router } from 'express';
import { AuthController } from './auth.controller';
import { validate } from '../../middleware/validate.middleware';
import { authenticate } from '../../middleware/auth.middleware';
import {
  loginSchema,
  registerSchema,
  refreshSchema,
  changePasswordSchema,
  updateProfileSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from './auth.schema';
import rateLimit from 'express-rate-limit';
import crypto from 'crypto';
import { prisma } from '../../config/database';
import { ApiResponse } from '../../utils/ApiResponse';
import { ApiError } from '../../utils/ApiError';
import bcrypt from 'bcryptjs';
import { sendPasswordResetEmail } from '../../services/email.service';

const router = Router();

// Strict rate limit for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 10,
  message: { success: false, message: 'Trop de tentatives, réessayez dans 15 minutes' },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/login', authLimiter, validate(loginSchema), AuthController.login);
router.post('/register', validate(registerSchema), AuthController.register);
router.post('/refresh', validate(refreshSchema), AuthController.refresh);
router.post('/logout', validate(refreshSchema), AuthController.logout);

// Protected routes
router.get('/me', authenticate, AuthController.me);

// Lightweight plan sync — returns only the agency plan, no other user data
router.get('/plan', authenticate, async (req, res) => {
  const { ApiResponse } = await import('../../utils/ApiResponse');
  const { prisma } = await import('../../config/database');
  if (!req.user?.agencyId) {
    ApiResponse.success(res, { plan: null });
    return;
  }
  const agency = await prisma.agency.findUnique({
    where: { id: req.user.agencyId },
    select: { plan: true },
  });
  ApiResponse.success(res, { plan: agency?.plan ?? 'basic' });
});
router.patch('/profile', authenticate, validate(updateProfileSchema), AuthController.updateProfile);
router.put('/change-password', authenticate, validate(changePasswordSchema), AuthController.changePassword);

// ── Verify email ──────────────────────────────────────────────────────────────
router.get('/verify-email', async (req, res) => {
  const token = String(req.query.token ?? '');
  if (!token) throw ApiError.badRequest('Token manquant');

  const record = await prisma.emailVerificationToken.findUnique({ where: { token } });
  if (!record || record.expiresAt < new Date()) {
    throw ApiError.badRequest('Lien de vérification invalide ou expiré');
  }

  await prisma.$transaction([
    prisma.user.update({ where: { id: record.userId }, data: { emailVerifiedAt: new Date() } }),
    prisma.emailVerificationToken.deleteMany({ where: { userId: record.userId } }),
  ]);

  ApiResponse.success(res, null, 'Email vérifié avec succès. Vous pouvez maintenant vous connecter.');
});

// ── Resend verification email (protected) ─────────────────────────────────────
router.post('/resend-verification', authenticate, async (req, res) => {
  await AuthService.resendVerificationEmail(req.user!.sub);
  ApiResponse.success(res, null, 'Email de vérification envoyé.');
});

// ── Forgot password (request reset link) ──────────────────────────────────────
router.post('/forgot-password', authLimiter, validate(forgotPasswordSchema), async (req, res) => {
  const { email } = req.body as { email: string };

  const user = await prisma.user.findUnique({ where: { email } });

  // Always respond with the same message to avoid user enumeration
  const genericMsg = 'Si cet email existe, un lien de réinitialisation a été envoyé.';

  if (!user || !user.isActive) {
    ApiResponse.success(res, null, genericMsg);
    return;
  }

  // Invalidate any existing unused tokens for this user
  await prisma.passwordResetToken.updateMany({
    where: { userId: user.id, used: false },
    data: { used: true },
  });

  // Generate secure random token (hex 32 bytes = 64-char string)
  const rawToken = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  await prisma.passwordResetToken.create({
    data: { token: rawToken, userId: user.id, expiresAt },
  });

  // Build reset URL — use CORS_ORIGIN as the frontend base URL
  const frontendUrl = process.env.CORS_ORIGIN?.split(',')[0]?.trim() ?? 'http://localhost:3000';
  const resetUrl = `${frontendUrl}/reset-password?token=${rawToken}`;

  await sendPasswordResetEmail(user.email, user.firstName, rawToken, resetUrl);

  ApiResponse.success(res, null, genericMsg);
});

// ── Reset password (consume token + set new password) ─────────────────────────
router.post('/reset-password', authLimiter, validate(resetPasswordSchema), async (req, res) => {
  const { token, password } = req.body as { token: string; password: string };

  const record = await prisma.passwordResetToken.findUnique({ where: { token } });

  if (!record || record.used || record.expiresAt < new Date()) {
    throw ApiError.badRequest('Lien de réinitialisation invalide ou expiré.');
  }

  const hashed = await bcrypt.hash(password, 12);

  await prisma.$transaction([
    prisma.user.update({ where: { id: record.userId }, data: { password: hashed } }),
    prisma.passwordResetToken.update({ where: { id: record.id }, data: { used: true } }),
    // Invalidate all refresh tokens so old sessions are killed
    prisma.refreshToken.deleteMany({ where: { userId: record.userId } }),
  ]);

  ApiResponse.success(res, null, 'Mot de passe réinitialisé avec succès. Vous pouvez maintenant vous connecter.');
});

export default router;
