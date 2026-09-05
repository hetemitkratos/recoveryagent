# DOMAIN_MODEL.md — AI Revenue Recovery MVP

## 1. Purpose

This document defines the canonical domain model for the AI Revenue Recovery MVP.

It exists to prevent the implementation agent from inventing inconsistent entities, states, relationships, or financial semantics.

The domain model is centered on:

```text
Customer
   ↓
Payment / Subscription
   ↓
Revenue Risk
   ↓
Recovery Session
   ↓
Recovery Actions
   ↓
Outcomes
   ↓
Attribution
   ↓
Audit + Experiment Metrics
```

---

# 2. Core Entities

The MVP contains these primary entities:

```text
Customer
Payment
Subscription
RecoverySession
RecoveryAction
RecoveryOutcome
CommunicationEvent
PromiseToPay
AuditEvent
ExperimentAssignment
```

Supporting concepts:

```text
FailureClassification
RiskAssessment
PolicyDecision
Attribution
```

These may be implemented as tables, embedded records, value objects, or typed application objects depending on the existing stack.

---

# 3. Customer

Represents the payer/customer associated with a payment or subscription.

### Fields

```text
id
external_customer_id
name
email
phone
preferred_channel
lifetime_value
created_at
updated_at
```

### Notes

- `external_customer_id` identifies the customer in the payment provider.
- Do not store unnecessary personal data.
- Customer data should be sufficient for recovery but not excessive.
- Communication preferences must be respected.

---

# 4. Payment

Represents an individual payment attempt.

### Fields

```text
id
customer_id
provider
provider_payment_id
provider_order_id
amount
currency
status
failure_code
failure_description
failure_class
attempt_number
metadata
created_at
updated_at
paid_at
```

### Status

Minimum:

```text
CREATED
AUTHORIZED
CAPTURED
FAILED
REFUNDED
CANCELLED
UNKNOWN
```

The implementation may map provider-specific states into this canonical model.

### Invariant

The latest trusted payment state is authoritative for recovery decisions.

---

# 5. Subscription

Represents a recurring billing relationship.

### Fields

```text
id
customer_id
provider
provider_subscription_id
plan_id
amount
currency
status
next_charge_at
failed_attempts
max_attempts
created_at
updated_at
```

### Status

```text
ACTIVE
PENDING
PAST_DUE
HALTED
CANCELLED
COMPLETED
UNKNOWN
```

Subscription recovery must reuse the same recovery engine rather than creating an unrelated system.

---

# 6. RecoverySession

The central domain entity.

A RecoverySession represents one attempt to recover a specific revenue opportunity.

### Fields

```text
id
customer_id
payment_id
subscription_id
state
risk_score
recovery_probability
expected_recoverable_revenue
diagnosis
diagnosis_confidence
current_owner
attempt_count
communication_count
last_action_at
next_action_at
created_at
updated_at
closed_at
closure_reason
```

### Relationship

A recovery session must reference either:

```text
payment_id
```

or:

```text
subscription_id
```

depending on the recovery scenario.

### Active-session invariant

For the same customer/payment pair:

```text
maximum one active RecoverySession
```

Recommended database constraint:

```text
UNIQUE(customer_id, payment_id)
```

for active sessions.

---

# 7. Recovery States

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

## State meanings

### AT_RISK

Revenue has been identified as potentially recoverable.

### DIAGNOSING

The system is determining why the payment failed and what recovery path is appropriate.

### SAFE_RETRY

A technically safe retry is being attempted or scheduled.

### OUTREACH

An approved customer-facing recovery intervention is active.

### PAYMENT_PENDING

A recovery action has been taken and payment outcome is being observed.

### PTP_WAIT

The customer has made a promise to pay and automated recovery is waiting for the promised date.

### RECOVERED

The revenue objective has been successfully recovered.

### ESCALATED

The workflow requires an escalation path outside normal autonomous recovery.

### STOPPED

No further automated action is allowed or necessary.

### HUMAN_REVIEW

The workflow requires a human decision.

---

# 8. State Transition Rules

Canonical transitions:

```text
AT_RISK
    → DIAGNOSING

DIAGNOSING
    → SAFE_RETRY
    → OUTREACH
    → PTP_WAIT
    → HUMAN_REVIEW

SAFE_RETRY
    → PAYMENT_PENDING
    → OUTREACH
    → ESCALATED
    → STOPPED

OUTREACH
    → PAYMENT_PENDING
    → PTP_WAIT
    → ESCALATED
    → STOPPED

PAYMENT_PENDING
    → RECOVERED
    → OUTREACH
    → ESCALATED
    → STOPPED

PTP_WAIT
    → RECOVERED
    → OUTREACH
    → ESCALATED
    → STOPPED

HUMAN_REVIEW
    → OUTREACH
    → SAFE_RETRY
    → ESCALATED
    → STOPPED

ESCALATED
    → HUMAN_REVIEW
    → RECOVERED
    → STOPPED
```

Terminal states:

```text
RECOVERED
STOPPED
```

Do not permit arbitrary state mutation.

---

# 9. Global State Overrides

These rules override normal AI recommendations.

```text
PAYMENT_STATUS == PAID/CAPTURED
    → RECOVERED or STOPPED
    → no customer outreach

CUSTOMER_OPTED_OUT
    → STOPPED
    → no further customer communication

RETRY_LIMIT_REACHED
    → STOPPED or ESCALATED

LOW_CONFIDENCE + HIGH_RISK_ACTION
    → HUMAN_REVIEW

UNSUPPORTED_FAILURE
    → HUMAN_REVIEW or safe fallback

PROHIBITED_ACTION
    → STOPPED / BLOCKED
```

The implementation must check these conditions before executing customer-facing or financial actions.

---

# 10. Failure Classification

Canonical failure classes:

```text
TECHNICAL
BUSINESS
AUTHENTICATION
ABANDONMENT
UNKNOWN
```

### Technical

Examples:

```text
timeout
temporary processor issue
bank/infrastructure degradation
```

Typical recovery:

```text
WAIT
SAFE_RETRY
```

### Business

Examples:

```text
insufficient funds
payment-method issue
```

Typical recovery:

```text
PAYMENT_LINK
MESSAGE
```

### Authentication

Typical recovery:

```text
PAYMENT_LINK
CUSTOMER_ACTION
```

### Abandonment

Typical recovery:

```text
TIMED_OUTREACH
PAYMENT_LINK
```

### Unknown

Typical recovery:

```text
HUMAN_REVIEW
SAFE_FALLBACK
```

---

# 11. RiskAssessment

A risk assessment captures why a recovery opportunity matters.

### Fields

```text
risk_score
recovery_probability
incremental_probability
expected_recoverable_revenue
risk_factors
model_version
calculated_at
```

### Formula

Reference:

```text
Expected Recoverable Revenue
=
Amount at Risk
× P(Recovery)
× P(Incremental)
```

The values are estimates.

They must not be represented as guaranteed revenue.

---

# 12. RecoveryAction

Represents an attempted recovery intervention.

### Fields

```text
id
recovery_session_id
action_type
reason
source
ai_recommendation_id
policy_decision_id
status
provider
provider_reference
payload
scheduled_at
executed_at
completed_at
failure_reason
created_at
```

### Action types

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

### Status

```text
PROPOSED
PENDING_POLICY
BLOCKED
SCHEDULED
EXECUTING
EXECUTED
SUCCEEDED
FAILED
CANCELLED
```

An action must never move directly from AI recommendation to `EXECUTED` without policy evaluation.

---

# 13. PolicyDecision

Represents the deterministic authorization result.

### Fields

```text
id
recovery_session_id
action_id
decision
rules_evaluated
blocking_reasons
created_at
```

### Decision

```text
ALLOW
BLOCK
HUMAN_REVIEW
```

Example:

```json
{
  "decision": "BLOCK",
  "rules_evaluated": [
    "RULE-001"
  ],
  "blocking_reasons": [
    "PAYMENT_ALREADY_PAID"
  ]
}
```

---

# 14. RecoveryOutcome

Represents what actually happened after an action.

### Fields

```text
id
recovery_session_id
action_id
result
payment_id
amount_recovered
currency
payment_reference
attribution
observed_at
```

### Result

```text
PAYMENT_RECOVERED
NO_RECOVERY
CUSTOMER_DECLINED
CUSTOMER_OPTED_OUT
PROMISE_TO_PAY
ACTION_FAILED
UNKNOWN
```

Outcome must be based on observed application/provider state, not on AI assumptions.

---

# 15. Attribution

Attribution is a domain concept, not merely a dashboard label.

Canonical values:

```text
DIRECT
ASSISTED
ORGANIC
UNKNOWN
```

## DIRECT

The customer paid through the recovery path generated/executed by the system.

Examples:

```text
AI-generated payment link
→ customer pays
```

## ASSISTED

The system delivered a qualifying intervention and sufficient evidence connects that intervention to the later payment, even if payment occurred through another route.

## ORGANIC

Payment happened without a qualifying recovery intervention.

## UNKNOWN

Evidence is insufficient.

### Rule

Do not classify a payment as AI-attributed merely because:

```text
customer was contacted
AND
customer later paid
```

There must be an attribution basis.

---

# 16. CommunicationEvent

Represents a customer-facing communication.

### Fields

```text
id
recovery_session_id
customer_id
channel
template_id
message
provider
provider_reference
status
sent_at
delivered_at
opened_at
responded_at
created_at
```

### Channels

MVP:

```text
SIMULATED
EMAIL
SMS
```

Future:

```text
VOICE
WHATSAPP
```

Communication should be represented separately from recovery actions because a recovery action can potentially result in multiple provider-level communication events.

---

# 17. PromiseToPay

Represents a customer's commitment to pay later.

### Fields

```text
id
recovery_session_id
customer_id
promised_date
source
source_text
confidence
status
created_at
updated_at
fulfilled_at
```

### Status

```text
ACTIVE
FULFILLED
MISSED
CANCELLED
AMBIGUOUS
```

### Rule

A valid PTP moves the recovery workflow into:

```text
PTP_WAIT
```

Do not repeatedly contact a customer during the valid waiting period unless an explicitly approved policy requires it.

---

# 18. AuditEvent

Represents an immutable/audit-oriented record of a meaningful system event.

### Fields

```text
id
event_type
recovery_session_id
customer_id
payment_id
source_event_id
actor
payload
timestamp
previous_hash
hash
```

### Event examples

```text
WEBHOOK_RECEIVED
WEBHOOK_REJECTED
PAYMENT_FAILED
RISK_CALCULATED
DIAGNOSIS_CREATED
AI_RECOMMENDATION_CREATED
POLICY_EVALUATED
ACTION_BLOCKED
ACTION_EXECUTED
PAYMENT_OBSERVED
PTP_CREATED
OUTREACH_SENT
ATTRIBUTION_CALCULATED
RECOVERY_COMPLETED
RECOVERY_STOPPED
HUMAN_ESCALATION
```

Audit records should be append-oriented.

The MVP may use hash chaining/tamper evidence rather than a production WORM implementation.

---

# 19. ExperimentAssignment

Represents control/treatment assignment for measuring incremental recovery.

### Fields

```text
id
experiment_id
customer_id
payment_id
variant
assigned_at
```

### Variants

```text
CONTROL
TREATMENT
```

Assignment should be deterministic/reproducible for the demo.

A control customer must not accidentally receive treatment actions.

---

# 20. Experiment

Represents a batch recovery experiment.

### Fields

```text
id
name
description
status
seed
control_count
treatment_count
started_at
completed_at
```

### Metrics

```text
control_at_risk
treatment_at_risk
control_recovered
treatment_recovered
control_recovery_rate
treatment_recovery_rate
incremental_recovery_rate
incremental_recovered_revenue
recovery_cost
net_recovery
roi
```

Primary business metric:

```text
Incremental Recovered Revenue
```

---

# 21. Revenue Semantics

The system must distinguish:

```text
Amount at Risk
Recovered Revenue
Incremental Recovered Revenue
AI-attributed Revenue
Recovery Cost
Net Recovery
```

## Amount at Risk

Revenue that would otherwise be at risk because the payment failed/was abandoned/overdue.

## Recovered Revenue

Revenue successfully collected after entering a recovery workflow.

## Incremental Recovered Revenue

Estimated additional revenue attributable to treatment compared with baseline/control behavior.

## AI-attributed Revenue

Recovered revenue classified as DIRECT or qualifying ASSISTED.

## Recovery Cost

Costs associated with recovery actions.

For the MVP this may be simulated/configured.

## Net Recovery

```text
Recovered Revenue - Recovery Cost
```

Do not equate all recovered revenue with incremental revenue.

---

# 22. Relationship Model

Conceptual relationship:

```text
Customer
   │
   ├───────────────┐
   │               │
   ▼               ▼
Payment       Subscription
   │               │
   └───────┬───────┘
           ▼
    RecoverySession
           │
    ┌──────┼─────────┬───────────────┐
    ▼      ▼         ▼               ▼
  Risk   Actions  Communications   PTP
           │
           ▼
        Outcome
           │
           ▼
      Attribution
           │
           ▼
         Audit
```

Experiment assignment may reference:

```text
Customer
Payment
RecoverySession
```

---

# 23. Entity Ownership

Recommended ownership boundaries:

```text
Customer
    → customer identity/preferences

Payment
    → payment lifecycle

Subscription
    → recurring billing lifecycle

RecoverySession
    → recovery lifecycle

RecoveryAction
    → intervention execution

PolicyDecision
    → action authorization

RecoveryOutcome
    → observed result

CommunicationEvent
    → provider communication lifecycle

PromiseToPay
    → payment commitment lifecycle

AuditEvent
    → historical system trace

ExperimentAssignment
    → experimental control/treatment state
```

Avoid putting recovery behavior directly into the `Payment` entity.

---

# 24. Database Invariants

The database/application must enforce:

### Invariant 1 — Unique active recovery

```text
one active recovery session
per customer + payment
```

### Invariant 2 — No duplicate webhook effects

```text
one source_event_id
→ one business processing outcome
```

### Invariant 3 — Recovered is terminal

Once:

```text
state = RECOVERED
```

the system must not execute additional recovery actions.

### Invariant 4 — Stopped is terminal

Unless explicitly reopened through an authorized human workflow, `STOPPED` cannot automatically return to active recovery.

### Invariant 5 — Actions require policy

Every executable action must have a corresponding policy decision.

### Invariant 6 — Outcome requires evidence

A recovery outcome must reference an observed event/payment/result.

### Invariant 7 — Attribution requires evidence

Attribution must be based on persisted recovery/payment/intervention evidence.

---

# 25. Temporal Rules

The system should use server-side timestamps.

Important timestamps:

```text
event_received_at
event_occurred_at
recovery_created_at
action_scheduled_at
action_executed_at
payment_paid_at
outcome_observed_at
session_closed_at
```

Do not infer payment causality solely from timestamp proximity.

For PTP:

```text
promised_date
```

must be represented separately from the timestamp at which the promise was recorded.

---

# 26. Idempotency Model

Use provider event identifiers and action/provider references.

Example:

```text
source_event_id
```

prevents duplicate webhook processing.

For recovery actions:

```text
recovery_session_id
+
action_type
+
idempotency_key
```

should prevent duplicate external execution where possible.

A retry after a network timeout must not blindly create a second payment link or send a second customer message.

---

# 27. Concurrency Model

Potential race:

```text
Worker A:
reads UNPAID

Worker B:
reads UNPAID

Customer:
pays

Worker A:
sends message

Worker B:
creates payment link
```

Protection:

```text
latest payment-state check
+
recovery ownership
+
idempotent action execution
+
database transaction/locking where appropriate
```

The payment provider's latest state is authoritative.

---

# 28. AI Data Model

AI output should be stored separately from the final domain decision where practical.

Recommended conceptual structure:

```text
AIRecommendation
    ↓
PolicyDecision
    ↓
RecoveryAction
```

AI recommendation:

```text
diagnosis
confidence
recovery_probability
recommended_action
reason_codes
message
model_version
created_at
```

Policy decision:

```text
allow/block/human_review
rules
reasons
created_at
```

This distinction makes the audit trail clear.

---

# 29. Demo Data Requirements

Seed data should contain multiple failure archetypes.

Minimum:

```text
technical failures
business failures
authentication failures
unknown failures
already-paid races
opt-outs
PTP customers
successful recoveries
unsuccessful recoveries
control customers
treatment customers
```

The data should include different amounts so prioritization is visible.

Example conceptual distribution:

```text
₹500
₹1,200
₹2,500
₹7,500
₹15,000
₹50,000
```

Do not hardcode the final demo metrics into the UI.

---

# 30. Hero Scenario Data

The seeded dataset must support these demonstrations.

## Scenario A — Technical degradation

```text
Payment FAILED
failure_class = TECHNICAL
```

Expected:

```text
safe retry/wait
```

Not aggressive dunning.

## Scenario B — Insufficient funds

```text
Payment FAILED
failure_class = BUSINESS
```

Expected:

```text
payment link
→ payment success
→ RECOVERED
→ DIRECT
```

## Scenario C — PTP

Input:

```text
"I'll pay on Friday."
```

Expected:

```text
PromiseToPay
→ PTP_WAIT
→ payment verification
```

## Scenario D — Already paid

Expected:

```text
latest state = PAID
→ action BLOCKED
→ no outreach
```

## Scenario E — Opt-out

Expected:

```text
opt-out
→ communication suppression
→ STOPPED
```

---

# 31. Future Domain Extensions

The model should support future features without changing the core recovery abstraction.

Potential future entities:

```text
CheckoutSession
Invoice
Mandate
VoiceCall
ERPInvoice
CollectionCase
PaymentRail
RecoveryPolicy
```

They should connect into:

```text
Risk
→ RecoverySession
→ Action
→ Outcome
→ Attribution
→ Audit
```

Do not add these entities to the MVP unless required by implementation.

---

# 32. Domain Events

Canonical internal events:

```text
PaymentFailed
PaymentSucceeded
SubscriptionPaymentFailed
RecoveryCreated
DiagnosisCompleted
RiskCalculated
AIRecommendationCreated
PolicyEvaluated
RecoveryActionExecuted
PaymentLinkCreated
PaymentObserved
CommunicationSent
CustomerOptedOut
PromiseToPayCreated
PromiseToPayMissed
RecoveryCompleted
RecoveryStopped
RecoveryEscalated
```

Domain events should be meaningful business events, not arbitrary database CRUD notifications.

---

# 33. Recommended Implementation Pattern

Use:

```text
Routes / Controllers
        ↓
Application Services
        ↓
Domain Services
        ↓
Repositories
        ↓
Database / External Providers
```

Keep these concerns separate:

```text
Domain
    state + invariants + business concepts

Application
    orchestration

Infrastructure
    Razorpay / database / notification provider / LLM

Presentation
    API / frontend
```

Do not put provider-specific logic into domain entities.

---

# 34. Definition of Done

The domain model is correctly implemented when:

- [ ] Core entities exist.
- [ ] Relationships are represented.
- [ ] Payment state is canonical.
- [ ] Recovery state machine is enforced.
- [ ] Failure classes are normalized.
- [ ] Risk assessment is persisted.
- [ ] AI recommendation is separate from policy.
- [ ] Policy decisions are persisted.
- [ ] Actions require policy approval.
- [ ] Outcomes are evidence-based.
- [ ] Attribution is explicit.
- [ ] PTP is stateful.
- [ ] Audit events are append-oriented.
- [ ] Experiment assignment is deterministic.
- [ ] Duplicate recovery sessions are prevented.
- [ ] Duplicate webhook effects are prevented.
- [ ] Recovered workflows cannot continue automatically.
- [ ] Already-paid races are handled.
- [ ] Demo data supports all hero cases.
- [ ] Future capabilities can plug into the same recovery abstraction.

---

# 35. Final Domain Principle

The most important relationship in the system is:

```text
Payment/Revenue Event
        ↓
Recovery Opportunity
        ↓
Recovery Session
        ↓
Approved Action
        ↓
Observed Outcome
        ↓
Conservative Attribution
```

Never confuse:

```text
AI recommendation
```

with:

```text
authorized action
```

or:

```text
action executed
```

with:

```text
money recovered
```

or:

```text
money recovered
```

with:

```text
incremental money recovered
```

Those distinctions are fundamental to the correctness of the product.
