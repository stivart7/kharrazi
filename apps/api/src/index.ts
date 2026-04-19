import 'express-async-errors';
// Sentry must be initialized before everything else
import { initSentry } from './config/sentry';
initSentry();

import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import path from 'path';

import { env } from './config/env';
import { logger } from './config/logger';
import { connectDatabase, disconnectDatabase, prisma } from './config/database';
import { errorHandler, notFoundHandler } from './middleware/error.middleware';

// Route modules
import authRoutes from './modules/auth/auth.routes';
import agenciesRoutes from './modules/agencies/agencies.routes';
import carsRoutes from './modules/cars/cars.routes';
import clientsRoutes from './modules/clients/clients.routes';
import reservationsRoutes from './modules/reservations/reservations.routes';
import paymentsRoutes from './modules/payments/payments.routes';
import analyticsRoutes from './modules/analytics/analytics.routes';
import usersRoutes from './modules/users/users.routes';
import notificationsRoutes from './modules/notifications/notifications.routes';
import aiRoutes from './modules/ai/ai.routes';
import planRequestsRoutes from './modules/agencies/plan-requests.routes';
import maintenanceRoutes from './modules/maintenance/maintenance.routes';
import reportsRoutes from './modules/reports/reports.routes';
import { runScheduledJobs } from './services/scheduler.service';

const app = express();

// ── Trust reverse proxy (Nginx) ───────────────
// Required so rate limiting uses real client IPs via X-Forwarded-For
// instead of the Nginx container IP (which would make ALL users share one bucket)
app.set('trust proxy', 1);

// ── Security headers (Helmet) ─────────────────
app.use(
  helmet({
    // Content Security Policy — prevent XSS
    contentSecurityPolicy: {
      directives: {
        defaultSrc:     ["'none'"],
        scriptSrc:      ["'none'"],
        styleSrc:       ["'none'"],
        imgSrc:         ["'self'", 'data:'],
        connectSrc:     ["'self'"],
        fontSrc:        ["'none'"],
        objectSrc:      ["'none'"],
        mediaSrc:       ["'none'"],
        frameSrc:       ["'none'"],
      },
    },
    // Prevent clickjacking
    frameguard: { action: 'deny' },
    // Hide X-Powered-By header
    hidePoweredBy: true,
    // Prevent MIME type sniffing
    noSniff: true,
    // XSS filter
    xssFilter: true,
    // Referrer policy
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    // DNS prefetch control
    dnsPrefetchControl: { allow: false },
  })
);

app.use(
  cors({
    origin: env.cors.origin.split(',').map((s) => s.trim()),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    maxAge: 86400, // Cache preflight for 24h
  })
);

// ── Rate limiting ─────────────────────────────
// General rate limit (all routes)
const generalLimiter = rateLimit({
  windowMs: env.rateLimit.windowMs,
  max: env.rateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Trop de requêtes, veuillez réessayer plus tard' },
  skip: (req) => req.path === '/health',
});

// Strict brute-force protection on login
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 10,                    // 10 attempts max
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Trop de tentatives de connexion, réessayez dans 15 minutes' },
  skipSuccessfulRequests: true, // Only count failed attempts
});

app.use(generalLimiter);

// ── Parsing & compression ─────────────────────
app.use(compression() as any);
app.use(express.json({ limit: '1mb' }));        // Reduced from 10mb
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(cookieParser());

// ── Logging ───────────────────────────────────
app.use(
  morgan(env.isProduction ? 'combined' : 'dev', {
    stream: { write: (msg) => logger.info(msg.trim()) },
  })
);

// ── Static files (uploaded images) ───────────
// Only serve image files from uploads dir
app.use('/uploads', (req, _res, next) => {
  // Block path traversal in upload URLs
  if (req.path.includes('..') || req.path.includes('\0')) {
    _res.status(403).json({ success: false, message: 'Accès refusé' });
    return;
  }
  next();
}, express.static(path.resolve(env.upload.dir), {
  dotfiles: 'deny',
  index: false,
}));

// ── Health check ──────────────────────────────
app.get('/health', async (_req, res) => {
  try {
    // Ping the database — fails fast if DB is down
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok', db: 'ok', uptime: Math.floor(process.uptime()) });
  } catch {
    res.status(503).json({ status: 'error', db: 'unreachable' });
  }
});

// ── API Routes ────────────────────────────────
const v1 = express.Router();

// Auth routes with brute-force protection on login
v1.use('/auth', authLimiter, authRoutes);
v1.use('/agencies', agenciesRoutes);
v1.use('/cars', carsRoutes);
v1.use('/clients', clientsRoutes);
v1.use('/reservations', reservationsRoutes);
v1.use('/payments', paymentsRoutes);
v1.use('/analytics', analyticsRoutes);
v1.use('/users', usersRoutes);
v1.use('/notifications', notificationsRoutes);
v1.use('/ai', aiRoutes);
v1.use('/plan-requests', planRequestsRoutes);
v1.use('/maintenance', maintenanceRoutes);
v1.use('/reports', reportsRoutes);

app.use('/api/v1', v1);

// Alias without version prefix for convenience
app.use('/api', v1);

// ── 404 & Error handlers ──────────────────────
app.use(notFoundHandler);
app.use(errorHandler);

// ── Bootstrap ─────────────────────────────────
async function bootstrap() {
  await connectDatabase();

  const server = app.listen(env.api.port, env.api.host, () => {
    logger.info(
      `🚗 Kharrazi API running at http://${env.api.host}:${env.api.port}`
    );
    logger.info(`📚 Environment: ${env.nodeEnv}`);
  });

  // Scheduler: run every hour
  setInterval(() => { runScheduledJobs().catch(() => {}); }, 60 * 60 * 1000);
  // Also run once at startup (after 30s)
  setTimeout(() => { runScheduledJobs().catch(() => {}); }, 30_000);

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info(`${signal} received — shutting down gracefully`);
    server.close(async () => {
      await disconnectDatabase();
      logger.info('Server closed');
      process.exit(0);
    });
    // Force close after 10s
    setTimeout(() => process.exit(1), 10_000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

bootstrap().catch((err) => {
  logger.error({ err }, 'Failed to start server');
  process.exit(1);
});

export { app };
