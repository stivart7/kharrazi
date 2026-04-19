import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { prisma } from '../../config/database';
import { ApiError } from '../../utils/ApiError';
import { logger } from '../../config/logger';
import { sendVerificationEmail } from '../../services/email.service';
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  getRefreshTokenExpiry,
} from '../../utils/jwt';
import { LoginDto, RegisterDto, UpdateProfileDto } from './auth.schema';
import { Role } from '@prisma/client';

export const AuthService = {
  async login(dto: LoginDto) {
    const user = await prisma.user.findUnique({
      where: { email: dto.email },
      include: { agency: { select: { id: true, name: true, isActive: true, plan: true } } },
    });

    if (!user || !user.isActive) {
      logger.warn({ email: dto.email, reason: 'user_not_found_or_inactive' }, '[auth] Failed login attempt');
      throw ApiError.unauthorized('Email ou mot de passe incorrect');
    }

    const isValidPassword = await bcrypt.compare(dto.password, user.password);
    if (!isValidPassword) {
      logger.warn({ email: dto.email, userId: user.id, reason: 'wrong_password' }, '[auth] Failed login attempt');
      throw ApiError.unauthorized('Email ou mot de passe incorrect');
    }

    // Agency must be active (unless SUPER_ADMIN)
    if (user.role !== Role.SUPER_ADMIN && user.agency && !user.agency.isActive) {
      throw ApiError.forbidden('Votre agence a été désactivée');
    }

    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      agencyId: user.agencyId,
    };

    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken({ sub: user.id });

    // Store refresh token
    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt: getRefreshTokenExpiry(),
      },
    });

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const { password: _, ...userWithoutPassword } = user;

    return {
      accessToken,
      refreshToken,
      user: userWithoutPassword,
      emailVerified: !!user.emailVerifiedAt,
    };
  },

  async register(dto: RegisterDto) {
    const existing = await prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw ApiError.conflict('Un compte avec cet email existe déjà');

    const hashedPassword = await bcrypt.hash(dto.password, 12);

    const user = await prisma.user.create({
      data: {
        email: dto.email,
        password: hashedPassword,
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone,
        role: (dto.role as Role) ?? Role.EMPLOYEE,
        agencyId: dto.agencyId,
      },
    });

    // Send email verification (fire-and-forget — don't block registration)
    const rawToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h
    await prisma.emailVerificationToken.create({ data: { token: rawToken, userId: user.id, expiresAt } });

    const frontendUrl = process.env.CORS_ORIGIN?.split(',')[0]?.trim() ?? 'http://localhost:3000';
    const verifyUrl = `${frontendUrl}/verify-email?token=${rawToken}`;
    sendVerificationEmail(user.email, user.firstName, verifyUrl).catch((err) =>
      logger.warn({ err }, '[auth] Failed to send verification email'),
    );

    const { password: _, ...userWithoutPassword } = user;
    return userWithoutPassword;
  },

  async resendVerificationEmail(userId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw ApiError.notFound();
    if (user.emailVerifiedAt) throw ApiError.badRequest('Email déjà vérifié');

    // Delete old tokens
    await prisma.emailVerificationToken.deleteMany({ where: { userId } });

    const rawToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await prisma.emailVerificationToken.create({ data: { token: rawToken, userId, expiresAt } });

    const frontendUrl = process.env.CORS_ORIGIN?.split(',')[0]?.trim() ?? 'http://localhost:3000';
    const verifyUrl = `${frontendUrl}/verify-email?token=${rawToken}`;
    await sendVerificationEmail(user.email, user.firstName, verifyUrl);
  },

  async refreshTokens(refreshToken: string) {
    // Verify token signature
    let payload: { sub: string };
    try {
      payload = verifyRefreshToken(refreshToken);
    } catch {
      throw ApiError.unauthorized('Refresh token invalide');
    }

    // Check token exists and is not expired
    const storedToken = await prisma.refreshToken.findUnique({
      where: { token: refreshToken },
      include: { user: true },
    });

    if (!storedToken || storedToken.expiresAt < new Date()) {
      throw ApiError.unauthorized('Session expirée, veuillez vous reconnecter');
    }

    const user = storedToken.user;
    if (!user.isActive) throw ApiError.unauthorized('Compte désactivé');

    // Rotate refresh token
    await prisma.refreshToken.delete({ where: { id: storedToken.id } });

    const newAccessToken = generateAccessToken({
      sub: user.id,
      email: user.email,
      role: user.role,
      agencyId: user.agencyId,
    });
    const newRefreshToken = generateRefreshToken({ sub: user.id });

    await prisma.refreshToken.create({
      data: {
        token: newRefreshToken,
        userId: user.id,
        expiresAt: getRefreshTokenExpiry(),
      },
    });

    return { accessToken: newAccessToken, refreshToken: newRefreshToken };
  },

  async logout(refreshToken: string) {
    await prisma.refreshToken.deleteMany({ where: { token: refreshToken } });
  },

  async me(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { agency: { select: { id: true, name: true, city: true, logoUrl: true, plan: true } } },
    });

    if (!user) throw ApiError.notFound('Utilisateur introuvable');
    const { password: _, ...userWithoutPassword } = user;
    return userWithoutPassword;
  },

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const user = await prisma.user.update({
      where: { id: userId },
      data: dto,
      include: { agency: { select: { id: true, name: true, city: true, logoUrl: true } } },
    });
    const { password: _, ...userWithoutPassword } = user;
    return userWithoutPassword;
  },

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw ApiError.notFound();

    const isValid = await bcrypt.compare(currentPassword, user.password);
    if (!isValid) throw ApiError.badRequest('Mot de passe actuel incorrect');

    const hashed = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({ where: { id: userId }, data: { password: hashed } });

    // Invalidate all refresh tokens
    await prisma.refreshToken.deleteMany({ where: { userId } });
  },
};
