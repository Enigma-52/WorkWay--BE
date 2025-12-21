import express from 'express';
import { logger } from './utils/logger.js';
import { initPg } from './utils/initializers/postgres.js';
import { config } from './config.js';
import routes from './routes/index.js';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());

app.use('/api', routes);

// Health check
app.get('/health', (req, res) => {
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
const server = app.listen(PORT, async () => {
  logger.info('Initializing PostgreSQL connection...');
  await initPg();
  logger.info('PostgreSQL initialized');
  logger.info('Server started', { port: PORT });
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
