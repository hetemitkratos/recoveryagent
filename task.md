# AI Revenue Recovery MVP — Build Tasks

## Phase 1 — Bootstrap
- [x] Root package.json (npm workspaces)
- [x] .env.example
- [x] packages/backend/package.json
- [x] packages/backend/tsconfig.json
- [x] packages/backend/vitest.config.ts
- [x] packages/backend/drizzle.config.ts
- [x] packages/backend/src/config.ts
- [x] packages/backend/src/server.ts
- [x] packages/frontend/package.json
- [x] packages/frontend/vite.config.ts
- [x] packages/frontend/tailwind.config.ts
- [x] README.md

## Phase 2 — Domain Model + DB Schema
- [x] Domain entity types (13 entities)
- [x] Drizzle schema (schema.ts)
- [x] DB connection
- [x] Repositories (8 repos)
- [x] Initial migration

## Phase 3 — State Machine + Policy Engine
- [x] states.ts, transitions.ts, guards.ts, events.ts
- [x] state-machine.ts
- [x] policy-rules.ts, policy-engine.ts, action-matrix.ts
- [x] State machine tests
- [x] Policy engine tests

## Phase 4 — Webhook + Provider Adapters + Simulator
- [x] PaymentProvider interface
- [x] RazorpayAdapter
- [x] SimulatorAdapter (payment)
- [x] NotificationProvider interface + SimulatorAdapter
- [x] event-normalizer.ts
- [x] webhook-processor.ts
- [x] POST /webhooks/razorpay route
- [x] Webhook tests (signature, idempotency) (skipped detailed mocks for now)

## Phase 5 — Recovery Orchestration + Diagnosis + Risk
- [x] failure-codes.ts + diagnosis-engine.ts
- [x] risk-engine.ts
- [x] action-executor.ts
- [x] outcome-observer.ts
- [x] recovery-orchestrator.ts
- [x] Diagnosis + risk tests (skipped detailed mocks)

## Phase 6 — AI Adapter + PTP
- [x] ai-adapter.ts interface + schemas.ts (Zod)
- [x] Prompt templates (4 versioned)
- [x] GeminiAdapter
- [x] MockAIAdapter
- [x] ptp-extractor.ts

## Phase 7 — Attribution + Audit
- [x] attribution-engine.ts
- [x] audit-repo.ts (append-only + hash chain)

## Phase 8 — API Routes
- [x] /api/recovery/* routes
- [x] /api/dashboard/* routes
- [x] /api/demo/* routes

## Phase 9 — Frontend
- [x] React 18 + Vite setup complete
- [x] Tailwind CSS installed and configured
- [x] API client module (src/api/client.ts)
- [x] Formatting utilities (src/lib/format.ts)
- [x] Shared UI components (Card, MetricCard, Badge, Button, LoadingSpinner)
- [x] Dashboard page (headline metrics + failures-by-type + funnel + attribution + audit timeline)
- [x] Recovery Queue page (searchable/filterable session table)
- [x] Recovery Detail page (decision trace: failure -> diagnosis -> risk -> AI rec -> policy -> action -> outcome -> attribution)
- [x] Experiment page (batch experiment runner with control/treatment comparison)
- [x] Demo Control Panel (seed, reset, simulate failure/payment/PTP/opt-out, run experiment)
- [x] Hash-based routing with navigation

## Phase 10 — Batch Experiment + Seed + Tests
- [x] batch-experiment-runner.ts
- [x] demo-service.ts (seed, reset, simulate-failure, simulate-payment, simulate-ptp, simulate-optout, experiment)
- [x] Demo API routes (7 endpoints per API_CONTRACT.md)
- [x] Seeded PRNG utility for deterministic demo data
- [x] Composition root (DI wiring for all repos/engines/adapters)
- [x] npm run test passes
- [x] npm run build passes
- [x] npm run typecheck passes

## Phase 11 — Acceptance/Resilience Tests (AGENTS.md §18)
- [x] Extended fixtures (makeAction, makeOutcome, makeConfig, makeAIResponse, makePolicyContext)
- [x] State machine guards tests (13 tests: already-paid, opt-out, retry ceiling, comm limit, AI confidence, terminal state)
- [x] Diagnosis engine tests (8 tests: technical, business, auth, abandonment, subscription, unknown, missing code, case-insensitive)
- [x] Risk engine tests (6 tests: technical, business, abandonment, historical blend, expected revenue, probability clamping)
- [x] Attribution engine tests (6 tests: direct, assisted, organic, organic-failed-intervention, unknown-outside-window, concurrent)
- [x] PTP extractor tests (6 tests: valid date, ambiguous-low-confidence, ambiguous-no-date, not-ptp, AI-unavailable, promised-amount)
- [x] Policy engine extended tests (13 tests: RULE-001/005/006/COMM/KILL-SWITCH/HIGH-VALUE/004/008, version, allow-all-rules)
- [x] Webhook signature tests (9 tests: valid sig, invalid sig, wrong secret, empty sig/secret, length mismatch, idempotency, dedup, unique constraint)
- [x] In-memory test DB helper (tests/helpers/db.ts)
- [x] 9 test files, 68 tests, all passing
