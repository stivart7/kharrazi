import * as Sentry from '@sentry/node';

export function initSentry() {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) {
    // No DSN = Sentry disabled (dev or not yet configured)
    return;
  }

  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV ?? 'development',
    // Capture 100% of transactions in production — lower if traffic is high
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.2 : 1.0,
    // Don't send errors in development
    enabled: process.env.NODE_ENV === 'production',
  });
}

export { Sentry };
