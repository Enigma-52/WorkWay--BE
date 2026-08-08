import './otel.js';
import dns from 'dns';
dns.setDefaultResultOrder('ipv4first');

import crypto from 'crypto';
import express from 'express';
import session from 'express-session';
import passport from 'passport';
import { logger } from './utils/logger.js';
import { initPg } from './utils/initializers/postgres.js';
import { config } from './config.js';
import routes from './routes/index.js';
import { runPgStatement } from './dao/dao.js';
import { initPassportSession } from './services/authService.js';
import { startCronScheduler } from './services/cronScheduler.js';
import dodoWebhookRoutes from './routes/dodoWebhook.js';


const app = express();
const PORT = process.env.PORT || 3000;

// Behind nginx (which itself sits behind Cloudflare and resolves the real
// client IP via CF-Connecting-IP already) — trust exactly one hop so
// req.ip / X-Forwarded-For based rate limiting sees the real client, not
// nginx's own address.
app.set('trust proxy', 1);

// Dodo's webhook signature covers the exact raw bytes of the request body,
// so this must be mounted with a raw-body parser BEFORE the global
// express.json() below, which would otherwise re-serialize the body and
// break signature verification.
app.use('/api/billing/webhook', express.raw({ type: 'application/json' }), dodoWebhookRoutes);

// Middleware
app.use(express.json());
// A hardcoded fallback here would let anyone forge a valid session cookie.
// A random per-boot secret is a safe failure mode if the env var is missing:
// existing sessions get invalidated on restart instead of being forgeable.
app.use(session({
  secret: process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex'),
  resave: false,
  saveUninitialized: false,
}));

initPassportSession();
app.use(passport.initialize());
app.use(passport.session());

// Basic CORS to allow frontend on different origin (e.g. Next.js dev server)
app.use((req, res, next) => {
  const allowedOrigin =
    process.env.FRONTEND_ORIGIN ||
    'http://localhost:3001';

  res.header('Access-Control-Allow-Origin', allowedOrigin);
  res.header('Vary', 'Origin');
  res.header(
    'Access-Control-Allow-Methods',
    'GET,POST,PUT,PATCH,DELETE,OPTIONS'
  );
  res.header(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization'
  );

  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }

  next();
});

app.use('/api', routes);

// Health check
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// Root
app.get('/', (req, res) => {
  res.send('Server is running');
});

// Start server
const server = app.listen(PORT, "0.0.0.0", async () => {
  logger.info("Initializing PostgreSQL connection...");
  await initPg().catch((err) => logger.error(err));

  logger.info("PostgreSQL initialized");

  if (config.APP_ENV === 'production') {
    startCronScheduler();
  } else {
    logger.info(`Cron scheduler skipped (APP_ENV=${config.APP_ENV})`);
  }

  logger.info("Server started", { port: PORT });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.warn('SIGTERM received. Shutting down gracefully...');
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.warn('SIGINT received. Shutting down gracefully...');
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});
