# FUTURE_ROADMAP.md — AI Revenue Recovery

## 1. Purpose

This roadmap defines capabilities intentionally outside the MVP.

The MVP is deliberately narrow.

The future product expands the same recovery control plane across additional revenue-loss surfaces.

---

# 2. Product North Star

Build an autonomous but bounded revenue recovery system that can:

```text
detect revenue at risk
→ understand why
→ select an appropriate intervention
→ execute it
→ observe outcome
→ stop safely
→ prove financial impact
```

The architecture should allow additional recovery channels without replacing the core:

```text
state machine
policy engine
AI contract
action executor
attribution engine
audit trail
```

---

# 3. MVP

## Scope

```text
Payment failure recovery
```

Core capabilities:

```text
Razorpay webhook ingestion
failure classification
risk assessment
AI recommendation
policy enforcement
bounded retry
payment-link recovery
simulated/customer messaging
payment confirmation
attribution
audit trail
control/treatment experiment
dashboard
```

## Explicitly out of MVP

```text
voice calls
full WhatsApp
ERP integrations
complex B2B collections
full subscription lifecycle
mandate orchestration
production tax/legal automation
```

---

# 4. Phase 1 — Checkout Recovery

Expand from failed payments to checkout abandonment.

Flow:

```text
checkout started
      ↓
drop-off detected
      ↓
risk assessment
      ↓
reason inference
      ↓
bounded intervention
      ↓
checkout/payment
      ↓
recovery attribution
```

Potential signals:

```text
checkout abandonment
payment method selection
session behavior
previous payment history
```

---

# 5. Phase 2 — Subscription Recovery

Support failed recurring/subscription payments.

Capabilities:

```text
subscription failure detection
failure diagnosis
bounded retry sequence
payment-link recovery
customer outreach
subscription status reconciliation
```

The same state-machine principles apply.

---

# 6. Phase 3 — Mandate Retry Sequencer

Build a policy-driven retry scheduler.

Conceptually:

```text
failure
 ↓
grace period
 ↓
retry 1
 ↓
retry 2
 ↓
halt
 ↓
active recovery
```

The system must respect:

```text
maximum retries
timing rules
customer constraints
provider rules
regulatory requirements
```

---

# 7. Phase 4 — Promise-to-Pay Tracker

Expand PTP beyond the MVP demonstration.

Capabilities:

```text
conversation ingestion
PTP extraction
promised-date tracking
payment verification
missed-promise detection
bounded follow-up
escalation
```

AI remains responsible for extraction/interpretation.

The payment system remains responsible for fulfillment truth.

---

# 8. Phase 5 — B2B Receivables

Support overdue invoices.

Potential inputs:

```text
invoice
due date
payment history
customer communication
ERP data
purchase/order information
```

Capabilities:

```text
overdue detection
account prioritization
chasing
PTP extraction
payment verification
escalation
```

---

# 9. B2B Compliance Boundary

Future B2B capabilities must not turn the LLM into an autonomous legal/tax authority.

For TDS or disputed invoices:

```text
AI identifies
      ↓
AI explains
      ↓
AI drafts
      ↓
human approval
      ↓
financial action
```

Future integrations may provide deterministic tax/compliance calculations.

---

# 10. Phase 6 — Hinglish Voice Recovery

Introduce voice as another action channel.

Architecture:

```text
Recovery Engine
      ↓
Voice Action
      ↓
Telephony Provider
      ↓
Streaming Audio
      ↓
Speech/LLM
      ↓
Structured Outcome
      ↓
Recovery State Machine
```

Potential stack from research:

```text
Exotel
Pipecat
Sarvam
```

The exact providers remain implementation choices.

Voice should never bypass:

```text
policy
opt-out
communication limits
audit
state machine
```

---

# 11. Phase 7 — Multi-Channel Orchestration

Eventually support:

```text
payment link
email
SMS
WhatsApp
voice
push
```

The agent chooses among approved channels.

The policy engine controls:

```text
which channel
when
how often
under what conditions
```

---

# 12. Phase 8 — Recovery Strategy Optimization

Move from static action rules toward learned optimization.

The system can learn:

```text
which intervention works best
for which failure
for which customer segment
at what time
```

But optimization remains constrained by:

```text
hard policy
customer preference
regulatory requirements
cost
communication limits
```

---

# 13. Phase 9 — Predictive Revenue-at-Risk

Instead of reacting only after failure:

```text
payment behavior
      ↓
risk model
      ↓
pre-failure risk
      ↓
preventive intervention
```

Examples:

```text
payment degradation
repeated declines
subscription risk
checkout friction
```

---

# 14. Phase 10 — Revenue Recovery Platform

Final platform architecture:

```text
                    REVENUE RISK
                         │
          ┌──────────────┼──────────────┐
          ↓              ↓              ↓
      Payments       Checkout      Receivables
          │              │              │
          └──────────────┼──────────────┘
                         ↓
                  RECOVERY ENGINE
                         │
             ┌───────────┼───────────┐
             ↓           ↓           ↓
          Retry       Outreach      Voice
             │           │           │
             └───────────┼───────────┘
                         ↓
                    VERIFICATION
                         ↓
                    ATTRIBUTION
                         ↓
                     MEASUREMENT
```

---

# 15. Platform Architecture Principle

Future features should plug into the same abstractions:

```text
RecoveryOpportunity
RecoverySession
Diagnosis
RiskAssessment
Recommendation
PolicyDecision
RecoveryAction
PaymentOutcome
Attribution
AuditEvent
```

Do not create independent mini-agents for every recovery channel unless there is a clear reason.

---

# 16. Data/ML Evolution

Future models may include:

```text
recovery probability
customer response probability
channel selection
optimal intervention timing
expected recovery value
churn risk
```

The model layer should remain replaceable.

Persist:

```text
model version
features/context reference
prediction
confidence
timestamp
```

---

# 17. Experimentation Evolution

Move from simple control/treatment to:

```text
A/B tests
multi-arm experiments
channel experiments
timing experiments
policy experiments
```

Every optimization should measure:

```text
incremental recovery
cost
customer impact
opt-out rate
false-positive rate
```

---

# 18. Observability Evolution

Future production monitoring:

```text
recovery success rate
policy-block rate
AI error rate
AI latency
action failure rate
provider failure rate
duplicate events
attribution uncertainty
revenue recovered
net recovery
```

Alerts should detect:

```text
unexpected recovery drop
unusual outreach volume
policy anomalies
provider degradation
AI behavior drift
```

---

# 19. Security Evolution

Future production hardening:

```text
least-privilege credentials
secret management
PII minimization
encryption
role-based access
provider signature verification
audit retention
access logging
```

ERP/email integrations should expose only the minimum data required for a recovery task.

---

# 20. Rollout Strategy

Recommended progression:

```text
Demo
 ↓
Internal test
 ↓
Shadow mode
 ↓
Limited treatment cohort
 ↓
Measured production rollout
 ↓
Expanded autonomy
```

Shadow mode means:

```text
AI recommends
but does not execute
```

This allows recommendation quality to be evaluated before autonomous execution.

---

# 21. Autonomy Ladder

Future autonomy should increase gradually.

```text
Level 0
Observe

Level 1
Recommend

Level 2
Recommend + human approval

Level 3
Execute low-risk actions

Level 4
Execute bounded workflows

Level 5
Optimize within policy constraints
```

The MVP operates primarily around:

```text
Level 1–4
```

depending on action risk.

---

# 22. What Must Never Become Fully Autonomous

Even in the long-term platform:

```text
policy bypass
legal interpretation without governance
unbounded customer outreach
unbounded payment retries
false recovery claims
false attribution
removal of customer opt-out
```

Human governance remains part of the architecture.

---

# 23. Roadmap Priority

Priority should be determined by:

```text
revenue impact
implementation complexity
provider availability
compliance risk
measurement quality
```

Recommended order:

```text
1. Payment failures
2. Checkout abandonment
3. Subscription recovery
4. PTP
5. Mandate sequencing
6. B2B receivables
7. Multi-channel
8. Voice
9. Predictive prevention
10. Optimization platform
```

---

# 24. MVP Boundary Rule

When implementing the MVP:

> **Do not implement a roadmap capability merely because the architecture supports it.**

Build the abstraction only when it directly supports the MVP or prevents obvious architectural debt.

---

# 25. Definition of Done

The roadmap is successful when future capabilities can be added by implementing:

```text
new signal
+
new diagnosis rules
+
new action adapter
+
new policy rules
```

without rewriting:

```text
recovery session model
state machine
audit system
attribution system
dashboard foundations
```

---

# 26. Final Vision

The long-term product is not:

> "An AI that sends payment reminders."

It is:

> **A bounded autonomous revenue recovery control plane that detects revenue leakage, reasons about the cause, executes the safest effective intervention, verifies the outcome, and proves the incremental money recovered.**
