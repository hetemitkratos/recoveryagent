# PRD — AI Revenue Recovery Engine

**Project:** Razorpay Buildathon — Track 03: AI Revenue Recovery  
**Document type:** Product Requirements Document / implementation baseline  
**Status:** MVP build specification  
**Primary source:** `AI_Revenue_Recovery_MVP_Blueprint.docx`  
**Purpose:** Give an implementation agent an unambiguous baseline for building the smallest end-to-end system that proves measurable, bounded revenue recovery.

---

## 0. Product Thesis

> **Detect revenue at risk → diagnose why → estimate recoverability → choose the least-cost compliant intervention → execute → verify payment → stop/escalate → measure incremental revenue.**

We are **not** building seven separate recovery products. We are building one bounded **Revenue Recovery Engine** with a narrow MVP centered on failed payments and subscription failures.

The MVP must prove the complete loop:

```text
Webhook/Event
    ↓
Authenticate + Idempotency
    ↓
Normalize State
    ↓
Risk + Diagnosis
    ↓
AI Recommendation
    ↓
Deterministic Policy Gate
    ↓
Action Executor
    ↓
Observe Outcome
    ↓
Attribution + Audit
    ↓
Dashboard / Revenue Metrics
```

The central product promise is **recover measurable revenue**, not simply detect failures or send messages.

---

# 1. Objectives

## 1.1 Primary objectives

1. Detect failed payment/subscription events in near real time.
2. Normalize those events into an internal recovery state.
3. Distinguish major failure classes, especially technical vs. business failures.
4. Quantify **revenue at risk** and prioritize recoverable opportunities.
5. Use AI for diagnosis/context/recommendation where it adds value.
6. Keep money-moving, consent, retry, timing, and escalation authority deterministic.
7. Execute at least one real recovery path: **Razorpay payment link + notification**.
8. Observe subsequent payment success and close the recovery workflow automatically.
9. Attribute recovery to direct, assisted, organic, or unknown outcomes.
10. Maintain a per-customer/payment audit timeline.
11. Demonstrate incremental recovery on a batch using a control/baseline.
12. Demonstrate hard stopping behavior for paid, opted-out, duplicate, retry-limit, and low-confidence cases.

## 1.2 Secondary objectives

- Include text/transcript-based PTP extraction as a high-value agentic capability.
- Provide a strong dashboard that shows money and decisions first, infrastructure second.
- Keep the architecture extensible to voice, checkout, B2B receivables, richer mandate intelligence, and multi-rail routing.

---

# 2. Non-Goals

The build agent MUST NOT expand scope into any of the following unless explicitly requested later:

- General-purpose collections automation.
- Autonomous decisions to charge money.
- Autonomous binding tax/legal determinations.
- Full B2B ERP/email/tax dispute automation.
- Production-grade multi-aggregator routing.
- Every payment rail and communication channel.
- Full production telecom/compliance infrastructure.
- Voice AI as a dependency of the core MVP.
- Claims of recovered revenue without attribution evidence.
- Optimization for maximum contact volume.

The optimization target is **incremental recovered revenue per compliant action**.

---

# 3. Users / Actors

## 3.1 Merchant / Operations user

Needs to:
- See total revenue at risk.
- See recovered and incremental recovered revenue.
- Understand why the agent acted or did not act.
- Inspect individual recovery sessions.
- See policy/guardrail events.
- Review escalated or ambiguous cases.

## 3.2 Customer / Payer

Can:
- Receive a recovery intervention.
- Pay through a recovery payment link.
- Opt out.
- Indicate a promise to pay at a future date.

## 3.3 Recovery Agent

The agent:
- Interprets event/customer context.
- Diagnoses or classifies failures.
- Estimates recovery probability.
- Recommends one action from an approved action set.
- Personalizes communication.
- Extracts PTP information.

The agent does **not** override deterministic policy.

## 3.4 Policy Engine

The policy engine is the final authority on:
- Latest payment status.
- Consent/opt-out.
- Communication timing.
- Frequency limits.
- Retry ceilings.
- Duplicate recovery sessions.
- High-risk/low-confidence blocks.
- Escalation requirements.

---

# 4. MVP Scope Matrix

| Capability | MVP | Notes |
|---|---|---|
| Payment failure detection | YES | Razorpay webhook ingestion |
| Webhook authenticity validation | YES | HMAC/signature validation |
| Webhook idempotency | YES | Prevent duplicate workflow creation |
| Failure diagnosis | YES | Deterministic taxonomy + AI fallback |
| Revenue-at-risk score | YES | Decision-support estimate |
| Customer recovery profile | YES | Payment/failure/recovery history |
| AI intervention selector | YES | Choose only from approved actions |
| Deterministic policy gate | YES | Mandatory before actions |
| Payment-link recovery | YES | Primary recovery mechanism |
| One messaging channel | YES | Real or mocked adapter |
| Subscription retry state machine | YES | Bounded demo sequence; map to actual Razorpay capabilities before live use |
| Outcome observer | YES | Close workflow on payment outcome |
| Recovery attribution | YES | Direct / assisted / organic / unknown |
| Audit ledger | YES | Demo-grade tamper-evident append-only design |
| Batch experiment | YES | Control + AI treatment |
| Dashboard | YES | Revenue + recovery + guardrails |
| PTP extraction | YES / lightweight | Transcript/text based, not telephony dependent |
| Voice | OPTIONAL | Demo extension only |
| Checkout abandonment | FUTURE | Reuse same AT_RISK core |
| B2B receivables | FUTURE | Human approval required |
| Multi-rail routing | FUTURE | Decision logic only |
| Full production compliance stack | FUTURE | Verify official constraints before rollout |

---

# 5. Core Functional Requirements

## FR-01 — Event ingestion

The system shall accept Razorpay payment/subscription webhook events.

Requirements:
- Validate webhook authenticity before trusting event data.
- Store the raw event or a secure representation for audit/replay.
- Use the provider event ID for idempotency.
- Normalize supported events into internal domain events.
- Do not create duplicate recovery sessions from duplicate deliveries.

### Minimum supported event concepts

- `payment.failed`
- `payment.paid` / successful payment outcome
- subscription pending/failure state
- subscription halted state where applicable to the demo
- payment-link success outcome

The exact provider event names/fields MUST be verified against current Razorpay documentation before live integration.

---

## FR-02 — Normalized domain model

Create a normalized internal representation so the rest of the system is provider-independent.

### Required entities

- `Customer`
- `Payment`
- `Subscription`
- `RecoverySession`
- `RecoveryAction`
- `Outcome`
- `AuditEvent`
- `PolicyDecision`
- `PTPCommitment`
- `ExperimentAssignment`

---

## FR-03 — Recovery session ownership

Every customer/payment or customer/subscription opportunity MUST have at most one active recovery session.

Before creating a new action:
- acquire/check recovery ownership;
- verify the latest payment state;
- reject duplicate active recovery attempts.

This prevents two workers/agents from sending duplicate actions for the same opportunity.

---

## FR-04 — Failure diagnosis

### Primary diagnosis classes

1. `TECHNICAL`
2. `BUSINESS`
3. `AUTHENTICATION`
4. `ABANDONMENT`
5. `RECURRING_PAYMENT_FAILURE`
6. `UNKNOWN`

### Initial diagnosis rules

| Signal | Diagnosis | Preferred action posture |
|---|---|---|
| Timeout / infrastructure degradation | TECHNICAL | Silent/safe retry or wait; avoid aggressive outreach |
| Insufficient funds | BUSINESS | Grace period + recovery link/message |
| Authentication / credential problem | AUTHENTICATION | Secure recovery/payment-method path |
| No paid event after checkout window | ABANDONMENT | Timed recovery link/message |
| Subscription enters pending after failed debit | RECURRING_PAYMENT_FAILURE | Bounded retry sequence + status monitoring |
| Unknown / low-confidence | UNKNOWN | Safe fallback / human review |

The classifier may be deterministic for common, known conditions. AI should be used where ambiguity or customer context materially improves the decision.

---

## FR-05 — AI reasoning contract

The AI must return **structured output**, not free-form executable instructions.

### Example contract

```json
{
  "diagnosis": "BUSINESS",
  "diagnosis_confidence": 0.96,
  "recovery_probability": 0.78,
  "recommended_action": "PAYMENT_LINK",
  "reason_codes": [
    "INSUFFICIENT_FUNDS",
    "HIGH_RECOVERY_HISTORY"
  ],
  "customer_context": {
    "successful_prior_payments": 8,
    "recent_recoveries": 2,
    "preferred_channel": "SMS"
  },
  "message_draft": "...",
  "evidence": [
    "Payment failure reason",
    "Prior recovery outcome"
  ]
}
```

### Allowed action enum for MVP

```text
NO_ACTION
SILENT_RETRY
PAYMENT_LINK
MESSAGE
PTP_REQUEST
ESCALATE
```

The model MUST NOT be able to invent a new action.

---

# 6. Revenue-at-Risk Engine

The MVP must score opportunities by **value of acting**, not merely failure presence.

## 6.1 Required signals

- Amount at risk.
- Failure class.
- Historical recovery behavior.
- Time sensitivity.
- Engagement/channel history.
- Number of prior attempts.
- Current payment/subscription status.

## 6.2 Reference formula

```text
Expected Recoverable Revenue
=
Amount at Risk
× Estimated P(Recovery)
× Estimated P(Recovery is Incremental)
```

Important:
- These are decision-support estimates, not guaranteed financial outcomes.
- Store the estimates at action time.
- Measure actual outcomes for later calibration.

## 6.3 MVP risk score

Create a normalized score that permits ranking even if the implementation uses a heuristic instead of a trained model.

Example shape:

```text
risk_score = f(amount, recovery_probability, urgency, prior_attempts, current_state)
```

The implementation may use a deterministic heuristic for the first version. Do not over-engineer a machine-learning model before the recovery loop works.

---

# 7. Customer Recovery Profile

The system should aggregate history into a compact customer-level context.

### Minimum fields

- Lifetime/aggregate payment count.
- Successful payment count.
- Failed payment count.
- Recent failure reasons.
- Previous recovery outcomes.
- Average recovery time where available.
- Preferred successful channel.
- Recent outreach count.
- Opt-out/suppression state.
- Active PTP commitment.

The purpose is to let the agent distinguish customers who need different intervention intensity.

---

# 8. Deterministic Policy / Guardrail Engine

This layer executes **after AI recommendation and before any external action**.

## 8.1 Hard guards

### Paid-state guard

If the latest status is already successful:
- block outbound action;
- close recovery session;
- record audit event.

### Opt-out guard

If the customer indicates `stop`, `cancel`, `do not call`, or equivalent opt-out:
- suppress future active communication;
- update customer suppression state;
- cancel/terminate applicable recovery workflow.

### Duplicate session guard

Only one active recovery owner per customer/payment opportunity.

### Frequency guard

For the MVP, enforce the product's conservative outbound-attempt ceiling defined by configuration. The engine should make this configurable rather than hard-coding a provider/legal limit.

### Time-window guard

Use a conservative internal contact window for the MVP. This is a **product safety policy**, not automatically a claim about legal maximums.

### Retry ceiling

When the supported subscription retry ceiling/state is reached:
- cease automated debit attempts;
- move to recovery-link or human/customer-directed recovery.

### Low-confidence guard

If diagnosis/action confidence is below configured thresholds:
- block high-risk autonomous action;
- route to human review or safe fallback.

### Provider failure guard

If an action provider fails:
- persist failure;
- do not silently duplicate the action;
- use an explicitly configured safe fallback.

---

# 9. Recovery State Machine

Use explicit states and transitions. Do not encode the workflow entirely as LLM conversation logic.

## States

```text
AT_RISK
TECHNICAL
BUSINESS
AUTHENTICATION
RECURRING_PENDING
SILENT_RETRY
OUTREACH_ELIGIBLE
PAYMENT_LINK_SENT
PAYMENT_PENDING
PTP_WAIT
RECOVERED
ORGANIC_RECOVERY
ASSISTED_RECOVERY
ESCALATED
HUMAN_REVIEW
STOPPED
OPTED_OUT
EXPIRED
```

## Global overrides

```text
PAID                -> STOP
OPT_OUT             -> STOP
LIMIT_REACHED       -> STOP / ESCALATE
PROHIBITED_ACTION   -> BLOCK
UNKNOWN_ERROR       -> SAFE_FALLBACK
DUPLICATE           -> IGNORE
```

---

# 10. Intervention Engine

The intervention executor should support adapter-based actions.

## MVP actions

### A. Silent retry

Used primarily for technical degradation where customer outreach would be tone-deaf or unnecessary.

### B. Payment link

Primary customer-facing recovery path.

Requirements:
- Create or reuse a payment/recovery link as appropriate.
- Attach recovery metadata sufficient for attribution.
- Persist link ID and recovery session ID.
- Send link only after latest-status and policy checks.

### C. Message

One channel is sufficient for the MVP.

Adapter abstraction:

```text
MessageProvider.send(template, destination, metadata)
```

A mocked provider is acceptable for demo reliability.

### D. Escalation

Create an explicit escalation record containing:
- reason;
- customer/payment context;
- agent recommendation;
- policy block;
- evidence/audit references.

---

# 11. Subscription Recovery

Implement a small bounded retry state machine for the demo.

Conceptual sequence:

```text
T=0 Failure
    ↓
PENDING
    ↓
T+1 Retry
    ↓
T+2 Retry
    ↓
T+3 / Retry Ceiling
    ↓
HALTED / MANUAL RECOVERY PATH
```

Important:
- The state machine must respect actual Razorpay capabilities and current provider behavior.
- Do not fabricate provider-side state transitions.
- The application can simulate elapsed time in a demo environment.

After automated retries are exhausted:
- stop automated debit attempts;
- create a payment link/manual recovery path;
- track outcome.

---

# 12. PTP (Promise-to-Pay)

PTP is included as a lightweight agentic feature.

## Flow

```text
Conversation / Transcript
        ↓
LLM extracts:
- intent
- promised date
- amount if stated
        ↓
PTP Commitment Created
        ↓
Outreach Paused
        ↓
Check payment at promise date
        ↓
PAID → close
NOT PAID → contextual follow-up eligible
```

Example extracted object:

```json
{
  "is_ptp": true,
  "promised_date": "2026-09-06",
  "promised_amount": 18500,
  "confidence": 0.94
}
```

PTP extraction should work from supplied text/transcript without requiring telephony.

---

# 13. Attribution

Do not report all post-intervention payment as AI recovery.

## Attribution classes

### DIRECT
Customer paid through the AI-created recovery link/path.

### ASSISTED
Customer received a qualifying intervention and then paid through another route with reasonable temporal/identity evidence.

### ORGANIC
Customer recovered without a qualifying intervention.

### UNKNOWN
Evidence is insufficient to establish causality.

## Dashboard rules

- Headline AI-attributed recovery = Direct + Assisted.
- Organic recovery is displayed separately.
- Unknown recovery is excluded from headline ROI.

## Concurrency requirement

Immediately before outbound communication:
- re-check payment status;
- terminate the workflow if paid.

---

# 14. Experiment Design

The demo must show **incremental recovery**, not just a pile of successful payments.

## 14.1 Recommended batch

Use a synthetic or Razorpay test-mode batch with comparable control and AI-treatment groups.

Example:

```text
Control:      500 opportunities
AI treatment: 500 opportunities
```

The exact batch size can be smaller if implementation constraints require it, but the groups must be comparable.

## 14.2 Required metrics

- Transactions/opportunities.
- Revenue at risk.
- Recovered revenue.
- Recovery rate.
- Incremental lift vs. control/baseline.
- AI-attributed recovery.
- Assisted recovery.
- Organic recovery.
- Cost to recover.
- Net recovery.
- Net recovery ROI.
- Guardrail violations/stops.
- False outreach count.

## 14.3 Headline metric

```text
Incremental Revenue Recovered
=
Observed AI-treatment recovery
−
Expected organic/control recovery
```

Recovery rate alone is secondary. The primary story is **incremental money recovered**.

---

# 15. Dashboard Requirements

The first screen is a financial control room.

## Top-level cards

1. **Revenue at Risk**
2. **Recovered Revenue**
3. **Incremental Recovery**
4. **Recovery Rate**
5. **Net Recovery ROI**

## Secondary panels

- Active workflows by state.
- Failure cause distribution.
- Best interventions.
- Attribution split.
- Guardrail events.
- Escalations.
- Batch/control comparison.

## Audit panel

Customer-level timeline showing:

```text
failure event
→ diagnosis
→ risk score
→ AI recommendation
→ policy checks
→ action
→ payment/link event
→ outcome
→ attribution
```

The dashboard should visually prioritize rupee outcomes and action decisions over implementation infrastructure.

---

# 16. Audit / Observability Requirements

Every significant step must create an auditable event.

## Minimum AuditEvent schema

```json
{
  "event_id": "uuid",
  "payment_id": "...",
  "subscription_id": "...",
  "customer_id": "...",
  "source_event_id": "...",
  "received_at": "timestamp",
  "event_type": "...",
  "failure_reason": "...",
  "diagnosis": "...",
  "diagnosis_confidence": 0.96,
  "risk_score": 0.81,
  "selected_action": "PAYMENT_LINK",
  "policy_checks": {},
  "action_status": "COMPLETED",
  "outcome": "RECOVERED",
  "amount_recovered": 12000,
  "attribution": "DIRECT"
}
```

The demo implementation can use an append-only/tamper-evident log. Production hardening can add stronger immutable storage mechanisms later.

---

# 17. Data Model Baseline

## Customer

```text
id
external_id
name
contact
status
suppressed
created_at
updated_at
```

## Payment

```text
id
customer_id
provider_payment_id
amount
currency
status
failure_code
failure_class
created_at
updated_at
```

## Subscription

```text
id
customer_id
provider_subscription_id
amount
status
retry_count
next_retry_at
retry_ceiling
created_at
updated_at
```

## RecoverySession

```text
id
customer_id
payment_id nullable
subscription_id nullable
state
risk_score
recovery_probability
incremental_probability
owner_id
started_at
closed_at
close_reason
```

## RecoveryAction

```text
id
recovery_session_id
action_type
channel
provider_reference
message_template
created_at
sent_at
blocked_at
block_reason
status
```

## Outcome

```text
id
recovery_session_id
outcome_type
amount_recovered
attribution
observed_at
evidence_reference
```

## PTPCommitment

```text
id
customer_id
recovery_session_id
promised_date
promised_amount
confidence
status
created_at
resolved_at
```

## AuditEvent

See Section 16.

## ExperimentAssignment

```text
id
customer_id or recovery_session_id
arm = CONTROL | AI
group_created_at
```

---

# 18. API / Service Boundaries

Keep implementation modular enough that providers can be swapped.

## Ingestion

```text
POST /webhooks/razorpay
```

Responsibilities:
- verify signature;
- dedupe;
- enqueue/process normalized event;
- return quickly.

## Recovery

```text
POST /recovery/opportunities/:id/evaluate
POST /recovery/opportunities/:id/execute
GET  /recovery/opportunities/:id
```

## Payment link adapter

```text
PaymentProvider.createRecoveryLink(...)
PaymentProvider.getPaymentStatus(...)
```

## Messaging adapter

```text
MessageProvider.send(...)
```

## Dashboard

```text
GET /metrics/overview
GET /metrics/batch
GET /recovery-sessions
GET /recovery-sessions/:id/timeline
GET /guardrails/events
```

Exact framework/database/provider choices may follow the existing repository. Do not add unnecessary infrastructure before the core recovery path is functioning.

---

# 19. AI Prompt / Tooling Constraints

The AI system prompt should establish the following principles:

1. You are a **revenue recovery decision-support agent**.
2. You can only select from an explicit action enum.
3. You cannot authorize a prohibited action.
4. You cannot ignore policy results.
5. You must provide concise evidence/reason codes.
6. You must express uncertainty through confidence.
7. When uncertain, choose `HUMAN_REVIEW` / safe fallback.
8. Do not invent payment state, customer facts, or provider capabilities.
9. Never claim revenue was recovered unless the observer recorded evidence.
10. Do not reinterpret a policy block as an invitation to find a workaround.

---

# 20. Failure Handling

## Already paid

Expected behavior:
- no message sent;
- session closed;
- audit event recorded.

## Duplicate webhook

Expected behavior:
- one normalized event;
- one recovery session;
- no duplicate action.

## AI unavailable

Expected behavior:
- deterministic diagnosis/action path remains operational for supported cases;
- ambiguous cases use safe fallback.

## Messaging provider unavailable

Expected behavior:
- action marked failed;
- no uncontrolled retries;
- configured safe fallback or escalation.

## Payment link already exists

Expected behavior:
- prefer reuse when valid;
- do not create needless duplicate links.

## Payment arrives while workflow is active

Expected behavior:
- close session immediately;
- suppress pending outbound action.

## Low-confidence diagnosis

Expected behavior:
- block high-risk autonomous action;
- human review/safe fallback.

---

# 21. Security / Privacy Baseline

The MVP must:

- Never trust an unsigned/unverified webhook.
- Keep webhook secrets server-side.
- Avoid storing unnecessary payment credentials or secrets.
- Treat customer contact information as protected data.
- Restrict logs to required fields.
- Separate demo/test data from production credentials.
- Avoid including sensitive raw data in LLM prompts unless needed.
- Log why a recovery action was taken without unnecessarily logging private content.

For production, re-verify current Razorpay, RBI, NPCI, TRAI, DLT, and data-protection requirements from official sources before deployment.

---

# 22. Build Order

The implementation agent should work in this order and stop adding polish if an earlier layer is not reliable.

## Phase 1 — Foundation

- Set up normalized entities/models.
- Set up persistence.
- Set up audit event infrastructure.
- Set up configuration for policy thresholds.

## Phase 2 — Ingestion

- Implement Razorpay webhook endpoint.
- Verify signature.
- Add idempotency.
- Normalize events.
- Update payment/subscription state.

## Phase 3 — Recovery core

- Build recovery session ownership.
- Implement diagnosis taxonomy.
- Implement risk score.
- Implement customer recovery profile.

## Phase 4 — Policy engine

- Latest payment check.
- Opt-out check.
- Frequency check.
- Time-window check.
- Retry ceiling.
- Low-confidence block.
- Escalation path.

## Phase 5 — Action executor

- Payment link generation.
- One messaging adapter.
- Action persistence.
- Provider failure handling.

## Phase 6 — Outcome loop

- Detect payment success.
- Close workflow.
- Calculate recovered amount.
- Assign attribution.
- Write audit outcome.

## Phase 7 — Dashboard / experiment

- Seed control and treatment batch.
- Show batch metrics.
- Show per-customer traces.
- Show guardrail events.

## Phase 8 — PTP

- Add transcript/text extraction.
- Add PTP state.
- Add due-date verification/follow-up eligibility.

## Phase 9 — Stress testing

Test at minimum:
- duplicate webhooks;
- delayed payment;
- already-paid-before-message;
- opt-out;
- action-provider failure;
- low-confidence diagnosis;
- retry ceiling;
- PTP fulfilled;
- PTP missed;
- concurrent recovery attempts.

## Phase 10 — Demo hardening

- Pre-seed 3–5 hero customer scenarios.
- Pre-seed a larger batch.
- Make the demo deterministic/repeatable.
- Ensure metrics reconcile.
- Ensure the dashboard can explain every hero action.

---

# 23. Exact Demo Script

The demo must tell one financial story rather than becoming an architecture tour.

## Step 1 — Batch enters

Show a batch of failed opportunities.

Dashboard immediately shows:

```text
₹X at risk
N opportunities
```

## Step 2 — AI triage

Show grouping by:
- diagnosis;
- confidence;
- expected recovery value;
- recommended action.

## Step 3 — Hero A: technical failure

Show:
- technical failure detected;
- agent does not spam customer;
- safe retry/wait path selected;
- workflow eventually resolves or moves to link recovery.

Message to judge: **the agent knows when NOT to contact the customer.**

## Step 4 — Hero B: insufficient funds

Show:
- failed payment;
- revenue-at-risk score;
- payment-link recommendation;
- policy checks pass;
- recovery link sent;
- payment succeeds;
- workflow stops;
- money is attributed.

Message to judge: **closed-loop measurable recovery.**

## Step 5 — Hero C: PTP

Show transcript:

> “I’ll pay Friday.”

Show extraction:

```text
PTP detected
Promised date: Friday
Outreach paused
```

Then simulate missed/fulfilled promise and show the appropriate next state.

Message to judge: **stateful agency, not just chat generation.**

## Step 6 — Guardrail scenario

Show customer who has already paid or explicitly says stop.

System blocks outreach.

Message to judge: **bounded autonomy.**

## Step 7 — Final dashboard

Show:
- recovered revenue;
- incremental recovery vs control;
- direct/assisted/organic split;
- recovery cost/ROI;
- guardrail events;
- audit timeline.

### Target narrative

> “We do not contact everyone when a payment fails. The system first asks what failed, how much is at risk, how likely recovery is, and whether we are allowed to act. It chooses the cheapest appropriate recovery path. When payment succeeds, it stops. When a customer promises a date, it remembers. At the end, we show how much incremental revenue we recovered and why every action was allowed.”

---

# 24. Demo Data Design

Seed realistic cases across the main decision paths.

Recommended synthetic distribution:

| Scenario | Purpose |
|---|---|
| Technical timeout | Demonstrate restraint |
| Insufficient funds | Demonstrate payment-link recovery |
| Auth failure | Demonstrate secure recovery path |
| Subscription pending | Demonstrate bounded retry |
| Checkout abandonment | Demonstrate shared AT_RISK architecture; optional MVP branch |
| Already paid | Demonstrate concurrency/status guard |
| Explicit opt-out | Demonstrate consent guard |
| Unknown failure | Demonstrate low-confidence human review |
| PTP promise | Demonstrate memory/state |
| Action provider failure | Demonstrate safe fallback |

Do not fake a successful financial outcome without a corresponding synthetic/test-mode payment event in the experiment ledger.

---

# 25. Minimum Acceptance Tests

The product is not MVP-complete unless all tests below pass.

| Test | Expected behavior |
|---|---|
| Duplicate webhook | Only one recovery workflow created |
| Payment arrives after failure | Workflow closes; no further contact |
| Customer pays before message | Message blocked by latest-status check |
| Technical failure | No aggressive customer dunning |
| Insufficient funds | Recovery action allowed if policy passes |
| Opt-out | Immediate suppression/state update |
| Retry ceiling reached | No further automated debits |
| Low-confidence diagnosis | High-risk autonomous action blocked |
| PTP detected | Outreach paused until promise date |
| PTP missed | Contextual follow-up becomes eligible |
| Provider action fails | Failure recorded + safe fallback |
| AI unavailable | Deterministic safe path remains operational |
| Two workers race | One recovery owner/action path |
| Organic recovery | Not falsely counted as AI recovery |
| Unknown attribution | Excluded from headline AI ROI |

---

# 26. Definition of Done

The MVP is considered complete when:

- A Razorpay/test event can enter the system.
- Webhook authenticity and idempotency are enforced.
- A failure becomes a normalized recovery opportunity.
- The system produces a diagnosis and revenue-at-risk score.
- AI recommendation is constrained to approved actions.
- Policy checks run before outbound actions.
- A real/test payment-link path can recover a payment.
- Successful payment closes the workflow automatically.
- Recovery attribution is recorded.
- Every action appears in an audit timeline.
- A control-vs-treatment batch produces reconciled metrics.
- At least three hero cases and three guardrail cases are demo-ready.
- The demo can show incremental recovered revenue.
- Future features are labeled as future, not presented as shipped.

---

# 27. Future Design — Preserve the Core, Add Capabilities

The future system should plug new signals/channels into the same recovery engine.

## Checkout recovery

Adds session-intent events that create `AT_RISK` opportunities.

## Voice recovery

Adds a voice executor and PTP extractor.

The researched future pattern is:

```text
Exotel
  ↓
WebSocket audio
  ↓
Pipecat orchestration
  ↓
Sarvam STT / LLM / TTS
  ↓
Recovery Agent
```

This remains optional for the MVP.

## Multilingual recovery

Adds locale-aware policies/models for Hinglish and other Indian-language interactions.

## B2B receivables

Adds invoice/ERP/email connectors and dispute workflows.

Tax/legal conclusions must remain subject to human approval.

## Mandate intelligence

Adds richer recurring-payment state and rail-specific policies.

## Payment-rail routing

Adds approved routing choices to the intervention catalog.

## Learning policy

Use historical outcomes to calibrate:
- recovery probabilities;
- channel preferences;
- timing preferences.

Hard constraints remain deterministic.

## Enterprise integrations

Add adapters for:
- CRM;
- ERP;
- messaging;
- telephony;
- support;
- finance systems.

---

# 28. Architecture Principle for Future Expansion

The core abstraction should remain:

```text
SIGNAL
  ↓
AT_RISK OPPORTUNITY
  ↓
DIAGNOSIS
  ↓
EXPECTED VALUE
  ↓
APPROVED INTERVENTION
  ↓
POLICY GATE
  ↓
EXECUTION
  ↓
OBSERVATION
  ↓
ATTRIBUTION
  ↓
LEARNING / AUDIT
```

New recovery problems should enter through a new signal, not require a new product.

---

# 29. Engineering Guardrails for the Implementation Agent

The agent implementing this PRD must follow these rules:

1. **Build the smallest working end-to-end loop first.**
2. Prefer deterministic logic for known cases; use AI where ambiguity/context matters.
3. Never give an LLM unrestricted API/tool authority.
4. All external actions must pass the policy engine.
5. Re-check payment state immediately before customer outreach.
6. Every action must produce an audit event.
7. Every recovery must map to a recovery session.
8. Never count organic revenue as AI-attributed.
9. Make thresholds/configuration explicit and changeable.
10. Use adapters for provider dependencies.
11. Make demo mode deterministic and seedable.
12. Do not add B2B, voice, or multi-rail complexity until the core payment-recovery loop is stable.
13. Never silently fabricate provider behavior; verify provider-specific event names/fields before wiring live integrations.
14. Keep production compliance claims separate from demo guardrails.
15. Optimize for the buildathon proof: **measured incremental recovery with bounded autonomy.**

---

# 30. Recommended Initial Repository Structure

The exact stack can follow the existing repository. The logical separation should resemble:

```text
app/
├── ingestion/
│   ├── webhooks
│   └── normalization
├── domain/
│   ├── models
│   ├── states
│   └── events
├── recovery/
│   ├── diagnosis
│   ├── risk
│   ├── customer_profile
│   ├── state_machine
│   └── attribution
├── agent/
│   ├── prompts
│   ├── schemas
│   └── reasoning
├── policy/
│   ├── guards
│   ├── thresholds
│   └── escalation
├── actions/
│   ├── payment_links
│   ├── messaging
│   └── adapters
├── observation/
│   └── outcomes
├── audit/
├── experiments/
├── dashboard/
└── tests/
```

Do not interpret this as a mandatory technology choice. It is a logical boundary map.

---

# 31. Judge-Proof Product Positioning

The implementation and UI should reinforce these messages:

### “What makes this AI?”

AI handles:
- ambiguous diagnosis;
- customer context;
- recovery probability;
- intervention selection among approved options;
- personalization;
- PTP extraction.

Rules handle non-negotiable constraints.

### “How do you know you recovered money?”

Intervention metadata + observed payment outcomes + explicit attribution categories.

### “What stops spam?”

Frequency, timing, opt-out, latest-status, retry, and escalation guards override AI behavior.

### “Why not just retry?”

Different failure modes require different recovery postures, and some failures should not trigger customer outreach.

### “What is the headline metric?”

Incremental recovered revenue and lift versus a control/baseline, with net ROI.

### “What happens when AI is wrong?”

Confidence thresholds, safe fallback, human review, and deterministic policy enforcement.

---

# 32. Final Product Success Definition

A judge should be able to watch:

1. a failed payment enter the system;
2. the system determine why it is at risk;
3. the agent explain why recovery is worthwhile;
4. the policy engine decide whether action is permitted;
5. the intervention execute;
6. the payment arrive;
7. the agent stop automatically;
8. the recovery be attributed;
9. the audit trail explain every important step;
10. the dashboard show the incremental rupees recovered across the batch.

That is the MVP.

Everything beyond this is valuable only when it makes this proof stronger.

---

# 33. Source / Design Provenance

This PRD is derived from the supplied **AI Revenue Recovery MVP Build Blueprint**, which in turn was based on the supplied **AI Revenue Recovery Project Research** document.

The blueprint establishes the following as core MVP decisions:

- narrow the product to failed payments + subscription failures;
- use AI for diagnosis/context/recommendation, not money-moving authority;
- enforce deterministic policy before action;
- introduce revenue-at-risk scoring;
- measure incremental recovery using a control/baseline;
- strengthen attribution into direct/assisted/organic/unknown;
- enforce recovery-session concurrency;
- include PTP as a lightweight stateful capability;
- treat voice, B2B receivables, richer checkout recovery, multi-rail routing, and production compliance as future/optional extensions.

The original research provides the conceptual basis for webhook-driven detection, failure taxonomy, payment-link recovery, bounded recurring-payment recovery, PTP tracking, voice architecture, stopping rules, auditability, and batch-level recovery measurement.

---

## Implementation instruction

**Start by inspecting the existing repository and map these requirements onto the current codebase. Do not rebuild infrastructure that already exists. Implement the core path first: webhook → normalized opportunity → diagnosis/risk → AI recommendation → policy gate → payment-link action → payment outcome → attribution → dashboard/audit. Keep all future capabilities behind clear interfaces, but do not make them dependencies of the MVP.**
