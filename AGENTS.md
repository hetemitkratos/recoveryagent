# AGENTS.md --- AI Revenue Recovery MVP

## Mission

Build the **AI Revenue Recovery MVP** for Razorpay Buildathon Track 03:

> **Detect revenue at risk → diagnose why → choose the least-cost
> compliant intervention → execute → verify payment → stop/escalate →
> measure incremental revenue.**

The MVP is one bounded recovery engine, not seven independent products.

The core proof is:

``` text
failed payment
→ diagnosis
→ revenue-at-risk
→ AI recommendation
→ deterministic policy gate
→ recovery action
→ payment outcome
→ attribution
→ audit
→ dashboard
```

## 1. Source of Truth

Use this priority order:

1.  Explicit user/developer instructions
2.  `PRD.md`
3.  `AGENTS.md`
4.  `docs/` contracts
5.  Existing working code
6.  General engineering judgment

Do not silently expand scope.

When ambiguous, prefer the smallest correct, safe, demoable, and
extensible implementation.

------------------------------------------------------------------------

## 2. MVP Scope

### Build

-   Razorpay payment/subscription webhook ingestion
-   Signature validation
-   Webhook idempotency
-   Normalized payment/subscription state
-   Customer recovery profiles
-   Failure diagnosis
-   Revenue-at-risk scoring
-   Recovery-probability estimation
-   AI-assisted diagnosis and intervention recommendation
-   Deterministic policy/guardrail engine
-   Payment-link recovery
-   At least one notification channel or reliable simulated adapter
-   Bounded subscription retry state machine
-   Payment outcome observation
-   Direct/assisted/organic/unknown attribution
-   Recovery-session ownership/concurrency protection
-   Audit trail
-   Batch control/treatment experiment
-   Recovery dashboard
-   PTP extraction from text/transcript
-   Demo simulation tools
-   Acceptance/resilience tests

### Optional after the core loop works

-   Live SMS/email provider
-   Live voice
-   Hinglish voice
-   Exotel/Pipecat/Sarvam integration

### Defer

-   Autonomous B2B tax/legal decisions
-   Full ERP/CRM integration
-   Multi-aggregator routing
-   Production multi-rail optimization
-   General-purpose collections agent
-   LLM-controlled money movement
-   Full omnichannel platform

Future features should use clean interfaces but must not distract from
the core recovery loop.

------------------------------------------------------------------------

## 3. Architecture

Canonical flow:

``` text
RAZORPAY WEBHOOK
       ↓
INGESTION
       ↓
AUTHENTICATION + IDEMPOTENCY
       ↓
NORMALIZED PAYMENT/SUBSCRIPTION STATE
       ↓
RISK + DIAGNOSIS ENGINE
       ↓
AI REASONER
       ↓
POLICY / GUARDRAIL ENGINE
       ↓
ACTION EXECUTOR
       ↓
OUTCOME OBSERVER
       ↓
ATTRIBUTION
       ↓
AUDIT LEDGER + DASHBOARD
```

### AI may

-   classify ambiguous failures
-   contextualize customer history
-   estimate recovery probability
-   recommend an approved intervention
-   personalize communication
-   infer intent
-   extract PTP dates
-   summarize decisions
-   provide confidence/evidence

### Deterministic policy must own

-   webhook authenticity
-   payment-state checks
-   retry ceilings
-   communication limits
-   timing windows
-   opt-out/suppression
-   duplicate recovery prevention
-   action authorization
-   escalation
-   prohibited-action blocking

**Never allow an LLM to directly authorize money movement.**

------------------------------------------------------------------------

## 4. Non-Negotiable Principles

### Recovery, not notification

Optimize for:

> **incremental recovered revenue per compliant action**

not message volume.

### Payment state always wins

Before any customer-facing action, re-check the latest payment state.

If paid:

``` text
STOP
DO NOT CONTACT
CLOSE RECOVERY SESSION
```

### One active owner

For each `customer_id + payment_id`, allow at most one active recovery
session.

### Bounded AI

AI chooses only from an explicit approved action set, for example:

``` text
SAFE_RETRY
PAYMENT_LINK
MESSAGE
PTP_WAIT
ESCALATE
HUMAN_REVIEW
STOP
```

Never execute free-form model output.

### Full auditability

Every meaningful decision/action must be reconstructable:

``` text
what happened
why
AI recommendation
policy checks
action
outcome
amount recovered
attribution
```

------------------------------------------------------------------------

## 5. Recovery State Machine

Use explicit states:

``` text
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

Core transitions:

``` text
AT_RISK
  ↓
DIAGNOSING
  ├── TECHNICAL → SAFE_RETRY
  ├── BUSINESS → OUTREACH
  ├── PTP       → PTP_WAIT
  └── UNKNOWN   → HUMAN_REVIEW

SAFE_RETRY
  ├── SUCCESS    → RECOVERED
  ├── UNRESOLVED → OUTREACH / ESCALATED
  └── LIMIT      → STOPPED

OUTREACH
  ├── PAYMENT    → RECOVERED
  ├── PTP        → PTP_WAIT
  ├── OPT_OUT    → STOPPED
  ├── LIMIT      → STOPPED
  └── FAILURE    → ESCALATED / STOPPED

PTP_WAIT
  ├── PAYMENT        → RECOVERED
  ├── PROMISE MISSED → OUTREACH
  └── EXPIRED        → ESCALATED / STOPPED
```

Global overrides:

``` text
PAID            → STOP
OPT_OUT         → STOP
LIMIT_REACHED   → STOP
PROHIBITED      → BLOCK
SYSTEM_ERROR    → SAFE_FALLBACK
LOW_CONFIDENCE  → HUMAN_REVIEW
```

Reject invalid state transitions.

------------------------------------------------------------------------

## 6. Failure Diagnosis

Minimum taxonomy:

### Technical degradation

Examples:

-   timeout
-   temporary bank/processor issue
-   unstable infrastructure

Default:

> avoid aggressive dunning; use safe retry/wait/alternative recovery.

### Business/balance issue

Examples:

-   insufficient funds
-   payment-method issue

Default:

> customer-facing recovery if policy allows.

### Authentication issue

Default:

> secure payment-link/payment-method update path.

### Abandonment / intent risk

Default:

> timed recovery link/message based on session state.

### Unknown / low confidence

Default:

> no high-risk autonomous action; human review or safe fallback.

------------------------------------------------------------------------

## 7. Revenue-at-Risk

Prioritize opportunities by economic value.

Inputs:

-   amount at risk
-   failure class
-   historical recovery
-   time sensitivity
-   engagement history
-   previous attempts
-   current payment state

Reference formula:

``` text
Expected Recoverable Revenue
=
Amount at Risk
× Estimated P(Recovery)
× Estimated P(Recovery is Incremental)
```

Store:

``` text
risk_score
recovery_probability
expected_recoverable_revenue
risk_factors
```

Probabilities are decision-support estimates, not financial facts.

Never fabricate model confidence or recovery outcomes.

------------------------------------------------------------------------

## 8. AI Contract

AI outputs must be structured and validated.

Example:

``` json
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

Rules:

-   validate schema
-   reject malformed output
-   reject unsupported actions
-   never execute natural-language output
-   keep decision-oriented generation controlled
-   provide only necessary customer context
-   preserve useful AI reasoning for audit/debugging
-   continue safely if the LLM is unavailable

------------------------------------------------------------------------

## 9. Policy Rules

Centralize policy. Do not scatter guardrails through UI/controllers.

Minimum rules:

``` text
RULE-001:
Never outreach if latest payment status == PAID.

RULE-002:
Never create two active recovery sessions for the same
customer/payment pair.

RULE-003:
LLM cannot directly authorize money movement.

RULE-004:
Low-confidence high-risk decisions require human review.

RULE-005:
Opt-out suppresses future customer communication.

RULE-006:
Retry ceiling terminates automated retry attempts.

RULE-007:
Every outbound action requires policy approval.

RULE-008:
Unknown/unsupported failures cannot trigger aggressive
autonomous actions.

RULE-009:
Provider/action failure must use a safe fallback and audit event.

RULE-010:
Close the workflow when the recovery objective is satisfied.
```

Policy flow:

``` text
AI recommendation
       ↓
policy evaluation
       ↓
ALLOW / BLOCK / HUMAN_REVIEW
       ↓
executor
```

------------------------------------------------------------------------

## 10. Attribution

Use four attribution classes.

### DIRECT

Payment completed through the AI-generated recovery path.

### ASSISTED

Customer received a qualifying intervention and then paid through
another route with sufficient evidence.

### ORGANIC

Payment happened without a qualifying recovery intervention.

### UNKNOWN

Insufficient evidence to establish causality.

Headline AI recovery should use direct + qualified assisted recovery.

Do not mix organic/unknown into AI recovery.

Before outreach, re-check payment status.

------------------------------------------------------------------------

## 11. Batch Experiment

The demo must prove incremental recovery.

Use comparable control/treatment groups:

``` text
CONTROL
500 transactions
₹X at risk

AI TREATMENT
500 transactions
₹X at risk
```

Measure:

``` text
Recovered revenue
Recovery rate
Incremental lift
Incremental recovered revenue
AI-attributed recovery
Recovery cost
Net recovery
ROI
Guardrail violations
False outreach
```

Primary metric:

``` text
Incremental Revenue Recovered
=
AI-treatment recovery
-
expected control/organic recovery
```

Do not hardcode headline metrics.

Use deterministic seed data/simulation for reproducibility.

------------------------------------------------------------------------

## 12. Audit Contract

Capture, where applicable:

``` text
event_id
recovery_session_id
customer_id
payment_id
subscription_id
source_event_id
timestamp
failure_reason
diagnosis
diagnosis_confidence
risk_score
recovery_probability
selected_action
policy_checks
action_status
outcome
amount_recovered
attribution
```

For the demo, an append-oriented/tamper-evident design is sufficient.

Production-grade immutable/WORM storage is future work.

------------------------------------------------------------------------

## 13. Demo Simulator

Build deterministic tools/endpoints for:

``` text
simulate failure
simulate payment success
simulate PTP
simulate opt-out
simulate already-paid
reset demo
seed batch
run batch experiment
```

The simulator must exercise the real application logic.

Do not build a frontend-only fake demo.

------------------------------------------------------------------------

## 14. Hero Cases

### A --- Technical failure

Expected:

``` text
technical diagnosis
→ no aggressive dunning
→ safe retry/wait
→ recovery if successful
```

### B --- Insufficient funds

Expected:

``` text
business diagnosis
→ risk
→ payment link
→ payment success
→ RECOVERED
→ DIRECT attribution
```

### C --- Promise to Pay

Input:

``` text
"I'll pay on Friday."
```

Expected:

``` text
PTP detected
→ date extracted
→ outreach paused
→ PTP_WAIT
→ verify on due date
→ follow-up only if missed
```

### D --- Already paid

Expected:

``` text
latest status = PAID
→ block outbound action
→ close workflow
```

### E --- Opt out

Expected:

``` text
opt-out
→ suppress communication
→ STOPPED
```

------------------------------------------------------------------------

## 15. Dashboard

The first screen is a financial control room.

Show:

``` text
Revenue at Risk
Recovered Revenue
Incremental Recovery
Recovery Rate
Net Recovery ROI
Active Workflows
```

Secondary:

``` text
Failures by Type
Best Interventions
Recovery Funnel
Guardrail Events
Attribution Breakdown
Customer Recovery Queue
Audit Timeline
```

Every customer should have a decision trace:

``` text
Failure
→ Diagnosis
→ Confidence
→ Risk
→ Recommendation
→ Policy
→ Action
→ Outcome
→ Attribution
```

------------------------------------------------------------------------

## 16. Implementation Order

Do not start with voice or a large AI layer.

Build:

``` text
1. Inspect repository and stack
2. Domain/database models
3. Webhook ingestion
4. Signature validation + idempotency
5. Recovery state machine
6. Deterministic diagnosis
7. Revenue-at-risk scoring
8. Policy engine
9. Payment-link/action executor
10. Outcome observer
11. Attribution
12. Audit ledger
13. Dashboard
14. AI recommendation layer
15. PTP extraction
16. Demo simulator
17. Batch experiment
18. Acceptance/resilience tests
19. Optional provider integrations
20. Optional voice
```

The deterministic engine must work before AI becomes central.

------------------------------------------------------------------------

## 17. Development Rules

Before coding:

1.  Inspect the repository.
2.  Identify the existing stack/conventions.
3.  Reuse working infrastructure.
4.  Avoid unnecessary rewrites.
5.  Identify missing dependencies.
6.  Make a small implementation plan.
7.  Implement incrementally.
8.  Run tests after each meaningful subsystem.
9.  Keep the application runnable throughout.

When changing code:

-   understand surrounding code first
-   preserve working interfaces
-   avoid unrelated refactors
-   isolate provider-specific integrations behind adapters
-   keep core business logic testable without external services

------------------------------------------------------------------------

## 18. Testing

Test at minimum:

### Webhooks

-   valid signature
-   invalid signature
-   duplicate event
-   malformed payload
-   delayed event

### Recovery

-   technical failure
-   insufficient funds
-   authentication failure
-   unknown failure
-   subscription failure
-   successful recovery

### Guardrails

-   already paid
-   opt-out
-   retry ceiling
-   duplicate recovery owner
-   low-confidence diagnosis
-   prohibited action
-   provider failure
-   AI unavailable

### Attribution

-   direct
-   assisted
-   organic
-   unknown
-   concurrent payment

### PTP

-   valid date
-   ambiguous date
-   missed promise
-   payment before promise date

Tests should verify state transitions and side effects, not only HTTP
status codes.

------------------------------------------------------------------------

## 19. Failure Handling

### LLM failure

Use deterministic diagnosis/policy fallback.

### Payment provider failure

Record failure; do not duplicate the action; use safe fallback.

### Notification provider failure

Record failure and use another approved path only if policy permits.

### Duplicate webhook

Process business event once.

### Payment succeeds during recovery

Close the session immediately and suppress future actions.

### Ambiguous diagnosis

Do not guess on high-risk actions. Escalate or use safe fallback.

------------------------------------------------------------------------

## 20. Security

Never:

-   commit API keys
-   expose secrets in logs
-   put credentials in frontend code
-   trust client-side payment state
-   trust unverified webhooks
-   execute arbitrary LLM commands
-   log unnecessary sensitive customer data

Use:

-   environment variables
-   server-side credentials
-   webhook verification
-   idempotency
-   least privilege
-   structured logging
-   sanitized errors

------------------------------------------------------------------------

## 21. Future Design

Preserve extension points for:

-   checkout drop-off recovery
-   voice recovery
-   Hinglish/multilingual recovery
-   B2B receivables
-   mandate intelligence
-   payment-rail routing
-   outcome-based policy learning
-   production compliance controls
-   CRM/ERP/finance/telephony integrations

Future features plug into the same core:

``` text
new risk signal
→ same diagnosis/risk layer
→ same policy engine
→ new approved intervention
→ same observer
→ same attribution
→ same audit
```

Do not implement future capabilities unless explicitly requested.

------------------------------------------------------------------------

## 22. Explicit Non-Goals

Do not turn the MVP into:

-   a generic chatbot
-   a generic collections system
-   an LLM controlling money
-   an autonomous tax/legal advisor
-   a spam engine
-   a dashboard with fabricated metrics
-   a giant integrations project
-   disconnected feature demos

The product is:

> **A bounded autonomous revenue recovery engine.**

------------------------------------------------------------------------

## 23. Definition of Done

The MVP is done when:

-   [ ] Failed payment can enter through real/simulated event.
-   [ ] Webhook authenticity is validated.
-   [ ] Duplicate events are idempotent.
-   [ ] Recovery session is created exactly once.
-   [ ] Failure diagnosis is produced.
-   [ ] Revenue-at-risk is calculated.
-   [ ] AI can recommend an approved intervention.
-   [ ] Policy can allow/block/human-review it.
-   [ ] Payment status is checked before outreach.
-   [ ] Recovery action executes.
-   [ ] Payment success closes workflow.
-   [ ] Attribution is recorded.
-   [ ] Audit events are written.
-   [ ] Dashboard updates from real application state.
-   [ ] Batch experiment is reproducible.
-   [ ] Already-paid case is blocked.
-   [ ] Opt-out stops communication.
-   [ ] Retry ceiling stops automated retry.
-   [ ] Low-confidence high-risk actions are blocked.
-   [ ] PTP can be extracted and persisted.
-   [ ] AI failure does not break safe operation.
-   [ ] At least three hero cases are demoable.
-   [ ] No headline metric is hardcoded.

------------------------------------------------------------------------

## 24. Agent Behavior Under Ambiguity

When uncertain:

1.  Check `PRD.md`.
2.  Check `docs/`.
3.  Check existing code.
4.  Choose the smallest reversible implementation.
5.  Document important assumptions.
6.  Continue when the decision is low risk.
7.  Ask for clarification only when ambiguity materially affects scope,
    security, financial behavior, or irreversible architecture.

Do not block progress over minor implementation choices.

------------------------------------------------------------------------

## 25. Final Principle

Make the product feel intelligent because it makes **better decisions**,
not because an LLM is everywhere.

The target loop is:

``` text
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

Every successful demo must answer:

**Why did the system act?**\
AI diagnosis + customer context + risk.

**Why was the action allowed?**\
Deterministic policy + guardrails.

**Did it recover money?**\
Payment outcome + attribution + batch measurement.

------------------------------------------------------------------------

## 26. Agent Skill Hierarchy

Project-local skills live under `.agents/skills/` and are auto-discovered.
They supplement — and never override — the product specification documents.

**If a skill and a specification conflict, the specification wins.**

| Skill | Use When |
|-------|----------|
| `revenue-recovery` | Implementing domain entities, recovery loop, failure classification, risk scoring, attribution rules, or any domain invariant |
| `state-machine` | Implementing or testing state transitions, guards, terminal-state protection, race conditions, idempotent transitions |
| `policy-engine` | Implementing or testing the PolicyEngine, any POLICY_RULES.md rule, kill switch, high-value threshold, or audit of decisions |
| `ai-engineering` | Implementing the AI adapter, Zod output schemas, deterministic fallbacks, PTP extraction, confidence handling, mock adapter, or AI tests |
| `payment-integration` | Implementing Razorpay webhook gateway, signature verification, idempotency, event normalization, provider adapters, or simulator adapter |
| `testing` | Writing any test — unit, integration, scenario, or webhook; fixture factories; test configuration |
| `demo-engineering` | Implementing demo simulator, seed data, batch experiment runner, demo reset, or demo control panel |

### Activation Guidance

Before implementing any component:
1. Identify which skill(s) apply from the table above.
2. Read that skill's `.agents/skills/<name>/SKILL.md`.
3. Check the referenced spec documents listed in the skill.
4. Implement. Run tests. Verify against spec.

### Skills Must Not Override

`docs/ARCHITECTURE.md` · `docs/DOMAIN_MODEL.md` · `docs/STATE_MACHINE.md` ·
`docs/POLICY_RULES.md` · `docs/AI_CONTRACT.md` · `docs/API_CONTRACT.md` ·
`docs/ATTRIBUTION.md` · `docs/DEMO_PLAN.md` · `docs/FUTURE_ROADMAP.md`
