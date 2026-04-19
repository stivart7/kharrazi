import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { ApiResponse } from '../../utils/ApiResponse';

// 7 days in ms — matches JWT_REFRESH_EXPIRES_IN
const REFRESH_COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

const COOKIE_OPTIONS = {
  httpOnly: true,                                   // JS cannot read this cookie
  secure: process.env.NODE_ENV === 'production',    // HTTPS only in production
  sameSite: 'lax' as const,                         // CSRF protection
  maxAge: REFRESH_COOKIE_MAX_AGE,
  path: '/',                                         // Sent to all /api routes (needed for /api alias)
};

function setRefreshCookie(res: Response, token: string) {
  res.cookie('refreshToken', token, COOKIE_OPTIONS);
}

function clearRefreshCookie(res: Response) {
  res.clearCookie('refreshToken', { ...COOKIE_OPTIONS, maxAge: 0 });
}

export const AuthController = {
  async login(req: Request, res: Response) {
    const result = await AuthService.login(req.body);

    // Set refresh token as HTTP-only cookie (not accessible by JS)
    setRefreshCookie(res, result.refreshToken);

    // Return access token in body only (refresh token omitted from response)
    const { refreshToken: _rt, ...safeResult } = result;
    ApiResponse.success(res, safeResult, 'Connexion réussie');
  },

  async register(req: Request, res: Response) {
    const user = await AuthService.register(req.body);
    ApiResponse.created(res, user, 'Compte créé avec succès');
  },

  async refresh(req: Request, res: Response) {
    // Read refresh token from HTTP-only cookie (preferred) or body (fallback)
    const tokenFromCookie = req.cookies?.refreshToken;
    const tokenFromBody   = req.body?.refreshToken;
    const refreshToken    = tokenFromCookie ?? tokenFromBody;

    if (!refreshToken) {
      res.status(401).json({ success: false, message: 'Refresh token manquant' });
      return;
    }

    const tokens = await AuthService.refreshTokens(refreshToken);

    // Rotate: set new refresh token cookie
    setRefreshCookie(res, tokens.refreshToken);

    const { refreshToken: _rt, ...safeTokens } = tokens;
    ApiResponse.success(res, safeTokens, 'Tokens rafraîchis');
  },

  async logout(req: Request, res: Response) {
    const tokenFromCookie = req.cookies?.refreshToken;
    const tokenFromBody   = req.body?.refreshToken;
    const refreshToken    = tokenFromCookie ?? tokenFromBody;

    if (refreshToken) {
      await AuthService.logout(refreshToken);
    }

    // Always clear the cookie
    clearRefreshCookie(res);
    ApiResponse.success(res, null, 'Déconnexion réussie');
  },

  async me(req: Request, res: Response) {
    const user = await AuthService.me(req.user!.sub);
    ApiResponse.success(res, user);
  },

  async updateProfile(req: Request, res: Response) {
    const user = await AuthService.updateProfile(req.user!.sub, req.body);
    ApiResponse.success(res, user, 'Profil mis à jour');
  },

  async changePassword(req: Request, res: Response) {
    await AuthService.changePassword(
      req.user!.sub,
      req.body.currentPassword,
      req.body.newPassword
    );
    ApiResponse.success(res, null, 'Mot de passe modifié avec succès');
  },
};
