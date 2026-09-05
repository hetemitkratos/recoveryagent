---
name: revenue-recovery
description: >-
  Use this skill when implementing any part of the AI Revenue Recovery MVP
  domain: payment failure handling, recovery sessions, recovery orchestration,
  diagnosis, risk scoring, intervention selection, outcome observation, or
  attribution. This skill encodes the bounded recovery loop and all domain
  invariants that must never be violated.
---

# Revenue Recovery Domain Skill

## Purpose

This skill keeps the agent aligned to the **bounded revenue recovery loop**:

```
DETECT → UNDERSTAND → PRIORITIZE → DECIDE → CHECK POLICY → ACT → VERIFY → STOP/ESCALATE → MEASURE
```

This is NOT a generic collections system. It is a deterministic, bounded, auditable revenue recovery engine.

---

## Core Recovery Loop

Every recovery opportunity must follow exactly this sequence:

1. **Payment event received** (via webhook or simulator)
2. **Idempotency check** — process once, acknowledge duplicates
3. **Event normalized** to internal domain model
4. **Recovery session created** (exactly one per customer+payment pair)
5. **Risk assessment calculated** — `risk_score`, `recovery_probability`, `expected_recoverable_revenue`
6. **Failure diagnosed** — `TECHNICAL | BUSINESS | AUTHENTICATION | ABANDONMENT | UNKNOWN`
7. **AI recommendation obtained** (via adapter, with schema validation)
8. **Policy evaluated** — `ALLOW | BLOCK | HUMAN_REVIEW`
9. **Payment re-checked** before any customer-facing action
10. **Action executed** (only if policy = ALLOW and payment still unpaid)
11. **Outcome observed** — only a confirmed payment event produces RECOVERED
12. **Attribution calculated** — `DIRECT | ASSISTED | ORGANIC | UNKNOWN`
13. **Audit event written**

---

## Domain Entities

| Entity | Role |
|---|---|
| `Customer` | Payer identity and preferences |
| `Payment` | Individual payment attempt lifecycle |
| `Subscription` | Recurring billing lifecycle |
| `RecoverySession` | Central recovery lifecycle entity |
| `RecoveryAction` | A single attempted intervention |
| `PolicyDecision` | Deterministic authorization result |
| `AIRecommendation` | AI output (stored separately from policy) |
| `RecoveryOutcome` | What actually happened after action |
| `CommunicationEvent` | Customer-facing communication record |
| `PromiseToPay` | Stateful PTP commitment |
| `AuditEvent` | Append-only decision trail |
| `ExperimentAssignment` | Control/treatment assignment |
| `RiskAssessment` | Economic recovery scoring |

---

## Recovery States

```
AT_RISK → DIAGNOSING
DIAGNOSING → SAFE_RETRY | OUTREACH | PTP_WAIT | HUMAN_REVIEW | STOPPED | RECOVERED
SAFE_RETRY → PAYMENT_PENDING | OUTREACH | ESCALATED | STOPPED
OUTREACH → PAYMENT_PENDING | PTP_WAIT | ESCALATED | STOPPED
PAYMENT_PENDING → RECOVERED | OUTREACH | ESCALATED | STOPPED
PTP_WAIT → RECOVERED | OUTREACH | ESCALATED | STOPPED
HUMAN_REVIEW → OUTREACH | SAFE_RETRY | ESCALATED | STOPPED
ESCALATED → HUMAN_REVIEW | RECOVERED | STOPPED
```

Terminal states (no automatic transitions): `RECOVERED`, `STOPPED`

---

## Critical Invariants — Never Violate

1. **One active session per customer+payment pair.** DB unique constraint required.
2. **Payment status is authoritative.** Always re-check before any external action.
3. **RECOVERED is terminal.** No further recovery actions after payment confirmed.
4. **STOPPED cannot auto-resume.** Requires authorized human intervention.
5. **AI recommendation ≠ authorization.** Policy engine runs between AI and executor.
6. **Action executed ≠ money recovered.** Only observed payment = RECOVERED.
7. **Observed payment ≠ incremental recovery.** Must use experiment evidence.
8. **No duplicate webhook processing.** `source_event_id` is idempotency key.

---

## Failure Classification

Map deterministically first, use AI only for ambiguous/unknown codes:

```
TECHNICAL      → timeout, processor error, infrastructure issue  → SAFE_RETRY
BUSINESS       → insufficient_funds, limit_exceeded, decline     → PAYMENT_LINK / MESSAGE
AUTHENTICATION → 3DS, AFA, verification required                 → PAYMENT_LINK
ABANDONMENT    → session timeout, incomplete checkout             → PAYMENT_LINK / MESSAGE
RECURRING_PAYMENT_FAILURE → subscription pending/halted after debit fail   → SAFE_RETRY (bounded)
UNKNOWN        → unrecognized or conflicting signals              → HUMAN_REVIEW
```

---

## Risk Formula

```
Expected Recoverable Revenue = Amount × P(Recovery) × P(Incremental)
```

Store: `risk_score` (0–100), `recovery_probability` (0.0–1.0), `expected_recoverable_revenue`.
Never hardcode these values in the dashboard — derive from persistent data.

---

## Attribution Rules

| Evidence | Classification |
|---|---|
| Paid through agent-generated recovery link | `DIRECT` |
| Qualifying intervention within attribution window, no direct link | `ASSISTED` |
| Payment with no qualifying intervention | `ORGANIC` |
| Insufficient evidence | `UNKNOWN` |

- One payment → max one `RecoveryOutcome` (anti-double-counting)
- `ATTRIBUTION_WINDOW` is configurable
- ORGANIC/UNKNOWN must never be reported as AI-recovered revenue
- AI cannot assign attribution — `AttributionEngine` only

---

## Action Vocabulary (closed set — never extend without policy approval)

```
WAIT | SAFE_RETRY | PAYMENT_LINK | MESSAGE | PTP_WAIT | ESCALATE | HUMAN_REVIEW | STOP
```

---

## MVP Scope Boundary (do NOT implement)

- Voice / Hinglish recovery
- WhatsApp
- B2B / ERP / invoice integration
- Checkout abandonment
- Full subscription lifecycle management
- Mandate sequencing
- Production WORM audit storage
- Autonomous legal/tax interpretation

---

## PRD-Sourced Extensions (prd.md additions not in other specs)

- **6th failure class:** `RECURRING_PAYMENT_FAILURE` (subscription context) → SAFE_RETRY bounded
- **`promised_amount`** (nullable) added to `PromiseToPay` entity (from PRD §12)
- **Customer Recovery Profile** (PRD §7): computed view from existing data, not a new table.
  Fields: lifetime_payment_count, success_count, fail_count, recent_failure_reasons,
  prior_recovery_outcomes, avg_recovery_time, preferred_channel, recent_outreach_count,
  opted_out, active_ptp
- **AI action aliases** (PRD §FR-05 → AI_CONTRACT.md): `NO_ACTION→WAIT`,
  `SILENT_RETRY→SAFE_RETRY`, `PTP_REQUEST→PTP_WAIT` — AI_CONTRACT.md vocab is canonical
- **Experiment arm**: use `CONTROL | TREATMENT` in DB; dashboard may label as "AI Treatment"

## References

- Full entity fields: `docs/DOMAIN_MODEL.md`
- State transitions: `docs/STATE_MACHINE.md`
- Policy rules: `docs/POLICY_RULES.md`
- Attribution: `docs/ATTRIBUTION.md`
- Architecture: `docs/ARCHITECTURE.md`

