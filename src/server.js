import dns from 'dns';
dns.setDefaultResultOrder('ipv4first');

import express from 'express';
import { logger } from './utils/logger.js';
import { initPg } from './utils/initializers/postgres.js';
import { config } from './config.js';
import routes from './routes/index.js';
import { runPgStatement } from './dao/dao.js';

export async function verifyConnection() {
  const res = await runPgStatement({
    query: `
    SELECT count(*) FROM jobs
    `,
  });

  logger.info('Postgres connection info', res[0]);
}


const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());

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
  await verifyConnection();

  logger.info("PostgreSQL initialized");
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
