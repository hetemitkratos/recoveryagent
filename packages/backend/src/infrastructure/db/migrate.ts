import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { db } from './connection.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// In production (compiled), __dirname is packages/backend/dist/infrastructure/db/
// The drizzle folder is at packages/backend/drizzle/
const migrationsFolder = path.resolve(__dirname, '../../../drizzle');

migrate(db, { migrationsFolder });
console.log('Migrations complete.');
process.exit(0);
