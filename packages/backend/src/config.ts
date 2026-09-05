import { z } from 'zod';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

// Load .env from the repo root (two levels up from src/config.ts)
// and fall back to process.cwd()/.env for standalone runs.
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRootEnv = path.resolve(__dirname, '../../../.env');
const cwdEnv = path.resolve(process.cwd(), '.env');
if (fs.existsSync(repoRootEnv)) {
  dotenv.config({ path: repoRootEnv });
} else if (fs.existsSync(cwdEnv)) {
  dotenv.config({ path: cwdEnv });
} else {
  dotenv.config();
}

const configSchema = z.object({
  DATABASE_URL: z.string().default('./data/recovery.db'),
  RAZORPAY_KEY_ID: z.string().optional(),
  RAZORPAY_KEY_SECRET: z.string().optional(),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().default('gemini-1.5-flash'),
  // OpenRouter (alternative to Gemini — supports many models)
  OPENROUTER_API_KEY: z.string().optional(),
  OPENROUTER_MODEL: z.string().default('google/gemini-flash-2.0'),
  OPENROUTER_BASE_URL: z.string().default('https://openrouter.ai/api/v1'),
  OPENROUTER_TIMEOUT_MS: z.coerce.number().default(15000),
  MAX_RETRIES: z.coerce.number().default(3),
  MAX_COMMUNICATIONS: z.coerce.number().default(5),
  MIN_COMMUNICATION_INTERVAL_HOURS: z.coerce.number().default(24),
  AI_CONFIDENCE_THRESHOLD: z.coerce.number().default(0.70),
  PTP_CONFIDENCE_THRESHOLD: z.coerce.number().default(0.80),
  HIGH_VALUE_THRESHOLD: z.coerce.number().default(50000), // paise = 500 INR
  ATTRIBUTION_WINDOW_HOURS: z.coerce.number().default(72),
  RECOVERY_AUTOMATION_ENABLED: z.coerce.boolean().default(true),
  DEMO_MODE: z.coerce.boolean().default(true),
  DEMO_COMPRESS_DELAYS: z.coerce.boolean().default(true),
  DEMO_SEED: z.coerce.number().default(42),
  PORT: z.coerce.number().default(3000),
  FRONTEND_PORT: z.coerce.number().default(5173),
  NODE_ENV: z.string().default('development'),
  LOG_LEVEL: z.string().default('info'),

  // --- Security ---
  // Comma-separated list of allowed CORS origins. Use '*' only in DEMO_MODE.
  CORS_ORIGINS: z.string().default('http://localhost:5173,http://localhost:3000'),
  // API key for authenticating dashboard/recovery/demo API endpoints.
  // If empty in DEMO_MODE, auth is skipped. Required in production.
  API_KEY: z.string().optional(),
  // Rate limiting
  RATE_LIMIT_MAX: z.coerce.number().default(100),    // max requests per window
  RATE_LIMIT_WINDOW: z.string().default('1 minute'), // time window
  // Max request body size in bytes (default 1MB)
  BODY_LIMIT: z.coerce.number().default(1048576),
  // Webhook event freshness tolerance in seconds (reject events older than this)
  WEBHOOK_MAX_AGE_SECONDS: z.coerce.number().default(300),
});

export type Config = z.infer<typeof configSchema>;

export function getConfig(): Config {
  const parsed = configSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error('Invalid configuration:', parsed.error.format());
    process.exit(1);
  }
  return parsed.data;
}

export const config = getConfig();
