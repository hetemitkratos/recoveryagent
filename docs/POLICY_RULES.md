# POLICY_RULES.md — AI Revenue Recovery MVP

## 1. Purpose

This document defines the deterministic authorization layer for the AI Revenue Recovery system.

The policy engine answers one question:

> **Is this recovery action allowed right now?**

The AI can recommend an action. The state machine can request a transition. Neither can bypass policy.

```text
AI recommendation
       ↓
Policy evaluation
       ↓
ALLOW / BLOCK / HUMAN_REVIEW
       ↓
State machine + action executor
```

---

# 2. Authority Hierarchy

When signals conflict, use this order:

```text
1. Payment/provider truth
2. Explicit customer constraints
3. Hard policy rules
4. State-machine constraints
5. Risk/recovery scoring
6. AI recommendation
```

AI is the lowest-authority decision input.

Example:

```text
AI: SEND_PAYMENT_LINK
Payment: ALREADY_PAID

Policy:
BLOCK
```

---

# 3. Universal Rules

Every recovery action must satisfy:

```text
payment is still recoverable
+
recovery session is active
+
action is permitted
+
customer constraints permit it
+
limits have not been reached
```

If any hard guard fails:

```text
DO NOT EXECUTE
```

---

# 4. Payment-State Rule

Before every external recovery action:

```text
fetch latest known payment state
```

If:

```text
CAPTURED / SUCCESSFUL / PAID
```

then:

```text
action = BLOCK
reason = PAYMENT_ALREADY_COMPLETED
transition = RECOVERED
```

This rule prevents accidental duplicate recovery attempts.

---

# 5. Failure Classification Rules

## TECHNICAL

Examples:

```text
temporary processor issue
gateway timeout
network failure
transient provider error
temporary system degradation
```

Default posture:

```text
SAFE_RETRY
```

provided retry policy permits it.

---

## BUSINESS

Examples:

```text
insufficient funds
limit exceeded
customer-side decline
other recoverable business decline
```

Default posture:

```text
OUTREACH / PAYMENT_LINK
```

where permitted.

---

## AUTHENTICATION

Examples:

```text
authentication failure
3DS/AFA issue
customer verification required
```

Default posture:

```text
CUSTOMER_ACTION / OUTREACH
```

Never silently repeat an action that requires customer participation.

---

## UNKNOWN

If classification is:

```text
UNKNOWN
```

or confidence is below the configured threshold:

```text
HUMAN_REVIEW
```

unless a safe deterministic fallback exists.

---

# 6. Retry Rules

A retry is allowed only when:

```text
failure class permits retry
AND
retry_count < MAX_RETRIES
AND
payment is unpaid
AND
recovery is active
AND
policy does not block retry
```

Never retry indefinitely.

Suggested MVP configuration:

```text
MAX_RETRIES = configurable
```

The exact value must live in configuration rather than scattered business logic.

---

# 7. Retry Backoff

Retries should not occur immediately in an uncontrolled loop.

Use:

```text
attempt
→ wait
→ latest payment check
→ policy check
→ retry
```

Backoff should be configurable.

For the demo, a shortened deterministic delay may be used.

The UI should clearly indicate when a demo delay is simulated.

---

# 8. Outreach Rules

Outreach requires:

```text
payment unpaid
customer not opted out
communication_count < MAX_COMMUNICATIONS
minimum interval satisfied
channel permitted
policy = ALLOW
```

If any condition fails:

```text
BLOCK
```

---

# 9. Customer Opt-Out

Opt-out is an absolute customer-facing block.

If:

```text
customer.opted_out = true
```

then:

```text
MESSAGE = BLOCK
VOICE = BLOCK
WHATSAPP = BLOCK
EMAIL = BLOCK
```

unless a future separately governed transactional exception is explicitly supported.

For the MVP:

```text
opt-out → STOPPED
```

---

# 10. Communication Frequency

The system must enforce:

```text
MAX_COMMUNICATIONS
MIN_COMMUNICATION_INTERVAL
```

Do not implement repeated outreach loops.

Bad:

```text
while unpaid:
    send_message()
```

Correct:

```text
if communication_limit_ok
and interval_ok
and policy_allows:
    send
else:
    stop/escalate
```

---

# 11. Payment Link Rules

A payment link may be created only if:

```text
payment unpaid
recovery active
customer not opted out
communication limits permit
policy allows payment-link recovery
```

Creating a link does not mean revenue was recovered.

Only successful payment does.

---

# 12. PTP Rules

A Promise-to-Pay workflow requires:

```text
explicit customer promise
+
unambiguous promised date
+
sufficient extraction confidence
```

If the date is ambiguous:

```text
HUMAN_REVIEW
```

Once PTP is active:

```text
do not repeatedly chase
```

If payment arrives:

```text
RECOVERED
```

If promised date passes without payment:

```text
OUTREACH / ESCALATE
```

subject to communication limits and policy.

---

# 13. Risk Rules

Risk scoring informs prioritization but does not override hard policy.

Conceptually:

```text
expected recovery
=
amount at risk
×
recovery probability
×
incrementality estimate
```

High risk/value may justify:

```text
priority
human review
stronger evidence requirements
```

It must never justify:

```text
unlimited retries
unlimited outreach
policy bypass
```

---

# 14. High-Value Recovery

High-value transactions may require a stricter review threshold.

Configurable:

```text
HIGH_VALUE_THRESHOLD
```

If a proposed action is high-impact and:

```text
AI confidence < HIGH_VALUE_CONFIDENCE_THRESHOLD
```

then:

```text
HUMAN_REVIEW
```

The MVP may implement this as a configurable rule even if the demo does not exercise it.

---

# 15. AI Confidence Rules

AI confidence is advisory.

Suggested configuration:

```text
HIGH_CONFIDENCE >= 0.90
MEDIUM_CONFIDENCE = 0.70–0.89
LOW_CONFIDENCE < 0.70
```

Low confidence should trigger conservative behavior.

Important:

```text
AI confidence can never override a hard BLOCK.
```

---

# 16. Policy Decision Types

Every proposed action must resolve to one of:

```text
ALLOW
BLOCK
HUMAN_REVIEW
```

Example:

```json
{
  "decision": "BLOCK",
  "action": "MESSAGE",
  "reason_codes": [
    "PAYMENT_ALREADY_COMPLETED"
  ]
}
```

---

# 17. Action Matrix

| Condition | Retry | Payment Link | Message | Human Review |
|---|---:|---:|---:|---:|
| Technical + eligible | ALLOW | optional | optional | no |
| Business + eligible | usually no | ALLOW | ALLOW | no |
| Authentication | no | conditional | ALLOW | conditional |
| Unknown failure | no | no | no | ALLOW |
| Low AI confidence | conditional | conditional | conditional | usually ALLOW |
| Already paid | BLOCK | BLOCK | BLOCK | no |
| Opted out | BLOCK | BLOCK | BLOCK | no |
| Retry limit reached | BLOCK | conditional | conditional | conditional |
| Communication limit reached | n/a | BLOCK | BLOCK | conditional |
| Legal/compliance ambiguity | BLOCK | BLOCK | BLOCK | ALLOW |

---

# 18. Legal/Compliance Boundary

The MVP should not autonomously perform legally consequential interpretation.

Especially for B2B/TDS:

```text
AI may identify
AI may explain
AI may draft

AI must not autonomously establish a disputed legal/tax position.
```

If a TDS/legal dispute is detected:

```text
HUMAN_REVIEW
```

Future implementation may add governed tax/compliance integrations.

---

# 19. Human Review Rules

Route to human review when:

```text
unknown failure
low-confidence high-impact recommendation
legal/compliance ambiguity
repeated failed recovery
unusual customer context
policy conflict
provider ambiguity
```

Human review should produce an auditable decision:

```text
APPROVE
REJECT
MODIFY
STOP
```

Any approved action must still pass final execution guards.

---

# 20. Kill Switch

The system should have a global recovery disable switch:

```text
RECOVERY_AUTOMATION_ENABLED = false
```

When disabled:

```text
new external recovery actions = BLOCK
```

The system may continue:

```text
webhook ingestion
payment observation
audit logging
dashboard reporting
```

This allows the recovery engine to be disabled without losing observability.

---

# 21. Audit Rules

Every policy decision must produce an auditable record:

```text
timestamp
recovery_session_id
action
decision
reason_codes
policy_version
relevant state
```

Example:

```json
{
  "action": "PAYMENT_LINK",
  "decision": "ALLOW",
  "reason_codes": [
    "BUSINESS_FAILURE",
    "PAYMENT_UNPAID",
    "OUTREACH_ALLOWED"
  ],
  "policy_version": "v1"
}
```

---

# 22. Policy Versioning

Policies must be versioned.

Example:

```text
policy_version = v1
```

Persist the version used for every decision.

Do not silently change policy behavior without changing the version/configuration.

---

# 23. Deterministic First

Whenever a policy can be expressed deterministically, do so.

Examples:

```text
paid?
opted out?
retry count exceeded?
communication limit exceeded?
action allowed?
```

These should not require LLM judgment.

---

# 24. Definition of Done

- [ ] Every external action passes policy.
- [ ] Payment is rechecked before recovery action.
- [ ] Already-paid recovery is blocked.
- [ ] Opt-out is enforced.
- [ ] Retry limits are enforced.
- [ ] Communication limits are enforced.
- [ ] Unknown cases reach human review.
- [ ] AI cannot override policy.
- [ ] Legal ambiguity reaches human review.
- [ ] Policy decisions are audited.
- [ ] Policy version is stored.
- [ ] Global kill switch exists.
