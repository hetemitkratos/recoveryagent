import type { Config } from 'drizzle-kit';
import * as dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: '../../.env' }); // try root .env

export default {
  schema: './src/infrastructure/db/schema.ts',
  out: './drizzle',
  dialect: 'sqlite',
  dbCredentials: { url: process.env.DATABASE_URL || './data/recovery.db' },
} satisfies Config;
