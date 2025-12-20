import 'dotenv/config';

export const config = {
  APP_ENV: process.env.APP_ENV || 'dev',
};

export const POSTGRES_DB = {
  HOST: process.env.POSTGRES_DB_HOST || 'localhost',
  PORT: parseInt(process.env.POSTGRES_DB_PORT, 10) || 5432,
  USER: process.env.POSTGRES_DB_USER || 'postgres',
  PASSWORD: process.env.POSTGRES_DB_PASSWORD || 'root',
  DATABASE: process.env.POSTGRES_DB_DATABASE || 'eqhqdb',
  POSTGRES_DB_MAX_CONNECTIONS: parseInt(process.env.POSTGRES_DB_MAX_CONNECTIONS, 10) || 20,
  APP_ENV: process.env.APP_ENV,
};


