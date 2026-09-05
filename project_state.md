# AI Revenue Recovery MVP — Complete Project State

> **Track:** Razorpay Buildathon Track 03
> **Repository:** `D:\recoveryagent`
> **Last Updated:** Phase 2 complete (Security Hardening + Orchestrator Correctness)

---

## Table of Contents

1. [Mission & Canonical Flow](#1-mission--canonical-flow)
2. [Tech Stack](#2-tech-stack)
3. [How to Run](#3-how-to-run)
4. [API Endpoints (Complete Reference)](#4-api-endpoints-complete-reference)
5. [Database Schema (All 13 Tables)](#5-database-schema-all-13-tables)
6. [Domain Entities (All TypeScript Types)](#6-domain-entities-all-typescript-types)
7. [Recovery State Machine](#7-recovery-state-machine)
8. [Failure Diagnosis & Classification](#8-failure-diagnosis--classification)
9. [Risk Engine](#9-risk-engine)
10. [Policy Engine & Guardrails](#10-policy-engine--guardrails)
11. [Action Matrix](#11-action-matrix)
12. [Attribution Engine](#12-attribution-engine)
13. [AI Layer (Gemini + Mock Fallback)](#13-ai-layer-gemini--mock-fallback)
14. [PTP Extraction](#14-ptp-extraction)
15. [Orchestrator Flow (Step-by-Step)](#15-orchestrator-flow-step-by-step)
16. [Demo Simulator](#16-demo-simulator)
17. [Dashboard Metrics (Exact Shapes)](#17-dashboard-metrics-exact-shapes)
18. [Frontend Pages & Components](#18-frontend-pages--components)
19. [Frontend API Client](#19-frontend-api-client)
20. [Security Configuration](#20-security-configuration)
21. [All Config Variables](#21-all-config-variables)
22. [Test Suite](#22-test-suite)
23. [NPM Scripts](#23-npm-scripts)
24. [What Works vs What's Next](#24-what-works-vs-whats-next)

---

## 1. Mission & Canonical Flow

**Detect revenue at risk → diagnose why → choose the least-cost compliant intervention → execute → verify payment → stop/escalate → measure incremental revenue.**

```
RAZORPAY WEBHOOK
       ↓
AUTHENTICATION + IDEMPOTENCY
       ↓
NORMALIZED PAYMENT/SUBSCRIPTION STATE
       ↓
DIAGNOSIS + RISK ENGINE
       ↓
AI REASONER (Gemini or deterministic fallback)
       ↓
POLICY / GUARDRAIL ENGINE (ALLOW / BLOCK / HUMAN_REVIEW)
       ↓
PRE-ACTION PAYMENT RE-CHECK ("payment state always wins")
       ↓
ACTION EXECUTOR (payment link, SMS, retry, wait, escalate)
       ↓
OUTCOME OBSERVER
       ↓
ATTRIBUTION (DIRECT / ASSISTED / ORGANIC / UNKNOWN)
       ↓
AUDIT LEDGER (tamper-evident hash chain)
       ↓
DASHBOARD
```

**Non-negotiable principles:**
- Payment state always wins — never contact a customer who already paid
- One active recovery session per `customer_id + payment_id`
- AI recommends; deterministic policy decides; code executes
- Never allow an LLM to directly authorize money movement
- Every decision is fully auditable

---

## 2. Tech Stack

| Layer | Technology |
|---|---|
| Backend | Node.js 22, TypeScript (ESM), Fastify 4 |
| Frontend | React 18, Vite 5, Tailwind CSS 3 |
| Database | SQLite via `better-sqlite3`, Drizzle ORM |
| AI | Google Gemini (`@google/generative-ai`) with deterministic mock fallback |
| Payments | Razorpay REST API (real) + Simulator adapter (demo) |
| Notifications | Simulator adapter (console log) — real provider is Phase 4 |
| Testing | Vitest 2.1, 9 test files, 68 tests |
| Security | `@fastify/helmet`, `@fastify/rate-limit`, Zod validation, API key auth |
| Logging | Pino with PII redaction, `pino-pretty` in dev |
| Monorepo | npm workspaces (`packages/backend`, `packages/frontend`) |

---

## 3. How to Run

```bash
# Install
npm install

# Run database migrations
npm run db:migrate

# Start both backend (port 3000) and frontend (port 5173)
npm run dev

# Seed demo data
curl -X POST http://localhost:3000/api/demo/seed \
  -H "Content-Type: application/json" \
  -d '{"seed": 42, "count": 50}'

# Open dashboard
open http://localhost:5173
```

**Verification commands:**
```bash
npm run typecheck   # TypeScript check
npm run build       # Full build (backend + frontend)
npm test            # Vitest suite (68 tests)
```

---

## 4. API Endpoints (Complete Reference)

All JSON API routes return `{ data: ... }` on success and `{ data: null, error: { code, message, requestId? } }` on error.

### Health

| Method | Path | Auth | Response |
|---|---|---|---|
| `GET` | `/health` | None | `{ status: "ok", timestamp: "ISO string" }` |
| `GET` | `/ready` | None | `{ status: "ok", checks: { database: "ok" } }` |

### Webhooks

| Method | Path | Auth | Headers | Response |
|---|---|---|---|---|
| `POST` | `/webhooks/razorpay` | Signature | `x-razorpay-signature` (required), `x-razorpay-event-id` | `200 { status: "ok" }` or `401/400` |

**Webhook security:**
- HMAC-SHA256 signature verification via `crypto.timingSafeEqual`
- Event idempotency via `source_event_id` unique constraint
- Stale event rejection (events older than `WEBHOOK_MAX_AGE_SECONDS` = 300s)
- Malformed JSON rejection
- Missing signature header rejection

**Handled event types:**
- `payment.failed` → `PAYMENT_FAILED` → orchestrator.handleFailedPayment
- `payment.captured` → `PAYMENT_CAPTURED` → orchestrator.handlePaymentSuccess
- `payment_link.paid` → `PAYMENT_LINK_PAID` → orchestrator.handlePaymentSuccess
- `subscription.pending` → `SUBSCRIPTION_PENDING`
- `subscription.halted` → `SUBSCRIPTION_HALTED` → orchestrator.handleFailedPayment

### Dashboard

| Method | Path | Auth | Response Shape |
|---|---|---|---|
| `GET` | `/api/dashboard/metrics` | API key | `{ data: DashboardMetrics }` |
| `GET` | `/api/dashboard/failures-by-type` | API key | `{ data: { "TECHNICAL": N, "BUSINESS": N, ... } }` |
| `GET` | `/api/dashboard/recovery-funnel` | API key | `{ data: { "AT_RISK": N, "DIAGNOSING": N, "OUTREACH": N, ... } }` |
| `GET` | `/api/dashboard/guardrail-events` | API key | `{ data: AuditEvent[] }` |
| `GET` | `/api/dashboard/audit-timeline` | API key | `{ data: AuditEvent[] }` |
| `GET` | `/api/dashboard/best-interventions` | API key | `{ data: [{ action_type, total, succeeded, success_rate }] }` |

### Recovery

| Method | Path | Auth | Query/Body | Response Shape |
|---|---|---|---|---|
| `GET` | `/api/recovery` | API key | `?limit=50&offset=0` | `{ data: RecoverySession[], meta: { total, limit, offset } }` |
| `GET` | `/api/recovery/:id` | API key | — | `{ data: RecoverySession }` |
| `GET` | `/api/recovery/:id/trace` | API key | — | `{ data: { session, actions, outcomes, audit_events } }` |
| `POST` | `/api/recovery/:id/actions` | API key | `{ action_type: ActionType }` | `{ data: { success: boolean } }` |

**ActionType enum:** `WAIT | SAFE_RETRY | PAYMENT_LINK | MESSAGE | PTP_WAIT | ESCALATE | HUMAN_REVIEW | STOP`

### Demo

| Method | Path | Auth | Body Schema | Response Shape |
|---|---|---|---|---|
| `POST` | `/api/demo/reset` | API key | — | `{ data: { success: true, message: "Demo data cleared" } }` |
| `POST` | `/api/demo/seed` | API key | `{ seed?: number, count?: number }` | `{ data: SeedResult }` |
| `POST` | `/api/demo/simulate/failure` | API key | `{ customer_id?, amount?, failure_class?, failure_code? }` | `{ data: SimulateFailureResult }` |
| `POST` | `/api/demo/simulate/payment` | API key | `{ payment_id: string, route?: "RECOVERY_LINK"|"DIRECT"|"OTHER" }` | `{ data: SimulatePaymentResult }` |
| `POST` | `/api/demo/simulate/ptp` | API key | `{ recovery_id: string, promised_date?: ISO string, source_text?: string }` | `{ data: SimulatePTPResult }` |
| `POST` | `/api/demo/simulate/optout` | API key | `{ recovery_id: string }` | `{ data: { recovery_session_id, state } }` |
| `POST` | `/api/demo/experiment` | API key | `{ seed?, control_size?, treatment_size? }` | `{ data: ExperimentMetrics }` |

**Zod validation on all routes.** Invalid input returns `400 { data: null, error: { code: "INVALID_REQUEST", message: "..." } }`.

---

## 5. Database Schema (All 13 Tables)

All tables use SQLite via Drizzle ORM. Amounts are in **paise** (1 INR = 100 paise). Timestamps are Unix epochs.

### `customers`
| Column | Type | Notes |
|---|---|---|
| `id` | text PK | Internal ID (e.g. `cus_xxx`) |
| `external_customer_id` | text | Razorpay customer ID |
| `name` | text | Customer name |
| `email` | text | Email address |
| `phone` | text | Phone number |
| `preferred_channel` | text | `EMAIL`, `SMS`, or `SIMULATED` |
| `opted_out` | boolean | If true, all communication suppressed |
| `lifetime_value` | integer | Total value in paise |
| `is_demo` | boolean | Demo flag for reset |
| `created_at` | timestamp | |
| `updated_at` | timestamp | |

### `payments`
| Column | Type | Notes |
|---|---|---|
| `id` | text PK | Internal ID (e.g. `pay_xxx`) |
| `customer_id` | text FK → customers | |
| `provider` | text | `razorpay` or `simulator` |
| `provider_payment_id` | text | Razorpay payment ID |
| `provider_order_id` | text | |
| `amount` | integer | Paise |
| `currency` | text | `INR` |
| `status` | text | `CREATED`, `AUTHORIZED`, `CAPTURED`, `FAILED`, `REFUNDED`, `CANCELLED`, `UNKNOWN` |
| `failure_code` | text | e.g. `insufficient_funds`, `gateway_timeout` |
| `failure_description` | text | |
| `failure_class` | text | `TECHNICAL`, `BUSINESS`, `AUTHENTICATION`, `ABANDONMENT`, `RECURRING_PAYMENT_FAILURE`, `UNKNOWN` |
| `attempt_number` | integer | |
| `is_demo` | boolean | |
| `metadata` | json | |
| `created_at` | timestamp | |
| `updated_at` | timestamp | |
| `paid_at` | timestamp | |

### `subscriptions`
| Column | Type | Notes |
|---|---|---|
| `id` | text PK | |
| `customer_id` | text FK → customers | |
| `provider` | text | |
| `provider_subscription_id` | text | |
| `plan_id` | text | |
| `amount` | integer | Paise per cycle |
| `currency` | text | |
| `status` | text | `ACTIVE`, `PENDING`, `PAST_DUE`, `HALTED`, `CANCELLED`, `COMPLETED`, `UNKNOWN` |
| `next_charge_at` | timestamp | |
| `failed_attempts` | integer | |
| `max_attempts` | integer | Default 3 |
| `retry_ceiling` | integer | Default 3 |
| `is_demo` | boolean | |
| `created_at` | timestamp | |
| `updated_at` | timestamp | |

### `recovery_sessions`
| Column | Type | Notes |
|---|---|---|
| `id` | text PK | e.g. `ses_xxx` |
| `customer_id` | text FK → customers | |
| `payment_id` | text FK → payments | |
| `subscription_id` | text FK → subscriptions | |
| `state` | text | Recovery state (see state machine) |
| `risk_score` | integer | 0-100 |
| `recovery_probability` | real | 0.0-1.0 |
| `expected_recoverable_revenue` | integer | Paise |
| `diagnosis` | text | Failure class |
| `diagnosis_confidence` | real | 0.0-1.0 |
| `current_owner` | text | |
| `attempt_count` | integer | Incremented on SAFE_RETRY |
| `communication_count` | integer | Incremented on MESSAGE/PAYMENT_LINK |
| `last_action_at` | timestamp | |
| `next_action_at` | timestamp | |
| `is_demo` | boolean | |
| `created_at` | timestamp | |
| `updated_at` | timestamp | |
| `closed_at` | timestamp | Null = active session |
| `closure_reason` | text | e.g. `PAYMENT_SUCCESS`, `POLICY_BLOCK` |

**Unique index:** `(customer_id, payment_id) WHERE closed_at IS NULL` — enforces one active session per pair.

### `recovery_actions`
| Column | Type | Notes |
|---|---|---|
| `id` | text PK | e.g. `act_xxx` |
| `recovery_session_id` | text FK → recovery_sessions | |
| `action_type` | text | `WAIT`, `SAFE_RETRY`, `PAYMENT_LINK`, `MESSAGE`, `PTP_WAIT`, `ESCALATE`, `HUMAN_REVIEW`, `STOP` |
| `reason` | text | e.g. `AI_POLICY_ALLOW`, `MANUAL_OVERRIDE` |
| `source` | text | `AI`, `MANUAL`, `SYSTEM` |
| `ai_recommendation_id` | text | Links to `ai_recommendations.id` |
| `policy_decision_id` | text | Links to `policy_decisions.id` |
| `status` | text | `PROPOSED`, `PENDING_POLICY`, `BLOCKED`, `SCHEDULED`, `EXECUTING`, `EXECUTED`, `SUCCEEDED`, `FAILED`, `CANCELLED` |
| `provider` | text | |
| `provider_reference` | text | e.g. payment link ID |
| `idempotency_key` | text unique | Prevents duplicate execution |
| `payload` | json | e.g. `{ message: "..." }` |
| `scheduled_at` | timestamp | |
| `executed_at` | timestamp | |
| `completed_at` | timestamp | |
| `failure_reason` | text | |
| `created_at` | timestamp | |

### `recovery_outcomes`
| Column | Type | Notes |
|---|---|---|
| `id` | text PK | |
| `recovery_session_id` | text FK | |
| `action_id` | text | |
| `result` | text | `PAYMENT_RECOVERED`, `NO_RECOVERY`, `CUSTOMER_DECLINED`, `CUSTOMER_OPTED_OUT`, `PROMISE_TO_PAY`, `ACTION_FAILED`, `UNKNOWN` |
| `payment_id` | text unique | |
| `amount_recovered` | integer | Paise |
| `currency` | text | |
| `payment_reference` | text | |
| `attribution` | text | `DIRECT`, `ASSISTED`, `ORGANIC`, `UNKNOWN` |
| `attribution_evidence` | text | e.g. `PAYMENT_LINK_CLICKED`, `INTERVENTION_WITHIN_WINDOW` |
| `observed_at` | timestamp | |

### `ai_recommendations`
| Column | Type | Notes |
|---|---|---|
| `id` | text PK | e.g. `airec_xxx` |
| `recovery_session_id` | text FK | |
| `diagnosis` | text | Failure class |
| `diagnosis_confidence` | real | |
| `recovery_probability` | real | |
| `recovery_confidence` | real | |
| `recommended_action` | text | |
| `action_confidence` | real | |
| `reason_codes` | json | Array of strings |
| `message_text` | text | AI-generated customer message |
| `message_tone` | text | `HELPFUL`, `URGENT`, `NEUTRAL` |
| `requires_human_review` | boolean | |
| `model_name` | text | e.g. `gemini-1.5-flash` |
| `model_version` | text | |
| `prompt_version` | text | e.g. `recommendation-v1` |
| `is_fallback` | boolean | True if deterministic fallback was used |
| `created_at` | timestamp | |

### `policy_decisions`
| Column | Type | Notes |
|---|---|---|
| `id` | text PK | e.g. `poldec_xxx` |
| `recovery_session_id` | text FK | |
| `action_id` | text | |
| `decision` | text | `ALLOW`, `BLOCK`, `HUMAN_REVIEW` |
| `rules_evaluated` | json | Array of rule results |
| `blocking_reasons` | json | Array of reason strings |
| `policy_version` | text | `1.0.0` |
| `created_at` | timestamp | |

### `audit_events`
| Column | Type | Notes |
|---|---|---|
| `id` | text PK | |
| `event_type` | text | e.g. `ACTION_EXECUTED`, `PAYMENT_RECOVERED`, `POLICY_BLOCK`, `POLICY_HUMAN_REVIEW` |
| `recovery_session_id` | text | |
| `customer_id` | text | |
| `payment_id` | text | |
| `subscription_id` | text | |
| `source_event_id` | text | |
| `actor` | text | `SYSTEM`, `MANUAL`, `AI` |
| `payload` | json | Event-specific data |
| `timestamp` | timestamp | |
| `previous_hash` | text | Hash chain (tamper-evident) |
| `hash` | text | SHA-256 of payload + previous_hash |
| `is_demo` | boolean | |

### `webhook_events`
| Column | Type | Notes |
|---|---|---|
| `id` | text PK | |
| `source` | text | `razorpay` |
| `source_event_id` | text unique | Razorpay event ID (idempotency key) |
| `event_type` | text | Normalized type |
| `payload` | json | Raw webhook payload |
| `is_demo` | boolean | |
| `created_at` | timestamp | |

### `promises_to_pay`
| Column | Type | Notes |
|---|---|---|
| `id` | text PK | |
| `recovery_session_id` | text FK | |
| `customer_id` | text FK | |
| `promised_date` | timestamp | When customer promised to pay |
| `promised_amount` | integer | Paise (optional) |
| `source` | text | `TEXT`, `VOICE`, `MANUAL` |
| `source_text` | text | Original customer message |
| `confidence` | real | 0.0-1.0 |
| `status` | text | `ACTIVE`, `FULFILLED`, `MISSED`, `CANCELLED`, `AMBIGUOUS` |
| `created_at` | timestamp | |
| `updated_at` | timestamp | |
| `fulfilled_at` | timestamp | |

### `communication_events`
| Column | Type | Notes |
|---|---|---|
| `id` | text PK | |
| `recovery_session_id` | text FK | |
| `customer_id` | text FK | |
| `channel` | text | `SIMULATED`, `EMAIL`, `SMS` |
| `template_id` | text | |
| `message` | text | |
| `provider` | text | |
| `provider_reference` | text | |
| `status` | text | `PENDING`, `SENT`, `DELIVERED`, `OPENED`, `FAILED` |
| `sent_at` | timestamp | |
| `delivered_at` | timestamp | |
| `opened_at` | timestamp | |
| `responded_at` | timestamp | |
| `created_at` | timestamp | |

### `experiments`
| Column | Type | Notes |
|---|---|---|
| `id` | text PK | |
| `name` | text | |
| `description` | text | |
| `status` | text | `PENDING`, `RUNNING`, `COMPLETED` |
| `seed` | integer | Deterministic seed |
| `control_count` | integer | |
| `treatment_count` | integer | |
| `started_at` | timestamp | |
| `completed_at` | timestamp | |
| `control_recovered_revenue` | integer | Paise |
| `treatment_recovered_revenue` | integer | Paise |
| `incremental_revenue` | integer | Paise |
| `control_recovery_rate` | real | |
| `treatment_recovery_rate` | real | |
| `incremental_lift_pp` | real | Percentage points |
| `roi` | real | |
| `is_demo` | boolean | |

### `experiment_assignments`
| Column | Type | Notes |
|---|---|---|
| `id` | text PK | |
| `experiment_id` | text FK | |
| `customer_id` | text FK | |
| `payment_id` | text | |
| `variant` | text | `CONTROL` or `TREATMENT` |
| `assigned_at` | timestamp | |
| `is_demo` | boolean | |

---

## 6. Domain Entities (All TypeScript Types)

### Payment
```typescript
type PaymentStatus = 'CREATED' | 'AUTHORIZED' | 'CAPTURED' | 'FAILED' | 'REFUNDED' | 'CANCELLED' | 'UNKNOWN';
type FailureClass = 'TECHNICAL' | 'BUSINESS' | 'AUTHENTICATION' | 'ABANDONMENT' | 'RECURRING_PAYMENT_FAILURE' | 'UNKNOWN';

interface Payment {
  id: string;
  customer_id: string;
  provider: 'razorpay' | 'simulator';
  provider_payment_id: string;
  provider_order_id?: string;
  amount: number;          // paise
  currency: string;        // 'INR'
  status: PaymentStatus;
  failure_code?: string;
  failure_description?: string;
  failure_class?: FailureClass;
  attempt_number: number;
  is_demo: boolean;
  metadata: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
  paid_at?: Date;
}
```

### Customer
```typescript
interface Customer {
  id: string;
  external_customer_id: string;
  name: string;
  email: string;
  phone: string;
  preferred_channel: 'EMAIL' | 'SMS' | 'SIMULATED';
  opted_out: boolean;
  lifetime_value: number;  // paise
  is_demo: boolean;
  created_at: Date;
  updated_at: Date;
}
```

### RecoverySession
```typescript
type RecoveryState =
  | 'AT_RISK' | 'DIAGNOSING' | 'SAFE_RETRY' | 'OUTREACH'
  | 'PAYMENT_PENDING' | 'PTP_WAIT' | 'RECOVERED'
  | 'ESCALATED' | 'STOPPED' | 'HUMAN_REVIEW';

interface RecoverySession {
  id: string;
  customer_id: string;
  payment_id?: string;
  subscription_id?: string;
  state: RecoveryState;
  risk_score: number;                    // 0-100
  recovery_probability: number;          // 0.0-1.0
  expected_recoverable_revenue: number;  // paise
  diagnosis?: FailureClass;
  diagnosis_confidence?: number;         // 0.0-1.0
  current_owner?: string;
  attempt_count: number;
  communication_count: number;
  last_action_at?: Date;
  next_action_at?: Date;
  is_demo: boolean;
  created_at: Date;
  updated_at: Date;
  closed_at?: Date;                      // null = active
  closure_reason?: string;
}
```

### RecoveryAction
```typescript
type ActionType = 'WAIT' | 'SAFE_RETRY' | 'PAYMENT_LINK' | 'MESSAGE' | 'PTP_WAIT' | 'ESCALATE' | 'HUMAN_REVIEW' | 'STOP';
type ActionStatus = 'PROPOSED' | 'PENDING_POLICY' | 'BLOCKED' | 'SCHEDULED' | 'EXECUTING' | 'EXECUTED' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED';
type ActionSource = 'AI' | 'MANUAL' | 'SYSTEM';

interface RecoveryAction {
  id: string;
  recovery_session_id: string;
  action_type: ActionType;
  reason: string;
  source: ActionSource;
  ai_recommendation_id?: string;
  policy_decision_id?: string;
  status: ActionStatus;
  provider?: string;
  provider_reference?: string;
  idempotency_key: string;
  payload?: Record<string, unknown>;
  scheduled_at?: Date;
  executed_at?: Date;
  completed_at?: Date;
  failure_reason?: string;
  created_at: Date;
}
```

### RecoveryOutcome
```typescript
type OutcomeResult = 'PAYMENT_RECOVERED' | 'NO_RECOVERY' | 'CUSTOMER_DECLINED' | 'CUSTOMER_OPTED_OUT' | 'PROMISE_TO_PAY' | 'ACTION_FAILED' | 'UNKNOWN';
type AttributionClass = 'DIRECT' | 'ASSISTED' | 'ORGANIC' | 'UNKNOWN';

interface RecoveryOutcome {
  id: string;
  recovery_session_id: string;
  action_id?: string;
  result: OutcomeResult;
  payment_id?: string;
  amount_recovered: number;    // paise
  currency: string;
  payment_reference?: string;
  attribution: AttributionClass;
  attribution_evidence?: string;
  observed_at: Date;
}
```

### AuditEvent
```typescript
interface AuditEvent {
  id: string;
  event_type: string;
  recovery_session_id?: string;
  customer_id?: string;
  payment_id?: string;
  subscription_id?: string;
  source_event_id?: string;
  actor: string;
  payload: Record<string, unknown>;
  timestamp: Date;
  previous_hash: string;
  hash: string;
  is_demo: boolean;
}
```

### PromiseToPay
```typescript
type PTPStatus = 'ACTIVE' | 'FULFILLED' | 'MISSED' | 'CANCELLED' | 'AMBIGUOUS';

interface PromiseToPay {
  id: string;
  recovery_session_id: string;
  customer_id: string;
  promised_date: Date;
  promised_amount?: number | null;
  source: 'TEXT' | 'VOICE' | 'MANUAL';
  source_text: string;
  confidence: number;
  status: PTPStatus;
  created_at: Date;
  updated_at: Date;
  fulfilled_at?: Date;
}
```

### Experiment
```typescript
interface Experiment {
  id: string;
  name: string;
  description?: string;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED';
  seed: number;
  control_count: number;
  treatment_count: number;
  started_at: Date;
  completed_at?: Date;
  control_recovered_revenue?: number;
  treatment_recovered_revenue?: number;
  incremental_revenue?: number;
  control_recovery_rate?: number;
  treatment_recovery_rate?: number;
  incremental_lift_pp?: number;
  roi?: number;
  is_demo: boolean;
}
```

---

## 7. Recovery State Machine

### States
```
AT_RISK         — Payment failed, session created
DIAGNOSING      — Running diagnosis + risk assessment
SAFE_RETRY      — Attempting automatic retry
OUTREACH        — Customer-facing communication sent
PAYMENT_PENDING — Waiting for payment after link/message
PTP_WAIT        — Customer promised to pay, waiting
RECOVERED       — Payment succeeded (terminal)
ESCALATED       — Escalated to human (non-terminal)
STOPPED         — Session closed without recovery (terminal)
HUMAN_REVIEW    — Awaiting human decision (non-terminal)
```

### Allowed Transitions
| From | To |
|---|---|
| `AT_RISK` | `DIAGNOSING`, `STOPPED`, `RECOVERED` |
| `DIAGNOSING` | `SAFE_RETRY`, `OUTREACH`, `PTP_WAIT`, `HUMAN_REVIEW`, `STOPPED`, `RECOVERED` |
| `SAFE_RETRY` | `PAYMENT_PENDING`, `OUTREACH`, `ESCALATED`, `STOPPED` |
| `OUTREACH` | `PAYMENT_PENDING`, `PTP_WAIT`, `ESCALATED`, `STOPPED` |
| `PAYMENT_PENDING` | `RECOVERED`, `OUTREACH`, `ESCALATED`, `STOPPED` |
| `PTP_WAIT` | `RECOVERED`, `OUTREACH`, `ESCALATED`, `STOPPED` |
| `HUMAN_REVIEW` | `OUTREACH`, `SAFE_RETRY`, `ESCALATED`, `STOPPED` |
| `ESCALATED` | `HUMAN_REVIEW`, `RECOVERED`, `STOPPED` |
| `RECOVERED` | (terminal — no transitions) |
| `STOPPED` | (terminal — no transitions) |

### State Machine Guards
The `StateMachine.evaluateAction()` runs these guards in order:

1. **Terminal state guard** — blocks transitions from `RECOVERED` or `STOPPED`
2. **Payment state guard** — blocks if payment is `CAPTURED` or `AUTHORIZED` → `PAYMENT_ALREADY_COMPLETED`
3. **Opt-out guard** — blocks if customer opted out → `CUSTOMER_OPTED_OUT`
4. **Retry limit guard** — blocks `SAFE_RETRY` if `attempt_count >= MAX_RETRIES` → `RETRY_LIMIT_REACHED`
5. **Communication limit guard** — blocks `MESSAGE`/`PAYMENT_LINK` if `communication_count >= MAX_COMMUNICATIONS` → `COMMUNICATION_LIMIT_REACHED`
6. **AI confidence guard** — blocks high-risk actions if `aiConfidence < AI_CONFIDENCE_THRESHOLD` → `LOW_CONFIDENCE_HIGH_RISK`

---

## 8. Failure Diagnosis & Classification

**File:** `packages/backend/src/domain/diagnosis/failure-codes.ts`

| Failure Code | Failure Class | Confidence | Deterministic |
|---|---|---|---|
| `insufficient_funds` | `BUSINESS` | 0.95 | Yes |
| `limit_exceeded` | `BUSINESS` | 0.95 | Yes |
| `card_declined` | `BUSINESS` | 0.95 | Yes |
| `do_not_honor` | `BUSINESS` | 0.95 | Yes |
| `gateway_timeout` | `TECHNICAL` | 0.95 | Yes |
| `processor_error` | `TECHNICAL` | 0.95 | Yes |
| `network_error` | `TECHNICAL` | 0.95 | Yes |
| `bank_timeout` | `TECHNICAL` | 0.95 | Yes |
| `authentication_required` | `AUTHENTICATION` | 0.95 | Yes |
| `invalid_3ds` | `AUTHENTICATION` | 0.95 | Yes |
| `afa_failed` | `AUTHENTICATION` | 0.95 | Yes |
| `subscription_pending` | `RECURRING_PAYMENT_FAILURE` | 0.95 | Yes |
| `subscription_halted` | `RECURRING_PAYMENT_FAILURE` | 0.95 | Yes |
| `session_timeout` | `ABANDONMENT` | 0.95 | Yes |
| `checkout_abandoned` | `ABANDONMENT` | 0.95 | Yes |
| *(any unknown code)* | `UNKNOWN` | 0.50 | No |

Known codes return `reason_codes: ['DETERMINISTIC_RULE']`. Unknown codes return `reason_codes: ['NO_MATCHING_RULE']`.

---

## 9. Risk Engine

**File:** `packages/backend/src/domain/risk/risk-engine.ts`

### Base Recovery Probability by Failure Class
| Failure Class | Base Probability |
|---|---|
| `TECHNICAL` | 0.80 |
| `BUSINESS` | 0.60 |
| `AUTHENTICATION` | 0.70 |
| `ABANDONMENT` | 0.40 |
| `UNKNOWN` / other | 0.50 |

### History Blending
Final probability = blend of base probability and historical success rate:
```
P(recovery) = (base_probability + historical_success_rate) / 2
```
Clamped to `[0.1, 0.95]`.

### Expected Recoverable Revenue
```
expected_recoverable_revenue = floor(payment.amount * recovery_probability * 0.8)
```
The `0.8` factor represents the estimated incremental probability (not all recoveries are caused by the engine).

### Risk Score
0-100 scale, derived from probability, amount, and failure class factors.

---

## 10. Policy Engine & Guardrails

**File:** `packages/backend/src/domain/policy/policy-engine.ts`

Rules are evaluated **in order**. The engine **fails fast** on the first `BLOCK` or `HUMAN_REVIEW`.

| Order | Rule ID | Logic | Decision | Reason |
|---|---|---|---|---|
| 1 | `RULE-KILL-SWITCH` | If `!RECOVERY_AUTOMATION_ENABLED` and action is not `WAIT`/`STOP` | `BLOCK` | `RECOVERY_AUTOMATION_DISABLED` |
| 2 | `RULE-001` | If `payment.status` is `CAPTURED` or `AUTHORIZED` | `BLOCK` | `PAYMENT_ALREADY_COMPLETED` |
| 3 | `RULE-005` | If `customer.opted_out` | `BLOCK` | `CUSTOMER_OPTED_OUT` |
| 4 | `RULE-006` | If `SAFE_RETRY` and `attempt_count >= MAX_RETRIES` | `BLOCK` | `RETRY_LIMIT_REACHED` |
| 5 | `RULE-COMM-COUNT` | If `MESSAGE`/`PAYMENT_LINK` and `communication_count >= MAX_COMMUNICATIONS` | `BLOCK` | `COMMUNICATION_LIMIT_REACHED` |
| 6 | `RULE-HIGH-VALUE` | If `payment.amount > HIGH_VALUE_THRESHOLD` and action is `PAYMENT_LINK` | `HUMAN_REVIEW` | `HIGH_VALUE_TRANSACTION` |
| 7 | `RULE-004` | If action is `PAYMENT_LINK`/`MESSAGE` and `aiConfidence < AI_CONFIDENCE_THRESHOLD` | `HUMAN_REVIEW` | `LOW_CONFIDENCE_HIGH_RISK` |
| 8 | `RULE-008` | If action is `PAYMENT_LINK`/`SAFE_RETRY` and `diagnosis === 'UNKNOWN'` | `HUMAN_REVIEW` | `UNKNOWN_FAILURE_HIGH_RISK_ACTION` |

If no rule blocks: `ALLOW`.

**Policy version:** `1.0.0`

---

## 11. Action Matrix

**File:** `packages/backend/src/domain/policy/action-matrix.ts`

The action matrix constrains which actions the AI is allowed to recommend for each failure class. If the AI proposes an action not in the matrix, it is blocked and the session goes to `HUMAN_REVIEW`.

| Failure Class | Allowed Actions |
|---|---|
| `BUSINESS` | `PAYMENT_LINK`, `MESSAGE`, `SAFE_RETRY`, `PTP_WAIT`, `ESCALATE`, `HUMAN_REVIEW`, `STOP`, `WAIT` |
| `TECHNICAL` | `SAFE_RETRY`, `WAIT`, `MESSAGE`, `ESCALATE`, `HUMAN_REVIEW`, `STOP` |
| `AUTHENTICATION` | `PAYMENT_LINK`, `MESSAGE`, `PTP_WAIT`, `ESCALATE`, `HUMAN_REVIEW`, `STOP`, `WAIT` |
| `ABANDONMENT` | `PAYMENT_LINK`, `MESSAGE`, `ESCALATE`, `HUMAN_REVIEW`, `STOP`, `WAIT` |
| `RECURRING_PAYMENT_FAILURE` | `SAFE_RETRY`, `PAYMENT_LINK`, `MESSAGE`, `ESCALATE`, `HUMAN_REVIEW`, `STOP`, `WAIT` |
| `UNKNOWN` | `HUMAN_REVIEW`, `ESCALATE`, `STOP`, `WAIT` |

---

## 12. Attribution Engine

**File:** `packages/backend/src/domain/attribution/attribution-engine.ts`

| Category | Condition | Evidence |
|---|---|---|
| `DIRECT` | Payment completed through recovery link (`payment_route === 'RECOVERY_LINK'`) | `PAYMENT_LINK_CLICKED` |
| `ASSISTED` | A qualifying intervention (`MESSAGE` or `PAYMENT_LINK` with `status === 'SUCCEEDED'`) was executed within the attribution window (72h) before payment, and payment came through another route | `INTERVENTION_WITHIN_WINDOW` |
| `ORGANIC` | Session is `AT_RISK` or no qualifying successful intervention exists | `NO_QUALIFYING_INTERVENTION` |
| `UNKNOWN` | None of the above conditions match (e.g., intervention exists but outside window and session is not `AT_RISK`) | `INSUFFICIENT_DATA` |

**Headline AI recovery = DIRECT + ASSISTED.** Organic and unknown are not counted as AI-attributed.

---

## 13. AI Layer (Gemini + Mock Fallback)

### AI Adapter Interface
```typescript
interface AIAdapter {
  getRecommendation(context: RecommendationContext): Promise<AIResponse>;
  extractPTP(text: string, context: { customer_id: string; payment_id: string }): Promise<PTPResponse>;
}
```

### AI Response Schema (Zod-validated)
```typescript
{
  diagnosis: { failure_class, confidence: 0-1, reason_codes: string[] },
  recovery: { probability: 0-1, confidence: 0-1 },
  recommendation: { action: ActionType, confidence: 0-1, reason_codes: string[] },
  message?: { text: string (max 500), tone: 'HELPFUL' | 'URGENT' | 'NEUTRAL' },
  requires_human_review: boolean
}
```

### Adapter Selection (composition-root.ts)
- If `GEMINI_API_KEY` is set → `GeminiAdapter` (real Google Gemini API)
- Otherwise → `MockAIAdapter` (deterministic rule-based)

### Fallback Chain (in orchestrator)
1. Try `aiAdapter.getRecommendation()`
2. On error/timeout → `deterministicFallback()` based on failure class:
   - `TECHNICAL` → `SAFE_RETRY`
   - `BUSINESS` → `PAYMENT_LINK`
   - `AUTHENTICATION` → `PAYMENT_LINK`
   - `ABANDONMENT` → `MESSAGE`
   - `RECURRING_PAYMENT_FAILURE` → `SAFE_RETRY`
   - `UNKNOWN` → `HUMAN_REVIEW`
3. `is_fallback: true` persisted in `ai_recommendations` table

### Mock AI Adapter Logic
Maps failure class to action with confidence 0.85-0.90. PTP extraction recognizes keywords: `friday`, `tomorrow`, `next week`.

---

## 14. PTP Extraction

**File:** `packages/backend/src/domain/ptp/ptp-extractor.ts`

### PTP Response Schema
```typescript
{
  is_ptp: boolean,
  promised_date: string | null,    // ISO datetime
  promised_amount: number | null,  // paise
  confidence: number               // 0-1
}
```

### Status Determination (deterministic, after AI extraction)
| Condition | Status |
|---|---|
| `is_ptp === false` | `CANCELLED` |
| `confidence < PTP_CONFIDENCE_THRESHOLD` (0.80) | `AMBIGUOUS` |
| `is_ptp === true` but no `promised_date` | `AMBIGUOUS` |
| `is_ptp === true`, `promised_date` present, `confidence >= 0.80` | `ACTIVE` |

---

## 15. Orchestrator Flow (Step-by-Step)

**File:** `packages/backend/src/application/recovery/recovery-orchestrator.ts`

### `handleFailedPayment(event)` — Full Flow

```
1.  Extract customer_id + payment_id from webhook event
2.  Fetch or create customer record (persist to DB if missing)
3.  Fetch or create payment record (persist to DB if missing)
4.  Check for existing active session (RULE-002: one session per pair)
    → If exists, return (idempotent)
5.  Check if payment is already CAPTURED/AUTHORIZED (RULE-001)
    → If yes, return (don't start recovery on paid payment)
6.  Create recovery session in AT_RISK state
7.  State machine transition: AT_RISK → DIAGNOSING (enforced)
8.  Run DiagnosisEngine.diagnose(payment) → failure_class + confidence
9.  Load real customer history from DB (prior outcomes, success/fail counts)
10. Run RiskEngine.assess() with real history → probability + risk_score + expected_revenue
11. Update session with diagnosis + risk data
12. Get ACTION_MATRIX[diagnosis.failure_class] → available_actions
13. Call AI adapter with constrained action set:
    → Try Gemini/Mock adapter
    → On failure: use deterministicFallback()
    → Persist AI recommendation to ai_recommendations table
14. Validate AI's proposed action is in ACTION_MATRIX
    → If not: block, create BLOCKED action, persist policy decision, transition to HUMAN_REVIEW
15. Run PolicyEngine.evaluate() with session + payment + customer + AI confidence
    → Persist policy decision to policy_decisions table
16. If ALLOW:
    a. Pre-action payment re-check via paymentProvider.getPaymentStatus()
       → If CAPTURED/AUTHORIZED: close session as RECOVERED, write audit, return
    b. Create action record (linked to AI rec + policy decision)
    c. State machine transition to target state (SAFE_RETRY, OUTREACH, PTP_WAIT, etc.)
    d. Increment counters (attempt_count for SAFE_RETRY, communication_count for MESSAGE/PAYMENT_LINK)
    e. Update last_action_at
    f. Execute action via ActionExecutor
17. If HUMAN_REVIEW:
    → Transition to HUMAN_REVIEW
    → Write audit event with blocking reasons
18. If BLOCK:
    → Transition to STOPPED with closure_reason: 'POLICY_BLOCK'
    → Write audit event with blocking reasons
```

### `handlePaymentSuccess(event)` — Full Flow

```
1. Find active session for customer_id + payment_id
2. If session exists:
   → Fetch all real actions for the session from DB
   → Run AttributionEngine.calculate() with real actions
   → Persist recovery_outcome with attribution
   → State machine transition to RECOVERED
   → Write audit event with attribution + evidence
```

### `executeManualAction(sessionId, actionType, source)`

```
1. Fetch session + payment + customer
2. Pre-action payment re-check
3. Run PolicyEngine.evaluate()
4. If ALLOW: create action, transition state, increment counters, execute
5. If BLOCK: throw error with blocking reasons
```

---

## 16. Demo Simulator

**File:** `packages/backend/src/application/demo/demo-service.ts`

The simulator uses the **real recovery engine** — no fake paths.

### Operations

| Operation | What It Does |
|---|---|
| `reset()` | Deletes all demo-tagged data in FK-safe order |
| `seed(seed, count)` | Creates `count` deterministic customers + failed payments (40% TECHNICAL, 40% BUSINESS, 10% AUTH, 10% UNKNOWN) and runs each through the real orchestrator |
| `simulateFailure(params)` | Creates one controlled failed payment and runs it through the real orchestrator |
| `simulatePayment(params)` | Marks payment as CAPTURED, sends event to orchestrator.handlePaymentSuccess, returns attribution |
| `simulatePTP(params)` | Creates a promise_to_pay record, sets session to PTP_WAIT |
| `simulateOptOut(params)` | Marks customer opted_out, sets session to STOPPED |
| `runExperiment(params)` | Creates control/treatment groups, runs treatment through recovery engine, simulates organic control outcomes, calculates incremental metrics |

### Seed Result
```json
{
  "customers_created": 50,
  "payments_created": 50,
  "recovery_opportunities": 50
}
```

### Simulate Failure Result
```json
{
  "payment_id": "pay_sim_xxx",
  "customer_id": "cus_sim_xxx",
  "recovery_session_id": "ses_xxx",
  "state": "OUTREACH"
}
```

### Simulate Payment Result
```json
{
  "payment_id": "pay_xxx",
  "recovered": true,
  "attribution": "DIRECT",
  "amount_recovered": 50000
}
```

### Experiment Metrics
```json
{
  "experiment_id": "exp_xxx",
  "control": { "count": 50, "recovered": 15, "recovery_rate": 0.30, "recovered_revenue": 750000 },
  "treatment": { "count": 50, "recovered": 28, "recovery_rate": 0.56, "recovered_revenue": 1400000 },
  "incremental_recovered_revenue": 650000,
  "incremental_lift_pp": 26.0,
  "roi": 4.2
}
```

---

## 17. Dashboard Metrics (Exact Shapes)

### `GET /api/dashboard/metrics`
```json
{
  "data": {
    "revenue_at_risk": 33757600,
    "recovered_revenue": 50000,
    "incremental_recovery": 50000,
    "recovery_rate": 0.15,
    "active_workflows": 57,
    "attribution_breakdown": {
      "DIRECT": 50000,
      "ASSISTED": 0,
      "ORGANIC": 0,
      "UNKNOWN": 0
    }
  }
}
```

**Computation:**
- `revenue_at_risk` = sum of `expected_recoverable_revenue` for sessions where `closed_at IS NULL`
- `recovered_revenue` = sum of `amount_recovered` across all `recovery_outcomes` where `result === 'PAYMENT_RECOVERED'`
- `incremental_recovery` = sum of `amount_recovered` where `attribution IN ('DIRECT', 'ASSISTED')`
- `recovery_rate` = `PAYMENT_RECOVERED` outcomes / total outcomes
- `active_workflows` = count of sessions where `closed_at IS NULL`

### `GET /api/dashboard/failures-by-type`
```json
{
  "data": {
    "TECHNICAL": 20,
    "BUSINESS": 20,
    "AUTHENTICATION": 5,
    "ABANDONMENT": 0,
    "RECURRING_PAYMENT_FAILURE": 0,
    "UNKNOWN": 5
  }
}
```

### `GET /api/dashboard/recovery-funnel`
```json
{
  "data": {
    "AT_RISK": 5,
    "DIAGNOSING": 0,
    "SAFE_RETRY": 10,
    "OUTREACH": 20,
    "PAYMENT_PENDING": 5,
    "PTP_WAIT": 3,
    "HUMAN_REVIEW": 7,
    "ESCALATED": 2,
    "RECOVERED": 15,
    "STOPPED": 8
  }
}
```

### `GET /api/dashboard/guardrail-events`
Returns `AuditEvent[]` filtered to event types: `POLICY_BLOCK`, `POLICY_HUMAN_REVIEW`, `PAYMENT_ALREADY_COMPLETED`.

### `GET /api/dashboard/audit-timeline`
Returns recent `AuditEvent[]` (all types), sorted by timestamp descending.

### `GET /api/dashboard/best-interventions`
```json
{
  "data": [
    { "action_type": "PAYMENT_LINK", "total": 30, "succeeded": 18, "success_rate": 0.60 },
    { "action_type": "SAFE_RETRY", "total": 15, "succeeded": 8, "success_rate": 0.53 },
    { "action_type": "MESSAGE", "total": 10, "succeeded": 5, "success_rate": 0.50 }
  ]
}
```

---

## 18. Frontend Pages & Components

### Routing (hash-based)
| Hash Route | Page | Description |
|---|---|---|
| `#` | `DashboardPage` | Financial control room with KPIs |
| `#queue` | `RecoveryQueuePage` | Searchable session table |
| `#recovery/:id` | `RecoveryDetailPage` | Full decision trace |
| `#experiment` | `ExperimentPage` | Batch experiment runner |
| `#demo` | `DemoControlPanel` | Demo controls |

### DashboardPage
**What it shows:**
- 6 headline metric cards: Revenue at Risk, Recovered Revenue, Incremental Recovery, Recovery Rate, Active Workflows, (attribution breakdown)
- Failures by type bar chart
- Recovery funnel (sessions per state)
- Attribution breakdown (DIRECT/ASSISTED/ORGANIC/UNKNOWN)
- Audit timeline (recent events)

**API calls:** `getMetrics()`, `getFailuresByType()`, `getRecoveryFunnel()`, `getAuditTimeline()`

**Behavior:** Auto-refreshes every 5 seconds.

### RecoveryQueuePage
**What it shows:**
- Searchable, filterable table of recovery sessions
- Columns: Session ID, Customer, State, Diagnosis, Risk Score, P(Recovery), Expected Revenue, Created
- Active sessions sorted first, then by risk score descending
- State filter dropdown: ALL, AT_RISK, DIAGNOSING, OUTREACH, PTP_WAIT, RECOVERED, STOPPED, HUMAN_REVIEW
- Click a row → navigates to `#recovery/:id`

**API calls:** `getSessions()`

### RecoveryDetailPage
**What it shows:**
- Full decision trace for a single session:
  1. Payment Failed (amount, failure code, failure class)
  2. Diagnosis (failure class, confidence, deterministic vs AI)
  3. Risk Assessment (risk score, recovery probability, expected recoverable revenue)
  4. AI Recommendation (recommended action, confidence, reason codes, message, model name, is_fallback)
  5. Policy Decision (decision, rules evaluated, blocking reasons, policy version)
  6. Action Executed (action type, status, provider reference, executed_at)
  7. Outcome (result, amount recovered, attribution, evidence)
- Session details (state, attempt_count, communication_count, created_at, closed_at)
- Audit timeline for this session

**API calls:** `getTrace(sessionId)`

### ExperimentPage
**What it shows:**
- Input form: seed, control size, treatment size
- "Run Experiment" button
- After running: incremental revenue, control vs treatment stats, recovery rate comparison bar chart

**API calls:** `runExperiment(seed, controlSize, treatmentSize)`

### DemoControlPanel
**What it shows:**
- "Seed Demo Data" button (seed=42, count=100)
- "Reset Demo Data" button
- "Simulate Technical Failure" button
- "Simulate Business Failure" button
- "Simulate High-Value Failure" button
- "Simulate Unknown Failure" button
- "Run Batch Experiment" button
- Hero scenarios reference list

**API calls:** `seed()`, `reset()`, `simulateFailure()`, `runExperiment()`

### Reusable UI Components
| Component | Props | Description |
|---|---|---|
| `Card` | `children`, `className?`, `title?`, `actions?` | White rounded panel with optional header |
| `MetricCard` | `label`, `value`, `sublabel?`, `icon?`, `color?` | KPI card with large value |
| `Badge` | `children`, `className?` | Status pill (color-coded by state) |
| `Button` | `children`, `onClick?`, `variant?`, `size?`, `disabled?` | Styled button (primary/secondary/danger/ghost) |
| `LoadingSpinner` | — | Centered spinner |
| `EmptyState` | `message: string` | Centered placeholder |

### Formatting Utilities (`src/lib/format.ts`)
| Function | Description |
|---|---|
| `formatINR(paise)` | Compact INR format (e.g. ₹1.2K, ₹45K) |
| `formatINRFull(paise)` | Full INR format (e.g. ₹1,200.00) |
| `formatPercent(value)` | Percentage (e.g. 45.2%) |
| `formatDate(date)` | Date (e.g. Sep 5, 2026) |
| `formatDateTime(date)` | Date + time |
| `timeAgo(date)` | Relative time (e.g. "5 min ago") |

---

## 19. Frontend API Client

**File:** `packages/frontend/src/api/client.ts`

Base URL: `/api` (proxied to backend via Vite)

```typescript
// Dashboard
api.getMetrics(): Promise<DashboardMetrics>
api.getFailuresByType(): Promise<Record<string, number>>
api.getRecoveryFunnel(): Promise<Record<string, number>>
api.getGuardrailEvents(): Promise<AuditEvent[]>
api.getAuditTimeline(): Promise<AuditEvent[]>
api.getBestInterventions(): Promise<{ action_type, total, succeeded, success_rate }[]>

// Recovery
api.getSessions(): Promise<RecoverySession[]>
api.getSession(id): Promise<RecoverySession>
api.getTrace(id): Promise<DecisionTrace>
api.executeAction(id, action_type): Promise<{ success: boolean }>

// Demo
api.reset(): Promise<{ success: boolean, message: string }>
api.seed(seed, count): Promise<SeedResult>
api.simulateFailure(params): Promise<SimulateFailureResult>
api.simulatePayment(payment_id, route): Promise<SimulatePaymentResult>
api.simulatePTP(recovery_id, promised_date?, source_text?): Promise<SimulatePTPResult>
api.simulateOptOut(recovery_id): Promise<{ recovery_session_id, state }>
api.runExperiment(seed, control_size, treatment_size): Promise<ExperimentResult>
```

### TypeScript Types Exported
- `DashboardMetrics`
- `RecoverySession`
- `RecoveryAction`
- `RecoveryOutcome`
- `AuditEvent`
- `DecisionTrace` = `{ session, actions: RecoveryAction[], outcomes: RecoveryOutcome[], audit_events: AuditEvent[] }`
- `ExperimentResult`
- `SeedResult`
- `SimulateFailureResult`
- `SimulatePaymentResult`

---

## 20. Security Configuration

### Server Hardening (Phase 1 — Complete)
| Feature | Implementation |
|---|---|
| Security headers | `@fastify/helmet` — HSTS, X-Content-Type-Options, X-Frame-Options, CSP (production only) |
| Rate limiting | `@fastify/rate-limit` — 100 req/min per IP, health checks exempt |
| CORS | Restricted to `CORS_ORIGINS` (default: localhost:5173, localhost:3000) |
| Body limit | 1MB max (`BODY_LIMIT`) |
| API key auth | `x-api-key` header required on `/api/*` routes when `API_KEY` is set (skipped in DEMO_MODE without key) |
| Request ID | Unique `x-request-id` header on every request |
| PII redaction | Phone, email, API keys, secrets redacted from all logs |
| Graceful shutdown | `SIGTERM`/`SIGINT` handlers drain connections before exit |
| Error masking | 500 errors return generic message in production |
| Webhook security | HMAC-SHA256 signature, idempotency, stale event rejection, malformed JSON rejection |

### Auth Middleware
- **Webhook routes:** No API key — uses Razorpay signature verification
- **API routes (`/api/*`):** API key required when `API_KEY` is set or in production
- **Health routes (`/health`, `/ready`):** No auth

---

## 21. All Config Variables

| Variable | Type | Default | Description |
|---|---|---|---|
| `DATABASE_URL` | string | `./data/recovery.db` | SQLite path |
| `RAZORPAY_KEY_ID` | string | — | Razorpay API key |
| `RAZORPAY_KEY_SECRET` | string | — | Razorpay API secret |
| `RAZORPAY_WEBHOOK_SECRET` | string | — | Webhook signing secret |
| `GEMINI_API_KEY` | string | — | Google Gemini API key |
| `GEMINI_MODEL` | string | `gemini-1.5-flash` | Gemini model name |
| `MAX_RETRIES` | number | `3` | Max SAFE_RETRY attempts |
| `MAX_COMMUNICATIONS` | number | `5` | Max MESSAGE/PAYMENT_LINK per session |
| `MIN_COMMUNICATION_INTERVAL_HOURS` | number | `24` | Min hours between communications |
| `AI_CONFIDENCE_THRESHOLD` | number | `0.70` | Min AI confidence for autonomous high-risk actions |
| `PTP_CONFIDENCE_THRESHOLD` | number | `0.80` | Min confidence for PTP to be ACTIVE |
| `HIGH_VALUE_THRESHOLD` | number | `50000` | Paise threshold for high-value HUMAN_REVIEW (₹500) |
| `ATTRIBUTION_WINDOW_HOURS` | number | `72` | Window for ASSISTED attribution |
| `RECOVERY_AUTOMATION_ENABLED` | boolean | `true` | Kill switch for all automated actions |
| `DEMO_MODE` | boolean | `true` | Uses simulator adapters, skips API key auth |
| `DEMO_COMPRESS_DELAYS` | boolean | `true` | Compresses time delays in demo |
| `DEMO_SEED` | number | `42` | Default seed for deterministic demo data |
| `PORT` | number | `3000` | Backend port |
| `FRONTEND_PORT` | number | `5173` | Frontend port |
| `NODE_ENV` | string | `development` | Environment |
| `LOG_LEVEL` | string | `info` | Pino log level |
| `CORS_ORIGINS` | string | `http://localhost:5173,http://localhost:3000` | Comma-separated allowed origins |
| `API_KEY` | string | — | API key for `/api/*` routes |
| `RATE_LIMIT_MAX` | number | `100` | Max requests per window |
| `RATE_LIMIT_WINDOW` | string | `1 minute` | Rate limit window |
| `BODY_LIMIT` | number | `1048576` | Max body size in bytes (1MB) |
| `WEBHOOK_MAX_AGE_SECONDS` | number | `300` | Reject webhooks older than this |

---

## 22. Test Suite

**9 test files, 68 tests, all passing.**

| File | Tests | Coverage |
|---|---|---|
| `tests/unit/state-machine/transitions.test.ts` | 3 | Valid and invalid transitions |
| `tests/unit/state-machine/guards.test.ts` | 13 | Already-paid, opt-out, retry ceiling, comm limit, AI confidence, terminal state |
| `tests/unit/diagnosis/diagnosis-engine.test.ts` | 8 | Technical, business, auth, abandonment, subscription, unknown, missing code, case-insensitive |
| `tests/unit/risk/risk-engine.test.ts` | 6 | Probabilities by class, historical blend, expected revenue, probability clamping |
| `tests/unit/attribution/attribution-engine.test.ts` | 6 | DIRECT, ASSISTED, ORGANIC, ORGANIC-failed, UNKNOWN, concurrent |
| `tests/unit/ptp/ptp-extractor.test.ts` | 6 | Valid date, ambiguous-low-confidence, ambiguous-no-date, not-PTP, AI-unavailable, promised-amount |
| `tests/unit/policy/policy-engine.test.ts` | 4 | Basic policy rules |
| `tests/unit/policy/policy-engine-extended.test.ts` | 13 | All 8 rules + kill switch + high-value + version + allow-all-rules |
| `tests/integration/webhook/signature.test.ts` | 9 | Valid/invalid signature, wrong secret, empty sig/secret, length mismatch, idempotency, dedup, unique constraint |

---

## 23. NPM Scripts

### Root (`D:\recoveryagent\package.json`)
| Script | Command | Description |
|---|---|---|
| `dev` | `concurrently "npm run dev --workspace=packages/backend" "npm run dev --workspace=packages/frontend"` | Start both servers |
| `build` | `npm run build --workspace=packages/backend && npm run build --workspace=packages/frontend` | Full build |
| `test` | `npm run test --workspace=packages/backend` | Run tests |
| `typecheck` | `npm run typecheck --workspace=packages/backend` | TypeScript check |
| `db:migrate` | `npm run db:migrate --workspace=packages/backend` | Run migrations |
| `db:generate` | `npm run db:generate --workspace=packages/backend` | Generate migrations |

### Backend
| Script | Description |
|---|---|
| `dev` | `tsx watch src/server.ts` — hot-reload dev server |
| `build` | `tsc` — compile TypeScript |
| `typecheck` | `tsc --noEmit` — type check only |
| `test` | `vitest run` — run tests once |
| `test:watch` | `vitest` — watch mode |
| `test:coverage` | `vitest run --coverage` — with coverage |
| `db:generate` | `drizzle-kit generate` — generate migration SQL |
| `db:migrate` | `tsx src/infrastructure/db/migrate.ts` — run migrations |
| `db:studio` | `drizzle-kit studio` — visual DB browser |

### Frontend
| Script | Description |
|---|---|
| `dev` | `vite` — dev server with HMR |
| `build` | `tsc -b && vite build` — production build |
| `preview` | `vite preview` — preview production build |

---

## 24. What Works vs What's Next

### Completed Phases

| Phase | Status | What was done |
|---|---|---|
| Domain & DB models | ✅ | 13 tables, all entity types, Drizzle ORM |
| Webhook ingestion | ✅ | Signature verification, idempotency, event normalization |
| State machine | ✅ | 10 states, enforced transitions, 6 guards |
| Diagnosis engine | ✅ | 15 failure codes → 6 failure classes, deterministic |
| Risk engine | ✅ | Probability by class, history blending, revenue calc |
| Policy engine | ✅ | 8 rules, fail-fast, ALLOW/BLOCK/HUMAN_REVIEW |
| Action executor | ✅ | Payment link, retry, message, wait, escalate |
| Outcome observer | ✅ | Real actions fetched, attribution calculated |
| Attribution engine | ✅ | DIRECT, ASSISTED, ORGANIC, UNKNOWN |
| Audit ledger | ✅ | Tamper-evident hash chain |
| AI recommendation | ✅ | Gemini adapter + mock fallback |
| PTP extraction | ✅ | AI extraction + deterministic status |
| Demo simulator | ✅ | Seed, reset, simulate failure/payment/PTP/opt-out, experiment |
| Batch experiment | ✅ | Control/treatment, incremental revenue, ROI |
| Dashboard | ✅ | Metrics, funnel, failures, attribution, audit timeline |
| Frontend | ✅ | 5 pages, API client, UI components, hash routing |
| Test suite | ✅ | 9 files, 68 tests |
| Phase 1: Security | ✅ | Helmet, rate-limit, CORS, API key auth, Zod validation, PII redaction, graceful shutdown |
| Phase 2: Orchestrator | ✅ | State machine enforcement, action matrix, pre-action recheck, real customer history, AI/policy persistence, counter increments, outcome observer fix |

### Remaining Phases (Live Production)

| Phase | Status | What needs to be done |
|---|---|---|
| Phase 3: Razorpay | Pending | Expand event types, implement retryPayment for subscriptions, webhook payload validation |
| Phase 4: Notifications | Pending | Real SMS/email provider (Twilio/SendGrid), DLR tracking, template management |
| Phase 5: AI Hardening | Pending | Fallback adapter with timeout/retry, PII redaction, prompt improvement, token tracking |
| Phase 6: Postgres | Pending | Dual schema support, pg driver, migration regeneration |
| Phase 7: Deployment | Pending | Dockerfile, docker-compose, CI/CD, static file serving |
| Phase 8: Observability | Pending | Health/readiness checks, Prometheus metrics, PTP scheduler, alerting |

### Known Gaps for UI Development
1. **No manual action UI** — `RecoveryDetailPage` doesn't expose the `executeAction` API yet
2. **No PTP/opt-out simulation UI** — `DemoControlPanel` doesn't have inputs for `simulatePTP` or `simulateOptOut`
3. **No AI recommendation display** — `ai_recommendations` table is populated but not shown in the trace endpoint response (only linked via `ai_recommendation_id` on actions)
4. **No policy decision display** — `policy_decisions` table is populated but not shown in the trace endpoint response (only linked via `policy_decision_id` on actions)
5. **No WebSocket** — Dashboard polls every 5 seconds instead of real-time push
6. **No pagination UI** — Recovery queue fetches all sessions, pagination is server-side but not wired to UI controls
7. **Hash routing only** — No React Router, deep links use `#` fragments

---

*This document is the single source of truth for the current project state. Update it after each phase completion.*
