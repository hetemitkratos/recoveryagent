# ARCHITECTURE.md — AI Revenue Recovery MVP

## 1. Purpose

This document defines the technical architecture for the AI Revenue Recovery MVP.

The architecture is intentionally designed around one core loop:

```text
DETECT
  ↓
UNDERSTAND
  ↓
PRIORITIZE
  ↓
DECIDE
  ↓
CHECK POLICY
  ↓
ACT
  ↓
VERIFY
  ↓
STOP / ESCALATE
  ↓
MEASURE
```

The MVP is not a generic AI agent. It is a **bounded revenue recovery system** in which AI provides contextual intelligence and recommendations while deterministic application logic controls financial actions, customer communication, state transitions, and safety.

---

# 2. Architectural Goals

The system must:

1. Detect revenue at risk from payment events.
2. Normalize payment/subscription events into a consistent domain model.
3. Diagnose the likely cause of failure.
4. Estimate the economic value of recovery.
5. Use AI to recommend an approved intervention.
6. Apply deterministic policy before any action.
7. Execute the selected recovery action.
8. Observe the resulting payment state.
9. Attribute recovered revenue conservatively.
10. Record an auditable decision trail.
11. Surface measurable recovery metrics.
12. Support a deterministic demo without depending entirely on live third-party systems.
13. Provide clean extension points for future channels and workflows.

---

# 3. Architectural Principles

## 3.1 Deterministic core, probabilistic intelligence

The financial workflow should remain deterministic.

```text
                 ┌─────────────────┐
                 │       AI        │
                 │ diagnosis       │
                 │ probability     │
                 │ recommendation  │
                 └────────┬────────┘
                          ↓
                 ┌─────────────────┐
                 │ POLICY ENGINE   │
                 │ hard constraints│
                 └────────┬────────┘
                          ↓
                 ┌─────────────────┐
                 │ ACTION EXECUTOR │
                 └─────────────────┘
```

AI must not directly execute arbitrary actions.

---

## 3.2 Provider independence

Razorpay should be behind a provider/integration boundary wherever practical.

The core domain should not depend on raw Razorpay payload structures.

Use:

```text
Razorpay webhook
      ↓
Razorpay adapter
      ↓
Normalized domain event
      ↓
Core recovery engine
```

This makes the architecture extensible to future payment providers without rewriting the recovery engine.

---

## 3.3 Event-driven recovery

Payment changes are treated as events.

Examples:

```text
PAYMENT_FAILED
PAYMENT_PAID
SUBSCRIPTION_PENDING
SUBSCRIPTION_HALTED
PAYMENT_LINK_PAID
CUSTOMER_OPTED_OUT
PTP_CREATED
PTP_MISSED
```

Events should be persisted or otherwise safely tracked before downstream processing where required for reliability.

---

## 3.4 State over scattered flags

Recovery lifecycle is represented by explicit states.

Do not implement core lifecycle logic as combinations such as:

```text
is_failed
is_contacted
is_paid
is_retrying
is_escalated
```

Use an explicit recovery state machine instead.

---

# 4. High-Level System

```text
                         ┌────────────────────┐
                         │      Razorpay      │
                         │ Webhooks / Payment │
                         └─────────┬──────────┘
                                   │
                                   ▼
                         ┌────────────────────┐
                         │ Webhook Gateway    │
                         │ Signature Verify   │
                         │ Idempotency        │
                         └─────────┬──────────┘
                                   │
                                   ▼
                         ┌────────────────────┐
                         │ Event Normalizer   │
                         └─────────┬──────────┘
                                   │
                                   ▼
                    ┌──────────────────────────────┐
                    │      Recovery Orchestrator   │
                    │                              │
                    │ ┌────────────┐ ┌───────────┐│
                    │ │Risk Engine │ │ Diagnosis ││
                    │ └────────────┘ └───────────┘│
                    │         │            │       │
                    │         └──────┬─────┘       │
                    │                ▼             │
                    │        ┌──────────────┐      │
                    │        │  AI Reasoner │      │
                    │        └──────┬───────┘      │
                    │               ▼              │
                    │        ┌──────────────┐      │
                    │        │ Policy Engine│      │
                    │        └──────┬───────┘      │
                    └───────────────┼──────────────┘
                                    │
                                    ▼
                         ┌────────────────────┐
                         │ Action Executor    │
                         │                    │
                         │ Payment Link      │
                         │ Notification      │
                         │ Retry             │
                         │ PTP               │
                         │ Escalation        │
                         └─────────┬──────────┘
                                   │
                                   ▼
                         ┌────────────────────┐
                         │ Outcome Observer  │
                         └─────────┬──────────┘
                                   │
                                   ▼
                         ┌────────────────────┐
                         │ Attribution Engine │
                         └─────────┬──────────┘
                                   │
                    ┌──────────────┴─────────────┐
                    ▼                            ▼
           ┌─────────────────┐          ┌─────────────────┐
           │ Audit/Event Log │          │ Metrics / DB    │
           └─────────────────┘          └────────┬────────┘
                                                 │
                                                 ▼
                                        ┌─────────────────┐
                                        │ Recovery        │
                                        │ Dashboard       │
                                        └─────────────────┘
```

---

# 5. Component Responsibilities

## 5.1 Webhook Gateway

Responsibilities:

- receive Razorpay webhook events
- validate webhook authenticity
- capture event identifier
- reject malformed/unauthorized requests
- pass verified events downstream

It should not contain business recovery logic.

Conceptually:

```text
HTTP request
  ↓
signature verification
  ↓
event ID extraction
  ↓
idempotency check
  ↓
persist/queue event
  ↓
acknowledge
```

---

# 6. Idempotency Layer

Webhook delivery may result in duplicate processing attempts.

Use the provider event identifier as an idempotency key.

Conceptually:

```text
if event_id already processed:
    return successful acknowledgement
else:
    record event_id
    process event
```

Idempotency must protect the business operation, not merely the HTTP endpoint.

For example, two identical webhook deliveries must not result in:

- two recovery sessions
- two payment links
- two outbound messages
- two recovery credits

---

# 7. Event Normalizer

Convert provider-specific payloads into internal events.

Example:

```json
{
  "event_type": "PAYMENT_FAILED",
  "source": "razorpay",
  "source_event_id": "evt_123",
  "payment_id": "pay_123",
  "customer_id": "cus_123",
  "amount": 12000,
  "currency": "INR",
  "failure_code": "insufficient_funds",
  "occurred_at": "..."
}
```

The rest of the system should consume this normalized structure rather than raw provider payloads.

---

# 8. Recovery Orchestrator

The orchestrator coordinates the workflow but should not become a giant business-logic file.

It should invoke specialized components:

```text
RecoveryOrchestrator
    ├── RiskEngine
    ├── DiagnosisEngine
    ├── AIReasoner
    ├── PolicyEngine
    ├── ActionExecutor
    ├── OutcomeObserver
    └── AttributionEngine
```

The orchestrator manages sequence and state.

Each component owns its specific responsibility.

---

# 9. Diagnosis Engine

The diagnosis engine determines the likely failure class.

Minimum classes:

```text
TECHNICAL
BUSINESS
AUTHENTICATION
ABANDONMENT
UNKNOWN
```

It can combine:

- provider failure code
- payment metadata
- recent transaction history
- customer recovery history
- timing
- previous attempts

The deterministic rules should handle known/high-confidence failure classes.

AI can be used when:

- the failure code is ambiguous
- multiple signals conflict
- contextual interpretation is useful

Unknown/low-confidence cases should not trigger aggressive autonomous actions.

---

# 10. Risk Engine

The risk engine calculates the economic importance of a recovery opportunity.

Inputs:

```text
amount
failure type
customer history
previous attempts
time sensitivity
engagement history
```

Outputs:

```text
risk_score
recovery_probability
expected_recoverable_revenue
risk_factors
```

Reference:

```text
Expected Recoverable Revenue
=
Amount at Risk
× P(Recovery)
× P(Incremental)
```

The implementation should keep the calculation explainable.

Example:

```json
{
  "risk_score": 87,
  "recovery_probability": 0.78,
  "expected_recoverable_revenue": 9360,
  "risk_factors": [
    "high_amount",
    "previous_successful_recovery",
    "business_decline"
  ]
}
```

---

# 11. AI Reasoner

The AI reasoner provides contextual intelligence.

### Responsibilities

- contextual failure interpretation
- recovery probability estimation
- intervention recommendation
- message personalization
- PTP extraction
- decision explanation

### Inputs

Provide only relevant context:

```text
payment
failure
customer recovery history
recent interactions
allowed action catalog
policy context
```

### Output

Use a strict schema:

```json
{
  "diagnosis": "BUSINESS",
  "diagnosis_confidence": 0.96,
  "recovery_probability": 0.78,
  "recommended_action": "PAYMENT_LINK",
  "reason_codes": [
    "INSUFFICIENT_FUNDS",
    "HIGH_PRIOR_SUCCESS"
  ],
  "customer_message": "...",
  "requires_human_review": false
}
```

### Hard rule

The AI output is a **recommendation**, never an authorization.

---

# 12. Policy Engine

The policy engine is the most important safety boundary.

Input:

```text
customer state
payment state
recovery state
AI recommendation
attempt history
communication history
consent/opt-out state
timing
```

Output:

```text
ALLOW
BLOCK
HUMAN_REVIEW
```

Example:

```text
AI:
    recommended_action = PAYMENT_LINK

Policy:
    payment status = PAID

Result:
    BLOCK
```

The policy engine must run immediately before execution.

---

# 13. Action Catalog

Actions should be explicit and typed.

Recommended initial catalog:

```text
WAIT
SAFE_RETRY
PAYMENT_LINK
MESSAGE
PTP_WAIT
ESCALATE
HUMAN_REVIEW
STOP
```

Each action should define:

```text
action_type
required_inputs
policy_requirements
executor
success_condition
failure_condition
```

This makes future channels easy to add.

---

# 14. Action Executor

The executor translates an approved action into a concrete operation.

Example:

```text
PAYMENT_LINK
    ↓
PaymentLinkExecutor
    ↓
create provider payment link
    ↓
persist link + recovery_session_id
    ↓
send/return link
```

Provider calls should be isolated behind adapters.

Example:

```text
PaymentProvider
  ├── createPaymentLink()
  ├── getPaymentStatus()
  └── retryPayment()

NotificationProvider
  ├── sendMessage()
  └── sendEmail()
```

The MVP can use a real provider or a deterministic simulator behind the same interface.

---

# 15. Outcome Observer

Recovery does not end when an action executes.

The system must observe what happened afterward.

Examples:

```text
PAYMENT_LINK_SENT
       ↓
PAYMENT_PAID
       ↓
RECOVERY_COMPLETE
```

or:

```text
PAYMENT_LINK_SENT
       ↓
NO_PAYMENT
       ↓
NEXT_POLICY-APPROVED_STEP
```

The outcome observer must update the recovery state and trigger attribution.

---

# 16. Recovery State Machine

Canonical states:

```text
AT_RISK
DIAGNOSING
SAFE_RETRY
OUTREACH
PAYMENT_PENDING
PTP_WAIT
RECOVERED
ESCALATED
STOPPED
HUMAN_REVIEW
```

The state transition layer should be centralized.

Example:

```text
AT_RISK
  → DIAGNOSING
  → OUTREACH
  → PAYMENT_PENDING
  → RECOVERED
```

State transitions should be validated.

Invalid examples:

```text
RECOVERED → OUTREACH
STOPPED → SAFE_RETRY
PAID → PAYMENT_LINK
```

These must be rejected.

---

# 17. Payment-State Guard

Payment status must be checked before any customer-facing action.

This should be a reusable service:

```text
PaymentStateGuard
```

Conceptually:

```text
beforeAction():
    latest_payment = provider.getPaymentStatus()

    if latest_payment == PAID:
        closeRecovery()
        blockAction()
```

This prevents the classic race:

```text
agent decides to send message
        ↓
customer pays organically
        ↓
message still gets sent
```

---

# 18. Concurrency and Recovery Ownership

Only one worker/agent should own an active recovery session.

Recommended uniqueness constraint:

```text
UNIQUE(customer_id, payment_id)
```

for active recovery sessions.

If multiple events/workers race:

```text
Worker A → acquire recovery
Worker B → recovery already owned
Worker B → do not create duplicate workflow
```

This should be enforced at the persistence layer where possible, not only in application memory.

---

# 19. Attribution Engine

The attribution engine decides whether recovered money should count as AI-attributed.

### DIRECT

Payment completed through the recovery link/action.

### ASSISTED

Customer received a qualifying intervention and later paid through another route with sufficient evidence.

### ORGANIC

Payment occurred without qualifying intervention.

### UNKNOWN

Evidence is insufficient.

The attribution engine should use:

- payment identifiers
- recovery session
- intervention ID
- payment-link metadata
- timestamps
- customer identity
- intervention history

Avoid simplistic rules such as:

```text
customer was contacted
AND later paid
→ AI recovered
```

---

# 20. Audit Layer

Audit events should be append-oriented.

Example:

```json
{
  "event_type": "ACTION_ALLOWED",
  "recovery_session_id": "rec_123",
  "selected_action": "PAYMENT_LINK",
  "policy_checks": {
    "payment_unpaid": true,
    "retry_limit_ok": true,
    "communication_allowed": true
  },
  "timestamp": "..."
}
```

Recommended audit sequence:

```text
FAILURE_DETECTED
RISK_CALCULATED
DIAGNOSIS_CREATED
AI_RECOMMENDATION_CREATED
POLICY_EVALUATED
ACTION_EXECUTED
PAYMENT_OBSERVED
ATTRIBUTION_CALCULATED
RECOVERY_CLOSED
```

The audit trail should explain both successful and blocked actions.

---

# 21. Data Model

Minimum entities:

```text
Customer
Payment
Subscription
RecoverySession
RecoveryAction
RecoveryOutcome
AuditEvent
ExperimentAssignment
CommunicationEvent
PromiseToPay
```

### Customer

```text
id
name
email
phone
lifetime_value
preferred_channel
created_at
```

### Payment

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

### RecoverySession

```text
id
customer_id
payment_id
state
risk_score
recovery_probability
expected_recoverable_revenue
current_owner
created_at
updated_at
closed_at
```

### RecoveryAction

```text
id
recovery_session_id
action_type
reason
ai_confidence
policy_status
status
provider_reference
executed_at
```

### RecoveryOutcome

```text
id
recovery_session_id
result
amount_recovered
attribution
payment_reference
timestamp
```

### AuditEvent

```text
id
recovery_session_id
event_type
payload
timestamp
previous_hash
hash
```

### ExperimentAssignment

```text
id
customer_id/payment_id
variant
assigned_at
```

### CommunicationEvent

```text
id
recovery_session_id
channel
template
status
timestamp
```

### PromiseToPay

```text
id
recovery_session_id
promised_date
source_text
confidence
status
```

---

# 22. Storage Strategy

For the MVP, use a relational database or equivalent structured persistent store.

The database should be the source of truth for:

- payment state
- recovery state
- actions
- outcomes
- attribution
- audit events
- experiment assignment

The dashboard should read from application state, not maintain an independent fake metrics store.

---

# 23. API Boundaries

Suggested API groups:

```text
POST /webhooks/razorpay

GET  /api/recovery
GET  /api/recovery/:id

POST /api/recovery/:id/retry
POST /api/recovery/:id/payment-link
POST /api/recovery/:id/outreach
POST /api/recovery/:id/stop

GET  /api/dashboard/summary
GET  /api/dashboard/recovery
GET  /api/dashboard/attribution
GET  /api/dashboard/audit

POST /api/demo/simulate/failure
POST /api/demo/simulate/payment
POST /api/demo/simulate/ptp
POST /api/demo/simulate/optout
POST /api/demo/reset
POST /api/demo/seed
POST /api/demo/experiment
```

Exact route names may adapt to the existing repository conventions.

---

# 24. Frontend Architecture

The frontend should be a thin presentation layer over the recovery APIs.

Recommended views:

```text
Dashboard
Recovery Queue
Recovery Detail
Experiment Results
Audit Timeline
```

### Dashboard

Primary metrics:

```text
Revenue at Risk
Recovered Revenue
Incremental Recovery
Recovery Rate
Net ROI
Active Workflows
```

### Recovery Detail

Show:

```text
customer
payment
failure
risk
diagnosis
AI recommendation
policy decision
action
outcome
attribution
audit trail
```

This page is important for the judge because it demonstrates explainability.

---

# 25. Demo Architecture

External dependencies should be replaceable.

Use adapters:

```text
                 ┌───────────────────┐
                 │ Payment Provider  │
                 └─────────┬─────────┘
                           │
                 ┌─────────▼─────────┐
                 │ Provider Adapter  │
                 └─────────┬─────────┘
                           │
                     Core Engine
                           │
                 ┌─────────▼─────────┐
                 │ Demo Simulator    │
                 └───────────────────┘
```

The simulator must call the same domain services as real events.

Do not create a separate fake path that only changes UI state.

---

# 26. Batch Experiment Architecture

The experiment runner should:

1. Load a deterministic dataset.
2. Assign comparable control/treatment groups.
3. Process treatment opportunities through the recovery engine.
4. Keep control free from the AI recovery intervention.
5. Simulate/observe payment outcomes.
6. Calculate attribution.
7. Calculate incremental recovery.
8. Display results.

Conceptually:

```text
Seed Dataset
     ↓
Experiment Assignment
     ├───────────────┐
     ↓               ↓
CONTROL          TREATMENT
     │               │
organic         recovery engine
baseline            │
     │               │
     └───────┬───────┘
             ↓
       Outcome Analysis
             ↓
      Incremental Revenue
```

---

# 27. PTP Architecture

PTP is a stateful recovery workflow.

Flow:

```text
customer message/transcript
        ↓
PTP extractor
        ↓
structured promise
        ↓
policy validation
        ↓
PTP_WAIT
        ↓
due-date verification
        ↓
PAID → RECOVERED
MISSED → approved follow-up
```

Example structured result:

```json
{
  "promised_date": "2026-09-10",
  "confidence": 0.94,
  "source_text": "I'll pay on Thursday.",
  "status": "ACTIVE"
}
```

Ambiguous promises should not trigger risky autonomous behavior.

---

# 28. Voice Extension Architecture

Voice is future-facing.

It should plug into the same action abstraction:

```text
Recovery Action
      ↓
VOICE_OUTREACH
      ↓
Voice Adapter
      ├── Exotel
      ├── Pipecat
      └── Sarvam
```

The core engine should not know the implementation details of the voice provider.

The voice system should return structured events such as:

```text
CALL_STARTED
CUSTOMER_REACHED
PTP_DETECTED
CUSTOMER_OPTED_OUT
CALL_FAILED
```

Those events feed back into the same recovery state machine.

---

# 29. B2B Extension Architecture

B2B receivables are future-facing.

The future flow is:

```text
Invoice
   ↓
Risk
   ↓
AI analysis
   ↓
Approved collection action
   ↓
ERP/email/payment
   ↓
Outcome
```

Legal/tax-sensitive actions must not be autonomously finalized by the AI.

The agent may draft a proposed calculation/document for human approval rather than independently making legal determinations.

---

# 30. Security Boundaries

Security-critical operations must stay server-side.

```text
Frontend
   ↓
API
   ↓
Policy
   ↓
Provider
```

Never:

```text
Frontend
   ↓
LLM
   ↓
Provider
```

Protect:

- provider secrets
- webhook secrets
- customer data
- payment references
- model prompts/responses
- audit records

---

# 31. Failure and Recovery Strategy

## LLM unavailable

Fallback:

```text
deterministic diagnosis
→ deterministic policy
→ safe action / human review
```

## Payment provider unavailable

Do not retry blindly.

Persist the failure and move to a safe retry/reconciliation path.

## Notification provider unavailable

Record the failed action and use another approved channel only if policy permits.

## Duplicate event

Return idempotent success without repeating business actions.

## Already paid

Immediately stop recovery.

## Unknown failure

Human review or safe fallback.

---

# 32. Observability

At minimum log:

```text
correlation_id
event_id
recovery_session_id
customer_id
payment_id
component
event
status
duration
error
```

Metrics:

```text
webhook processing latency
webhook failures
duplicate events
active recovery sessions
actions executed
actions blocked
payments recovered
recovered revenue
attribution breakdown
LLM failures
policy violations
```

Do not log secrets or unnecessary sensitive information.

---

# 33. Scalability Path

The MVP may begin as a modular application.

The architecture should still allow future extraction of:

```text
Webhook Service
Recovery Service
AI Service
Policy Service
Action Service
Attribution Service
Analytics Service
```

Do not prematurely create microservices.

First make module boundaries clear inside one deployable system.

---

# 34. Demo Reliability Requirements

The demo must not depend on perfect third-party behavior.

Required:

- seeded dataset
- deterministic simulator
- reset function
- reproducible experiment
- visible event progression
- visible audit trail
- clear recovery outcome

The judge should be able to see the system recover from a known failed payment without waiting on unpredictable external systems.

---

# 35. Architectural Definition of Done

Architecture is complete when:

- [ ] Provider events are normalized.
- [ ] Webhooks are authenticated.
- [ ] Events are idempotent.
- [ ] Recovery lifecycle is state-machine driven.
- [ ] Risk and diagnosis are separate concerns.
- [ ] AI recommendation is schema-bound.
- [ ] Policy is a deterministic hard gate.
- [ ] Actions are typed and adapter-based.
- [ ] Payment state is checked before outreach.
- [ ] Recovery ownership prevents duplicates.
- [ ] Outcomes are observed.
- [ ] Attribution is explicit.
- [ ] Audit events explain decisions.
- [ ] Dashboard metrics come from persistent application state.
- [ ] Demo simulator uses the same core engine.
- [ ] Batch experiment measures incremental recovery.
- [ ] Future channels can plug into the action abstraction.
- [ ] AI/provider failure has a safe fallback.

---

# 36. Final Architecture Rule

The architecture should make this statement true:

> **AI decides what is worth considering; deterministic systems decide what is allowed; execution systems perform the action; payment events decide whether recovery actually happened.**

That is the architectural foundation of the MVP.
