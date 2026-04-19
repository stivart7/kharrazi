import dotenv from 'dotenv';
import path from 'path';

// Load .env from repo root when running locally
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Missing required environment variable: ${key}`);
  return value;
}

function requireSecret(key: string, minLength = 32): string {
  const value = requireEnv(key);
  if (value.length < minLength) {
    throw new Error(
      `${key} must be at least ${minLength} characters long (got ${value.length}). ` +
      `Generate one with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`,
    );
  }
  return value;
}

function optionalEnv(key: string, defaultValue: string): string {
  return process.env[key] ?? defaultValue;
}

export const env = {
  nodeEnv: optionalEnv('NODE_ENV', 'development'),
  isProduction: process.env.NODE_ENV === 'production',
  isDevelopment: process.env.NODE_ENV === 'development',

  api: {
    port: parseInt(optionalEnv('API_PORT', '4000'), 10),
    host: optionalEnv('API_HOST', '0.0.0.0'),
  },

  database: {
    url: requireEnv('DATABASE_URL'),
  },

  jwt: {
    // In production these MUST be set AND be at least 32 chars — crash fast if not
    accessSecret: process.env.NODE_ENV === 'production'
      ? requireSecret('JWT_ACCESS_SECRET', 32)
      : optionalEnv('JWT_ACCESS_SECRET', 'dev-access-secret-NOT-for-production-min-32-chars!!'),
    refreshSecret: process.env.NODE_ENV === 'production'
      ? requireSecret('JWT_REFRESH_SECRET', 32)
      : optionalEnv('JWT_REFRESH_SECRET', 'dev-refresh-secret-NOT-for-production-min-32-chars!!'),
    accessExpiresIn: optionalEnv('JWT_ACCESS_EXPIRES_IN', '15m'),
    refreshExpiresIn: optionalEnv('JWT_REFRESH_EXPIRES_IN', '7d'),
  },

  cors: {
    origin: optionalEnv('CORS_ORIGIN', 'http://localhost:3000'),
  },

  rateLimit: {
    windowMs: parseInt(optionalEnv('RATE_LIMIT_WINDOW_MS', '900000'), 10),
    max: parseInt(optionalEnv('RATE_LIMIT_MAX', '1000'), 10),
  },

  smtp: {
    host: optionalEnv('SMTP_HOST', ''),
    port: parseInt(optionalEnv('SMTP_PORT', '587'), 10),
    user: optionalEnv('SMTP_USER', ''),
    pass: optionalEnv('SMTP_PASS', ''),
    from: optionalEnv('EMAIL_FROM', 'noreply@rental.ma'),
  },

  upload: {
    dir: optionalEnv('UPLOAD_DIR', './uploads'),
  },
} as const;
