import jwt from 'jsonwebtoken';
import { env } from '../config/env';

export interface JwtPayload {
  sub: string;    // userId
  email: string;
  role: string;
  agencyId?: string | null;
}

export function generateAccessToken(payload: JwtPayload): string {
  return jwt.sign(payload, env.jwt.accessSecret, {
    expiresIn: env.jwt.accessExpiresIn,
  } as jwt.SignOptions);
}

export function generateRefreshToken(payload: Pick<JwtPayload, 'sub'>): string {
  return jwt.sign(payload, env.jwt.refreshSecret, {
    expiresIn: env.jwt.refreshExpiresIn,
  } as jwt.SignOptions);
}

export function verifyAccessToken(token: string): JwtPayload {
  return jwt.verify(token, env.jwt.accessSecret) as JwtPayload;
}

export function verifyRefreshToken(token: string): Pick<JwtPayload, 'sub'> {
  return jwt.verify(token, env.jwt.refreshSecret) as Pick<JwtPayload, 'sub'>;
}

export function decodeToken(token: string): JwtPayload | null {
  try {
    return jwt.decode(token) as JwtPayload;
  } catch {
    return null;
  }
}

// Parse refresh token expiry to milliseconds
export function getRefreshTokenExpiry(): Date {
  const expiry = env.jwt.refreshExpiresIn; // e.g. "7d"
  const unit = expiry.slice(-1);
  const value = parseInt(expiry.slice(0, -1), 10);
  const now = new Date();

  switch (unit) {
    case 'd': now.setDate(now.getDate() + value); break;
    case 'h': now.setHours(now.getHours() + value); break;
    case 'm': now.setMinutes(now.getMinutes() + value); break;
    default: now.setDate(now.getDate() + 7);
  }
  return now;
}
