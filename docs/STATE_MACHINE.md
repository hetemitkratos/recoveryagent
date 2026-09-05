# STATE_MACHINE.md — AI Revenue Recovery MVP

## 1. Purpose

This document is the behavioral specification for the AI Revenue Recovery state machine.

The state machine controls the lifecycle of a revenue recovery opportunity from detection through recovery, stopping, or escalation.

The central rule is:

```text
Events trigger transitions.
Guards determine whether transitions are allowed.
Policies determine which actions are permitted.
Observed payment outcomes determine recovery.
```

AI recommendations never directly mutate the recovery state.

---

# 2. State Machine Overview

```text
                         ┌───────────────┐
                         │   AT_RISK     │
                         └───────┬───────┘
                                 │
                                 ▼
                         ┌───────────────┐
                         │  DIAGNOSING   │
                         └───────┬───────┘
                                 │
                ┌────────────────┼─────────────────┐
                │                │                 │
                ▼                ▼                 ▼
        ┌─────────────┐   ┌─────────────┐  ┌──────────────┐
        │ SAFE_RETRY  │   │  OUTREACH   │  │ HUMAN_REVIEW │
        └──────┬──────┘   └──────┬──────┘  └──────┬───────┘
               │                 │                 │
               ▼                 ▼                 ▼
        ┌─────────────────────────────────────────────────┐
        │              PAYMENT_PENDING                    │
        └──────────────────────┬──────────────────────────┘
                               │
                  ┌────────────┼─────────────┐
                  │            │             │
                  ▼            ▼             ▼
             RECOVERED     OUTREACH       ESCALATED
                  │                          │
                  ▼                          ▼
               [END]                    HUMAN_REVIEW

OUTREACH ──────────────→ PTP_WAIT
   │                         │
   └─────────────────────────┼──────────────┐
                             │              │
                             ▼              ▼
                         RECOVERED       OUTREACH
                             │
                             ▼
                           [END]

Any active state ──→ STOPPED
                          │
                          ▼
                        [END]
```

Terminal states:

```text
RECOVERED
STOPPED
```

---

# 3. State Definitions

## 3.1 AT_RISK

### Meaning

A payment/revenue opportunity has been detected as potentially recoverable.

### Entry triggers

```text
PAYMENT_FAILED
CHECKOUT_ABANDONED
SUBSCRIPTION_FAILURE
OVERDUE_DETECTED
```

For the MVP, the primary trigger is:

```text
PAYMENT_FAILED
```

### Allowed transitions

```text
AT_RISK → DIAGNOSING
AT_RISK → STOPPED
```

### Stop condition

If the latest payment state is already successful:

```text
AT_RISK → RECOVERED
```

or close the opportunity without creating an active recovery workflow.

---

# 4. DIAGNOSING

### Meaning

The system is determining:

```text
why the revenue is at risk
how likely recovery is
what intervention could help
whether intervention is allowed
```

### Processing

```text
Payment context
      ↓
Failure classification
      ↓
Risk assessment
      ↓
AI recommendation
      ↓
Policy evaluation
```

### AI responsibilities

AI may:

- interpret ambiguous failure context
- classify failure
- estimate recovery probability
- recommend an allowed action
- draft customer messaging

AI may NOT:

- authorize itself
- bypass policy
- directly call payment APIs
- directly change recovery state

### Allowed transitions

```text
DIAGNOSING → SAFE_RETRY
DIAGNOSING → OUTREACH
DIAGNOSING → PTP_WAIT
DIAGNOSING → HUMAN_REVIEW
DIAGNOSING → STOPPED
DIAGNOSING → RECOVERED
```

---

# 5. SAFE_RETRY

### Meaning

The system has determined that retrying the payment is technically/business-policy safe.

Typical example:

```text
technical degradation
temporary processor failure
transient issue
```

### Entry guard

All must be true:

```text
payment still unpaid
retry count < maximum
retry is allowed for failure class
retry is allowed by policy
no customer opt-out
recovery session is active
```

### Before execution

Always perform:

```text
latest payment state check
```

If paid:

```text
SAFE_RETRY → RECOVERED
```

and do not retry.

### Success

If payment succeeds:

```text
SAFE_RETRY
    → PAYMENT_PENDING
    → RECOVERED
```

### Failure

If retry fails:

```text
SAFE_RETRY → OUTREACH
```

or:

```text
SAFE_RETRY → ESCALATED
```

depending on policy.

### Retry limit

Once the maximum retry count is reached:

```text
SAFE_RETRY → STOPPED
```

or:

```text
SAFE_RETRY → ESCALATED
```

Never continuously retry.

---

# 6. OUTREACH

### Meaning

The system is performing an approved customer-facing recovery intervention.

Possible MVP actions:

```text
payment link
simulated message
email
```

Future:

```text
voice
WhatsApp
```

### Entry guard

All must be true:

```text
payment unpaid
communication permitted
customer not opted out
communication count < limit
policy allows outreach
```

### Before sending

Run:

```text
latest payment-state check
```

If paid:

```text
OUTREACH → RECOVERED
```

No communication is sent.

### Successful intervention

```text
OUTREACH → PAYMENT_PENDING
```

### Customer promises to pay

```text
OUTREACH → PTP_WAIT
```

### Customer opts out

```text
OUTREACH → STOPPED
```

### Maximum communication count

```text
OUTREACH → STOPPED
```

or:

```text
OUTREACH → ESCALATED
```

No unlimited dunning.

---

# 7. PAYMENT_PENDING

### Meaning

A recovery action has been executed and the system is waiting for/observing payment confirmation.

Examples:

```text
payment link created
payment retry initiated
customer instructed to complete payment
```

### Important rule

`PAYMENT_PENDING` does not mean revenue was recovered.

Only an observed successful payment can produce:

```text
RECOVERED
```

### Payment success

```text
PAYMENT_PENDING → RECOVERED
```

### Payment still unpaid

Policy may allow:

```text
PAYMENT_PENDING → OUTREACH
PAYMENT_PENDING → ESCALATED
PAYMENT_PENDING → STOPPED
```

### Timeout

If no payment occurs within the configured observation window:

```text
PAYMENT_PENDING → OUTREACH
```

or:

```text
PAYMENT_PENDING → STOPPED
```

according to policy.

---

# 8. PTP_WAIT

### Meaning

The customer has made a valid promise to pay on a specified date.

Example:

```text
Customer:
"I'll pay on Friday."

System:
PromiseToPay(promised_date = Friday)
```

### Entry requirements

```text
promise extracted
promise confidence above threshold
promised date is unambiguous
policy accepts PTP
```

If ambiguous:

```text
→ HUMAN_REVIEW
```

### During PTP_WAIT

Do not repeatedly chase the customer.

The system waits until:

```text
promised_date
```

or an external payment event arrives.

### Payment before promised date

```text
PTP_WAIT → RECOVERED
```

### Payment on promised date

```text
PTP_WAIT → RECOVERED
```

### Promise missed

```text
PTP_WAIT → OUTREACH
```

or:

```text
PTP_WAIT → ESCALATED
```

according to policy.

### Customer cancels promise

```text
PTP_WAIT → OUTREACH
```

or:

```text
PTP_WAIT → STOPPED
```

---

# 9. HUMAN_REVIEW

### Meaning

The system has determined that autonomous recovery is inappropriate or insufficient.

Examples:

```text
unknown failure
low-confidence diagnosis
legal/compliance ambiguity
high-risk action
unusual customer situation
policy conflict
```

### Human decisions

A human may approve:

```text
SAFE_RETRY
OUTREACH
ESCALATE
STOP
```

### Important rule

Human approval does not bypass system safety.

The final action still passes through applicable execution guards.

---

# 10. ESCALATED

### Meaning

The recovery opportunity requires an escalation path.

Examples:

```text
retry exhausted
high-value unresolved account
legal/compliance issue
repeated unsuccessful recovery
```

Possible future integrations:

```text
sales team
collections team
finance team
support
account manager
```

### Allowed transitions

```text
ESCALATED → HUMAN_REVIEW
ESCALATED → RECOVERED
ESCALATED → STOPPED
```

No autonomous escalation loop.

---

# 11. RECOVERED

### Meaning

The system has observed successful payment and determined that the recovery opportunity is closed.

### Entry requirement

A trusted payment outcome must confirm:

```text
payment status = successful
```

### On entry

The system must:

1. record payment outcome
2. calculate attribution
3. calculate recovered amount
4. close recovery session
5. write audit event
6. prevent further automated recovery

### Terminal

```text
RECOVERED → no automatic transitions
```

---

# 12. STOPPED

### Meaning

The recovery workflow is intentionally closed without further autonomous action.

Reasons may include:

```text
customer opted out
retry limit reached
communication limit reached
policy block
insufficient recovery value
customer unavailable
unsupported case
manual decision
```

### Terminal

```text
STOPPED → no automatic transitions
```

Reopening should require an explicit authorized action.

---

# 13. Global Guards

These guards apply to every transition that can cause external/customer-facing activity.

## Guard 1 — Payment state

```text
latest payment state must be checked
```

If successful:

```text
stop recovery
```

## Guard 2 — Opt-out

```text
customer opted out
→ no outreach
```

## Guard 3 — Retry limit

```text
retry_count >= max_retry_count
→ no retry
```

## Guard 4 — Communication limit

```text
communication_count >= max_communication_count
→ no outreach
```

## Guard 5 — Policy authorization

```text
action requires POLICY = ALLOW
```

unless it is an internal state transition that requires no external side effect.

## Guard 6 — Confidence

```text
low confidence
+
high-risk action
→ HUMAN_REVIEW
```

## Guard 7 — Recovery ownership

Only the active recovery owner may execute a recovery action.

---

# 14. Action Decision Flow

Every autonomous action should follow:

```text
Trigger
  ↓
Load recovery session
  ↓
Check latest payment state
  ↓
Check customer constraints
  ↓
Calculate/refresh risk
  ↓
Diagnosis
  ↓
AI recommendation
  ↓
Policy engine
  ↓
ALLOW / BLOCK / HUMAN_REVIEW
  ↓
If ALLOW:
    execute action
  ↓
persist action result
  ↓
observe payment/outcome
  ↓
transition state
```

Never:

```text
Trigger
  ↓
LLM
  ↓
execute
```

---

# 15. Event-to-Transition Table

| Event | Current State | Guard | Next State |
|---|---|---|---|
| payment_failed | none | valid event | AT_RISK |
| diagnosis_started | AT_RISK | active | DIAGNOSING |
| technical_failure | DIAGNOSING | retry allowed | SAFE_RETRY |
| business_failure | DIAGNOSING | outreach allowed | OUTREACH |
| payment_success | any active | trusted payment event | RECOVERED |
| retry_started | SAFE_RETRY | policy allow | PAYMENT_PENDING |
| retry_failed | SAFE_RETRY | attempts remain | OUTREACH / ESCALATED |
| payment_link_created | OUTREACH | policy allow | PAYMENT_PENDING |
| customer_ptp | OUTREACH | valid promise | PTP_WAIT |
| customer_opted_out | OUTREACH | valid opt-out | STOPPED |
| payment_timeout | PAYMENT_PENDING | follow-up allowed | OUTREACH / STOPPED |
| ptp_due | PTP_WAIT | payment absent | OUTREACH / ESCALATED |
| ptp_paid | PTP_WAIT | trusted payment | RECOVERED |
| low_confidence | DIAGNOSING | risk requires review | HUMAN_REVIEW |
| human_approved | HUMAN_REVIEW | action permitted | selected active state |
| retry_limit_reached | SAFE_RETRY | limit reached | STOPPED / ESCALATED |
| communication_limit_reached | OUTREACH | limit reached | STOPPED / ESCALATED |
| manual_stop | any active | authorized | STOPPED |

---

# 16. Race Conditions

## Race A — Payment arrives before outreach

```text
Agent reads:
UNPAID

Customer pays

Agent attempts:
OUTREACH
```

Required behavior:

```text
re-check payment
→ PAID
→ RECOVERED
→ do not outreach
```

---

## Race B — Duplicate webhook

```text
PAYMENT_FAILED event
received twice
```

Required behavior:

```text
first event → process
second event → idempotent acknowledgement
```

Do not create two recovery sessions.

---

## Race C — Two workers recover same payment

```text
Worker A → recovery
Worker B → recovery
```

Required behavior:

```text
database/application ownership
→ one active recovery
→ duplicate worker exits safely
```

---

## Race D — Payment arrives while action is executing

If external execution is already in progress:

1. do not create another recovery action
2. reconcile provider state
3. record observed payment
4. close recovery
5. prevent subsequent actions

---

# 17. Idempotent Action Execution

Each externally visible action needs an idempotency key.

Conceptually:

```text
recovery_session_id
+
action_type
+
attempt_number
```

Before execution:

```text
if action already succeeded:
    return existing result

if action is already executing:
    do not duplicate

otherwise:
    execute
```

This is especially important for:

```text
payment links
messages
emails
retries
```

---

# 18. Retry Policy

Retries are bounded.

Each retry requires:

```text
eligible failure
+
attempt count below maximum
+
policy approval
+
payment still unpaid
```

Suggested conceptual policy:

```text
Attempt 0:
initial failure

Attempt 1:
safe retry where applicable

Attempt 2:
safe retry where applicable

After limit:
STOP / ESCALATE
```

Exact limits should be configuration, not hardcoded throughout the codebase.

---

# 19. Communication Policy

Communication must be bounded.

Configuration should include:

```text
max_messages
minimum_interval
allowed_channels
opt_out_behavior
template
```

Example:

```text
Failure detected
     ↓
approved outreach
     ↓
wait
     ↓
payment?
   /     \
 yes      no
 ↓         ↓
RECOVERED  next approved action
```

Never implement:

```text
while unpaid:
    send message
```

---

# 20. Recovery Completion

A recovery session is complete only when:

### Successful

```text
payment success observed
→ RECOVERED
```

### Intentionally stopped

```text
policy/opt-out/limit/manual stop
→ STOPPED
```

### Escalated

```text
autonomous workflow cannot safely continue
→ ESCALATED
```

The UI must distinguish these outcomes.

---

# 21. Attribution Transition

When:

```text
PAYMENT_SUCCESS
```

is observed:

```text
Recovery Session
      ↓
Attribution Engine
      ↓
DIRECT / ASSISTED / ORGANIC / UNKNOWN
```

Then:

```text
RecoveryOutcome
```

is persisted.

Attribution must happen after observed payment, not before.

---

# 22. Audit Requirements Per Transition

Every meaningful state transition should generate an audit event.

Example:

```json
{
  "event_type": "STATE_TRANSITION",
  "recovery_session_id": "rec_123",
  "from": "DIAGNOSING",
  "to": "OUTREACH",
  "trigger": "BUSINESS_FAILURE",
  "reason": "PAYMENT_LINK_RECOMMENDED",
  "policy_decision": "ALLOW",
  "timestamp": "..."
}
```

Blocked transitions should also be auditable.

Example:

```json
{
  "event_type": "ACTION_BLOCKED",
  "action": "MESSAGE",
  "reason": "PAYMENT_ALREADY_PAID"
}
```

---

# 23. State Machine Pseudocode

Conceptual implementation:

```text
handle(event):

    session = loadRecoverySession(event)

    if event indicates payment success:
        markRecovered(session)
        recordOutcome()
        calculateAttribution()
        audit()
        return

    if customer opted out:
        stop(session, "CUSTOMER_OPTED_OUT")
        audit()
        return

    state = session.state

    transition = transitionFor(state, event)

    if transition does not exist:
        handleInvalidTransition()
        audit()
        return

    if transition.requiresExternalAction:

        payment = getLatestPaymentState()

        if payment.isPaid:
            markRecovered(session)
            audit()
            return

        policy = evaluatePolicy(session, transition.action)

        if policy == BLOCK:
            auditBlockedAction()
            stopOrEscalate()
            return

        if policy == HUMAN_REVIEW:
            moveToHumanReview()
            audit()
            return

    executeTransition()
    persistState()
    audit()
```

---

# 24. What AI Can and Cannot Do

## AI CAN

```text
classify ambiguous failure
estimate recovery probability
recommend an intervention
draft a message
extract PTP date
explain recommendation
```

## AI CANNOT

```text
bypass policy
ignore payment state
increase retry limits
remove opt-out
mark payment as recovered
claim incremental revenue
authorize a prohibited action
continue after terminal state
```

---

# 25. Demo State Machine

The demo should make transitions visually obvious.

Example:

```text
FAILED
  ↓
AT_RISK
  ↓
DIAGNOSING
  ↓
BUSINESS FAILURE
  ↓
AI: PAYMENT_LINK
  ↓
POLICY: ALLOW
  ↓
PAYMENT_LINK
  ↓
PAYMENT_PENDING
  ↓
PAYMENT_SUCCESS
  ↓
RECOVERED
  ↓
DIRECT ATTRIBUTION
```

The UI should show:

```text
WHY?
WHAT DID AI RECOMMEND?
WHAT DID POLICY ALLOW?
WHAT ACTION WAS EXECUTED?
WHAT HAPPENED?
HOW MUCH WAS RECOVERED?
WHY IS IT ATTRIBUTED?
```

---

# 26. Required Demo Failure Cases

The state machine must visibly handle:

### Case 1 — Technical failure

```text
AT_RISK
→ DIAGNOSING
→ SAFE_RETRY
→ PAYMENT_PENDING
→ RECOVERED
```

### Case 2 — Business failure

```text
AT_RISK
→ DIAGNOSING
→ OUTREACH
→ PAYMENT_PENDING
→ RECOVERED
```

### Case 3 — PTP

```text
AT_RISK
→ DIAGNOSING
→ OUTREACH
→ PTP_WAIT
→ RECOVERED
```

### Case 4 — Already paid race

```text
AT_RISK
→ DIAGNOSING
→ payment re-check
→ PAID
→ RECOVERED
```

No outreach.

### Case 5 — Opt-out

```text
OUTREACH
→ CUSTOMER_OPTED_OUT
→ STOPPED
```

### Case 6 — Unknown

```text
AT_RISK
→ DIAGNOSING
→ UNKNOWN / LOW CONFIDENCE
→ HUMAN_REVIEW
```

---

# 27. Configuration

Do not hardcode policy thresholds inside state-transition logic.

Configuration should contain:

```text
MAX_RETRIES
MAX_COMMUNICATIONS
MIN_COMMUNICATION_INTERVAL
AI_CONFIDENCE_THRESHOLD
PTP_CONFIDENCE_THRESHOLD
PAYMENT_OBSERVATION_WINDOW
RECOVERY_VALUE_THRESHOLD
```

The state machine reads configuration but owns the transition semantics.

---

# 28. Testing Requirements

Every transition must have tests.

Minimum test categories:

```text
happy-path transitions
invalid transitions
terminal-state protection
payment race
duplicate webhook
duplicate action
opt-out
retry limit
communication limit
low-confidence AI
policy block
human review
PTP fulfilled
PTP missed
```

Critical invariant tests:

```text
RECOVERED cannot execute another recovery action.

STOPPED cannot automatically resume.

PAID cannot receive recovery outreach.

AI cannot bypass policy.

Duplicate events cannot duplicate financial/customer actions.
```

---

# 29. Implementation Guidance

Recommended implementation structure:

```text
domain/
  recovery/
    states
    events
    transitions
    guards
    policies

application/
  recovery/
    orchestrator
    handlers

infrastructure/
  payment/
  notifications/
  ai/

tests/
  recovery/
    state-machine
    guards
    races
    policies
```

The exact directory structure may follow the repository's existing conventions.

Do not introduce a heavyweight state-machine framework unless the project already uses one or there is a clear benefit.

A small explicit transition table/service is preferable for the MVP.

---

# 30. Final Rule

The recovery state machine exists to guarantee:

```text
No money movement
without authorization.

No customer outreach
without policy approval.

No recovery credit
without observed payment.

No continued automation
after recovery, opt-out, or stop.

No ambiguous high-risk decision
without human review.
```

The state machine is therefore the **control plane of the revenue recovery agent**, while AI is an intelligence layer operating inside it.
