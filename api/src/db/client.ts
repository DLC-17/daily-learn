import { Pool } from 'pg';

const isTest = process.env.NODE_ENV === 'test';

const connectionString = isTest
  ? (process.env['TEST_DATABASE_URL'] ?? process.env['DATABASE_URL'])
  : process.env['DATABASE_URL'];

if (isTest && !connectionString) {
  throw new Error('TEST_DATABASE_URL or DATABASE_URL must be set in test mode');
}

export const pool = new Pool({
  connectionString,
  max: 5,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
  ssl: { rejectUnauthorized: false },
});
