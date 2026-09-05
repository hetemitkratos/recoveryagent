# AI_CONTRACT.md — AI Revenue Recovery MVP

## 1. Purpose

This document defines the exact boundary between the AI layer and the deterministic recovery system.

The AI is an intelligence component.

It is NOT:

```text
the payment processor
the policy engine
the state machine
the source of truth
the attribution engine
```

The AI can recommend.

The deterministic application decides whether that recommendation is allowed.

---

# 2. Core Principle

```text
                   ┌──────────────────┐
                   │      PAYMENT     │
                   │     CONTEXT      │
                   └────────┬─────────┘
                            ↓
                   ┌──────────────────┐
                   │       AI         │
                   │ interpretation   │
                   │ recommendation   │
                   └────────┬─────────┘
                            ↓
                   ┌──────────────────┐
                   │ POLICY ENGINE    │
                   │ deterministic    │
                   └────────┬─────────┘
                            ↓
                   ┌──────────────────┐
                   │ ACTION EXECUTOR  │
                   └──────────────────┘
```

Never:

```text
Payment event
→ LLM
→ payment API
```

---

# 3. AI Responsibilities

The MVP may use AI for:

```text
1. Ambiguous failure diagnosis
2. Recovery probability estimation
3. Intervention recommendation
4. Customer message drafting
5. Promise-to-pay extraction
6. Decision explanation
```

AI should not be used where deterministic logic is more reliable.

Known failure codes should preferably map through deterministic rules first.

---

# 4. AI Task 1 — Failure Diagnosis

## Input

```json
{
  "payment": {
    "amount": 12000,
    "currency": "INR",
    "status": "FAILED",
    "attempt_number": 1
  },
  "failure": {
    "code": "insufficient_funds",
    "description": "..."
  },
  "customer_context": {
    "previous_successful_payments": 3,
    "previous_recovery_attempts": 1
  }
}
```

## Output

```json
{
  "failure_class": "BUSINESS",
  "confidence": 0.96,
  "reason_codes": [
    "INSUFFICIENT_FUNDS"
  ]
}
```

Allowed classes:

```text
TECHNICAL
BUSINESS
AUTHENTICATION
ABANDONMENT
UNKNOWN
```

---

# 5. AI Task 2 — Recovery Probability

The AI may estimate:

```text
P(Recovery)
```

Example:

```json
{
  "recovery_probability": 0.78,
  "confidence": 0.86,
  "factors": [
    "high_prior_success",
    "customer_recently_active",
    "business_decline"
  ]
}
```

This is an estimate, not a financial guarantee.

The system should preserve the model version used.

---

# 6. AI Task 3 — Intervention Recommendation

The AI may select from a fixed action vocabulary.

Allowed actions:

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

It must never return arbitrary executable instructions.

Good:

```json
{
  "recommended_action": "PAYMENT_LINK"
}
```

Bad:

```json
{
  "instruction": "Call Razorpay API and retry payment three times."
}
```

---

# 7. Strict AI Output Schema

The AI response should conform to:

```json
{
  "diagnosis": {
    "failure_class": "BUSINESS",
    "confidence": 0.96,
    "reason_codes": [
      "INSUFFICIENT_FUNDS"
    ]
  },

  "recovery": {
    "probability": 0.78,
    "confidence": 0.86
  },

  "recommendation": {
    "action": "PAYMENT_LINK",
    "confidence": 0.94,
    "reason_codes": [
      "ALTERNATE_PAYMENT_PATH"
    ]
  },

  "message": {
    "text": "Your payment could not be completed. You can try again using this secure payment link.",
    "tone": "HELPFUL"
  },

  "requires_human_review": false
}
```

All fields should be schema-validated.

Invalid output:

```text
→ reject
→ retry/fallback
→ do not execute
```

---

# 8. AI Confidence

Confidence values must be normalized:

```text
0.0 → 1.0
```

Suggested interpretation:

```text
>= 0.90
high confidence

0.70–0.89
moderate confidence

< 0.70
low confidence
```

These are configurable.

Confidence must never override hard policy.

Example:

```text
AI confidence = 0.99
payment already paid
```

Result:

```text
BLOCK
```

---

# 9. Deterministic Rules Before AI

Use deterministic classification where the provider signal is already sufficient.

Example:

```text
failure_code = insufficient_funds
→ BUSINESS
```

There is no need for an LLM to reinterpret this.

Use AI where context genuinely adds value:

```text
unknown provider code
ambiguous description
multiple conflicting signals
customer response interpretation
PTP extraction
```

This improves:

```text
cost
latency
reliability
auditability
```

---

# 10. AI Prompt Context

The model should receive only the context required for the task.

Do not dump the entire database/customer history into the prompt.

Recommended context:

```text
payment amount
payment status
failure code
failure description
attempt history
recovery history
relevant customer preference
available actions
policy constraints
```

Avoid unnecessary personal information.

---

# 11. Action Vocabulary Must Be Closed

The model cannot invent actions.

The system should pass an explicit action catalog:

```json
[
  "WAIT",
  "SAFE_RETRY",
  "PAYMENT_LINK",
  "MESSAGE",
  "PTP_WAIT",
  "ESCALATE",
  "HUMAN_REVIEW",
  "STOP"
]
```

If the model returns anything outside this set:

```text
invalid recommendation
→ HUMAN_REVIEW / safe fallback
```

---

# 12. AI Does Not Control State

Bad:

```text
LLM:
state = RECOVERED
```

Good:

```text
LLM:
recommended_action = PAYMENT_LINK

Policy:
ALLOW

Action:
PAYMENT_LINK

Provider:
PAYMENT_SUCCESS

System:
RECOVERED
```

Only observed application/provider events can produce `RECOVERED`.

---

# 13. AI Does Not Control Attribution

AI must never determine:

```text
"this payment was recovered by me"
```

Attribution is deterministic and evidence-based.

```text
payment
+
recovery action
+
intervention metadata
+
payment route
→ Attribution Engine
```

Possible results:

```text
DIRECT
ASSISTED
ORGANIC
UNKNOWN
```

---

# 14. AI Message Generation

The model may draft recovery communication.

It must receive:

```text
approved purpose
allowed channel
customer context
payment context
policy constraints
```

The output should be concise and non-deceptive.

The message must not:

- threaten
- impersonate a bank/regulator
- invent penalties
- claim payment is mandatory when it is not
- claim a payment succeeded when it has not
- reveal internal AI reasoning
- circumvent opt-out rules

---

# 15. Message Contract

Example:

```json
{
  "text": "Your recent payment could not be completed. You can try again using the payment link below.",
  "channel": "SIMULATED",
  "template": "PAYMENT_FAILURE_V1"
}
```

The final application should still validate the message against policy/template rules.

AI should not freely generate regulated/legal language.

---

# 16. Promise-to-Pay Extraction

AI may convert customer text into structured data.

Input:

```text
"I'll pay on Friday."
```

Output:

```json
{
  "promised_date": "2026-09-10",
  "confidence": 0.94,
  "source_text": "I'll pay on Friday.",
  "status": "ACTIVE"
}
```

If the date is ambiguous:

```text
confidence below threshold
→ HUMAN_REVIEW
```

Do not guess.

---

# 17. AI and PTP Safety

The AI must not:

```text
invent a promised date
extend a deadline
mark PTP fulfilled
mark payment recovered
```

The AI only extracts the promise.

The application verifies fulfillment through payment state.

---

# 18. AI Failure Handling

## Timeout

```text
AI timeout
→ deterministic fallback
```

## Invalid JSON

```text
invalid output
→ validation failure
→ retry once if appropriate
→ fallback
```

## Provider unavailable

```text
AI unavailable
→ deterministic rules
→ safe action or HUMAN_REVIEW
```

## Low confidence

```text
low confidence
→ conservative action
```

Never compensate for low confidence by increasing autonomy.

---

# 19. AI Cost and Latency

The architecture should minimize unnecessary AI calls.

Use deterministic routing first.

Example:

```text
known failure code
→ deterministic diagnosis
→ no AI call required
```

AI should be invoked when:

```text
uncertainty
+
meaningful expected value
```

justifies the call.

Track:

```text
AI requests
AI latency
AI failures
AI token/cost estimate
model version
```

---

# 20. AI Versioning

Persist:

```text
model_name
model_version
prompt_version
schema_version
timestamp
```

This allows a recovery decision to be reconstructed later.

Example:

```json
{
  "model": "recovery-reasoner",
  "model_version": "v1",
  "prompt_version": "recovery-diagnosis-v3",
  "schema_version": "1.0"
}
```

---

# 21. AI Auditability

For each AI-assisted decision, persist:

```text
task
model
model version
prompt version
input context reference
output
confidence
recommendation
timestamp
```

Avoid storing unnecessary raw customer information.

Where possible, store references/structured context rather than duplicating sensitive records.

---

# 22. AI + Policy Interaction

Example:

```text
AI:
recommended_action = PAYMENT_LINK
confidence = 0.94

Policy:
payment unpaid = YES
opted out = NO
communication limit = OK
recovery active = YES

Decision:
ALLOW
```

Another example:

```text
AI:
recommended_action = PAYMENT_LINK
confidence = 0.99

Policy:
payment already paid = YES

Decision:
BLOCK
```

Policy always wins.

---

# 23. AI + Risk Interaction

The AI may contribute:

```text
recovery_probability
```

The risk engine combines that with deterministic economic inputs.

Conceptually:

```text
expected_recoverable_revenue
=
amount_at_risk
×
P(recovery)
×
P(incremental)
```

The AI should not directly write the final financial metric.

---

# 24. AI Guardrails

The AI layer must never:

```text
execute payment
change payment amount
change retry limits
remove opt-out
send an unauthorized message
declare recovery
declare attribution
override policy
override state machine
create arbitrary API calls
```

---

# 25. Recommended AI Architecture

```text
AI Gateway
    │
    ├── Diagnosis Task
    ├── Recovery Probability Task
    ├── Recommendation Task
    ├── Message Task
    └── PTP Extraction Task
           │
           ▼
      Schema Validator
           │
           ▼
      Policy Engine
```

The application should not scatter direct LLM calls across random business logic.

---

# 26. Testing AI

Minimum tests:

### Valid diagnosis

```text
insufficient_funds
→ BUSINESS
```

### Invalid action

```text
AI returns "REFUND_CUSTOMER"
→ rejected
```

### Hallucinated recovery

```text
AI says payment succeeded
→ ignored
```

### Low confidence

```text
confidence = 0.42
→ conservative path
```

### Prompt/output corruption

```text
invalid JSON
→ fallback
```

### Already paid

```text
AI recommends outreach
+
payment = PAID
→ BLOCK
```

### PTP ambiguity

```text
"I'll pay sometime soon."
→ AMBIGUOUS
→ HUMAN_REVIEW
```

---

# 27. Definition of Done

- [ ] AI tasks are explicitly scoped.
- [ ] AI outputs use strict schemas.
- [ ] AI actions come from a closed vocabulary.
- [ ] AI cannot execute external financial actions.
- [ ] AI cannot bypass policy.
- [ ] AI cannot mark revenue recovered.
- [ ] AI cannot determine attribution.
- [ ] Deterministic rules handle known failure codes.
- [ ] AI handles ambiguous/contextual tasks.
- [ ] Low-confidence output has safe fallback.
- [ ] AI failures do not stop the recovery system.
- [ ] Model/prompt versions are persisted.
- [ ] AI-assisted decisions are auditable.
- [ ] PTP extraction is structured and confidence-aware.
- [ ] AI-generated messages remain policy constrained.

---

# 28. Final AI Principle

The correct mental model is:

```text
AI = reasoning layer

Policy = authority layer

State machine = control layer

Provider = source of financial truth

Outcome engine = evidence layer
```

Therefore:

> **The AI may suggest what should happen next. It never gets to decide what is allowed to happen or whether money was actually recovered.**
