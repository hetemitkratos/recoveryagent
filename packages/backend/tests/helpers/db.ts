import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from '../../src/infrastructure/db/schema.js';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import path from 'path';
import fs from 'fs';

export function createTestDb() {
  const sqlite = new Database(':memory:');
  sqlite.pragma('journal_mode = WAL');
  const testDb = drizzle(sqlite, { schema });

  // Run migrations
  const migrationsFolder = path.resolve(process.cwd(), 'drizzle');
  if (fs.existsSync(migrationsFolder)) {
    try {
      migrate(testDb, { migrationsFolder });
    } catch (e) {
      // If migrations fail, create tables manually
      createTablesManually(sqlite);
    }
  } else {
    createTablesManually(sqlite);
  }

  return { db: testDb, sqlite };
}

function createTablesManually(sqlite: Database.Database) {
  // Create all tables matching schema.ts
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY,
      external_customer_id TEXT NOT NULL,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT,
      preferred_channel TEXT NOT NULL DEFAULT 'SIMULATED',
      opted_out INTEGER NOT NULL DEFAULT 0,
      lifetime_value INTEGER NOT NULL DEFAULT 0,
      is_demo INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL REFERENCES customers(id),
      provider TEXT NOT NULL,
      provider_payment_id TEXT NOT NULL,
      provider_order_id TEXT,
      amount INTEGER NOT NULL,
      currency TEXT NOT NULL DEFAULT 'INR',
      status TEXT NOT NULL,
      failure_code TEXT,
      failure_description TEXT,
      failure_class TEXT,
      attempt_number INTEGER NOT NULL DEFAULT 1,
      is_demo INTEGER NOT NULL DEFAULT 0,
      metadata TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      paid_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS recovery_sessions (
      id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL REFERENCES customers(id),
      payment_id TEXT REFERENCES payments(id),
      subscription_id TEXT,
      state TEXT NOT NULL,
      risk_score INTEGER NOT NULL DEFAULT 0,
      recovery_probability REAL NOT NULL DEFAULT 0,
      expected_recoverable_revenue INTEGER NOT NULL DEFAULT 0,
      diagnosis TEXT,
      diagnosis_confidence REAL,
      current_owner TEXT,
      attempt_count INTEGER NOT NULL DEFAULT 0,
      communication_count INTEGER NOT NULL DEFAULT 0,
      last_action_at INTEGER,
      next_action_at INTEGER,
      is_demo INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      closed_at INTEGER,
      closure_reason TEXT
    );

    CREATE TABLE IF NOT EXISTS recovery_actions (
      id TEXT PRIMARY KEY,
      recovery_session_id TEXT NOT NULL REFERENCES recovery_sessions(id),
      action_type TEXT NOT NULL,
      reason TEXT NOT NULL,
      source TEXT NOT NULL,
      ai_recommendation_id TEXT,
      policy_decision_id TEXT,
      status TEXT NOT NULL,
      provider TEXT,
      provider_reference TEXT,
      idempotency_key TEXT NOT NULL UNIQUE,
      payload TEXT,
      scheduled_at INTEGER,
      executed_at INTEGER,
      completed_at INTEGER,
      failure_reason TEXT,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS recovery_outcomes (
      id TEXT PRIMARY KEY,
      recovery_session_id TEXT NOT NULL REFERENCES recovery_sessions(id),
      action_id TEXT,
      result TEXT NOT NULL,
      payment_id TEXT,
      amount_recovered INTEGER NOT NULL DEFAULT 0,
      currency TEXT NOT NULL DEFAULT 'INR',
      payment_reference TEXT,
      attribution TEXT NOT NULL,
      attribution_evidence TEXT,
      observed_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS audit_events (
      id TEXT PRIMARY KEY,
      event_type TEXT NOT NULL,
      recovery_session_id TEXT,
      customer_id TEXT,
      payment_id TEXT,
      subscription_id TEXT,
      actor TEXT NOT NULL DEFAULT 'SYSTEM',
      payload TEXT,
      timestamp INTEGER NOT NULL,
      previous_hash TEXT NOT NULL DEFAULT '0',
      hash TEXT NOT NULL,
      is_demo INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS webhook_events (
      id TEXT PRIMARY KEY,
      source TEXT NOT NULL,
      source_event_id TEXT NOT NULL UNIQUE,
      event_type TEXT NOT NULL,
      payload TEXT,
      processed_at INTEGER,
      is_demo INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS communication_events (
      id TEXT PRIMARY KEY,
      recovery_session_id TEXT REFERENCES recovery_sessions(id),
      customer_id TEXT,
      channel TEXT NOT NULL,
      content TEXT,
      status TEXT NOT NULL,
      provider_reference TEXT,
      sent_at INTEGER,
      delivered_at INTEGER,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS promises_to_pay (
      id TEXT PRIMARY KEY,
      recovery_session_id TEXT NOT NULL REFERENCES recovery_sessions(id),
      customer_id TEXT NOT NULL,
      promised_date INTEGER NOT NULL,
      promised_amount INTEGER,
      source TEXT NOT NULL,
      source_text TEXT NOT NULL,
      confidence REAL NOT NULL,
      status TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      fulfilled_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS experiments (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL,
      seed INTEGER NOT NULL,
      control_count INTEGER NOT NULL,
      treatment_count INTEGER NOT NULL,
      started_at INTEGER NOT NULL,
      completed_at INTEGER,
      control_recovered_revenue INTEGER,
      treatment_recovered_revenue INTEGER,
      incremental_revenue INTEGER,
      control_recovery_rate REAL,
      treatment_recovery_rate REAL,
      incremental_lift_pp REAL,
      roi REAL,
      is_demo INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS experiment_assignments (
      id TEXT PRIMARY KEY,
      experiment_id TEXT NOT NULL REFERENCES experiments(id),
      customer_id TEXT NOT NULL REFERENCES customers(id),
      payment_id TEXT,
      variant TEXT NOT NULL,
      assigned_at INTEGER NOT NULL,
      is_demo INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS ai_recommendations (
      id TEXT PRIMARY KEY,
      recovery_session_id TEXT,
      diagnosis TEXT,
      confidence REAL,
      recommended_action TEXT,
      reason_codes TEXT,
      message_text TEXT,
      requires_human_review INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS policy_decisions (
      id TEXT PRIMARY KEY,
      recovery_session_id TEXT,
      action_type TEXT,
      decision TEXT NOT NULL,
      rules_evaluated TEXT,
      blocking_reasons TEXT,
      policy_version TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS subscriptions (
      id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL REFERENCES customers(id),
      provider_subscription_id TEXT,
      status TEXT NOT NULL,
      amount INTEGER NOT NULL,
      currency TEXT NOT NULL DEFAULT 'INR',
      current_period_start INTEGER,
      current_period_end INTEGER,
      is_demo INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);
}
