# DEMO_PLAN.md — AI Revenue Recovery MVP

## 1. Demo Objective

The demo must prove one simple claim:

> **The system does not just detect failed revenue. It diagnoses the failure, chooses a bounded intervention, executes it safely, observes the payment outcome, and measures the money recovered.**

The demo should prioritize:

```text
clarity
+
measurable revenue
+
visible AI reasoning
+
visible policy controls
+
auditability
```

Do not attempt to demonstrate every future feature.

---

# 2. MVP Demo Scope

The live demo focuses on:

```text
Payment failure
→ risk detection
→ diagnosis
→ recovery recommendation
→ policy decision
→ bounded action
→ payment confirmation
→ attribution
→ recovered revenue
```

Primary recovery actions:

```text
SAFE_RETRY
PAYMENT_LINK
MESSAGE
```

Primary safety demonstration:

```text
already paid
→ action blocked
```

Secondary:

```text
PTP
opt-out
human review
```

may be demonstrated through simulated cases if time permits.

---

# 3. Demo Environment

The application should have:

```text
Dashboard
Recovery Queue
Recovery Detail
Audit Timeline
Experiment/Results View
Demo Controls
```

The demo should run deterministically.

Required:

```text
seed
reset
simulate failure
simulate payment
simulate opt-out
```

---

# 4. Demo Dataset

Seed a batch containing multiple failure types.

Suggested demo batch:

```text
100 failed payment opportunities
```

Example composition:

```text
40 technical
40 business
10 authentication
10 unknown
```

Amounts should vary.

Example:

```text
₹500
₹1,200
₹3,500
₹7,500
₹12,000
₹25,000
```

These are illustrative and should be generated deterministically.

Include a mixture of:

```text
recoverable
non-recoverable
already paid/race
opted out
low-confidence
```

---

# 5. Hero Scenario

The primary live scenario should be a business decline.

Example:

```text
Customer:
Demo Customer

Amount:
₹12,000

Failure:
insufficient_funds
```

Flow:

```text
PAYMENT_FAILED
       ↓
AT_RISK
       ↓
DIAGNOSING
       ↓
BUSINESS FAILURE
       ↓
AI:
PAYMENT_LINK
       ↓
POLICY:
ALLOW
       ↓
PAYMENT LINK CREATED
       ↓
CUSTOMER PAYS
       ↓
PAYMENT_SUCCESS
       ↓
RECOVERED
       ↓
DIRECT
       ↓
₹12,000 RECOVERED
```

This should be the most polished flow.

---

# 6. What the Judge Should See

On the recovery detail page:

```text
┌─────────────────────────────────────┐
│ ₹12,000 AT RISK                     │
│ Business decline                    │
│ Recovery probability: 78%           │
├─────────────────────────────────────┤
│ AI RECOMMENDATION                   │
│ Payment Link                        │
│ Confidence: 94%                    │
│                                     │
│ Why: alternate payment path         │
├─────────────────────────────────────┤
│ POLICY                              │
│ ✓ Payment unpaid                    │
│ ✓ Outreach permitted                │
│ ✓ Communication limit OK            │
│ ✓ Policy ALLOW                      │
├─────────────────────────────────────┤
│ ACTION                              │
│ Payment link created                │
├─────────────────────────────────────┤
│ OUTCOME                             │
│ ✓ Payment successful                │
│ ₹12,000 recovered                   │
│ Attribution: DIRECT                 │
└─────────────────────────────────────┘
```

---

# 7. Hero Scenario Timing

The happy-path demo should be fast.

Target:

```text
60–120 seconds
```

The audience should understand the complete loop without waiting for real-world delays.

Demo simulation may compress:

```text
retry delays
payment waiting
webhook arrival
```

but must label them as simulated.

---

# 8. Safety Scenario

This is critical because it demonstrates that the agent is bounded.

Scenario:

```text
Payment appears at risk
       ↓
Agent prepares recovery action
       ↓
Customer pays independently
       ↓
Agent attempts to continue
       ↓
LATEST PAYMENT CHECK
       ↓
PAYMENT = SUCCESS
       ↓
ACTION BLOCKED
       ↓
RECOVERED
```

Show:

```text
"Recovery action blocked: payment already completed."
```

Then open the audit event.

This is a strong trust/safety moment.

---

# 9. Technical Failure Scenario

Scenario:

```text
Payment failure
       ↓
TECHNICAL
       ↓
SAFE_RETRY
       ↓
Policy ALLOW
       ↓
Retry
       ↓
Payment success
       ↓
RECOVERED
```

Show that the system does not send customer outreach for a failure that should be resolved technically.

---

# 10. Unknown/Low-Confidence Scenario

Scenario:

```text
Unknown failure
       ↓
AI confidence low
       ↓
HUMAN_REVIEW
```

Show:

```text
No autonomous recovery action executed.
```

This proves that the AI is bounded rather than blindly autonomous.

---

# 11. Batch Experiment

After the hero scenarios, move to the results dashboard.

Example:

```text
100 eligible failed payments

CONTROL
50 payments
Recovery rate: X%

AI RECOVERY
50 payments
Recovery rate: Y%

Incremental lift: Z pp

Estimated incremental recovered revenue:
₹X
```

The numbers must come from seeded experiment data.

Never hardcode a fake success metric into the UI.

---

# 12. Results Dashboard

Headline metrics:

```text
₹ Revenue at Risk
₹ Gross Recovered
₹ Incremental Recovered
Recovery Rate
Active Recoveries
```

Secondary:

```text
Recovery by failure class
Recovery by action
Attribution split
```

---

# 13. Attribution View

Show:

```text
DIRECT
₹X

ASSISTED
₹Y

ORGANIC
₹Z

UNKNOWN
₹W
```

Clicking a recovered payment should reveal evidence.

Example:

```text
DIRECT

Payment:
pay_123

Recovery:
rec_123

Action:
act_456

Evidence:
Recovery payment link used
```

---

# 14. Audit Timeline

Every hero scenario should have a visible timeline:

```text
10:01 Payment failed
10:01 Recovery opportunity created
10:02 Diagnosis completed
10:02 AI recommendation generated
10:02 Policy ALLOW
10:03 Payment link created
10:08 Payment successful
10:08 Attribution calculated
10:08 Recovery closed
```

For blocked action:

```text
Payment state rechecked
→ PAID
→ ACTION BLOCKED
```

---

# 15. Demo Control Panel

A hidden or clearly marked demo panel may expose:

```text
Seed Demo
Reset Demo
Trigger Technical Failure
Trigger Business Failure
Trigger Unknown Failure
Simulate Payment
Simulate Opt-Out
Run Batch Experiment
```

This makes the demo recoverable if something goes wrong.

---

# 16. Demo Script

## Opening

Say:

> "Most payment failures don't mean the customer won't pay. The problem is knowing which failures are recoverable, what action is appropriate, and when to stop."

Then:

> "Our agent closes that loop."

---

## Scenario 1

Select failed ₹12,000 payment.

Explain:

> "The payment failed because of a business-side decline. Instead of blindly retrying, the system classifies the failure and recommends an alternate payment path."

Show:

```text
AI recommendation
→ PAYMENT_LINK
```

Then:

```text
Policy
→ ALLOW
```

Execute.

Simulate payment.

Show:

```text
₹12,000 recovered
DIRECT
```

---

## Scenario 2

Select already-paid/race scenario.

Say:

> "Now the important part: autonomy without controls is dangerous."

Trigger recovery.

Show:

```text
payment re-check
→ already paid
→ action blocked
```

Say:

> "The AI can recommend an action, but it cannot override payment truth or policy."

---

## Scenario 3

Show batch results.

Say:

> "Finally, we don't measure success by how many messages the agent sent. We measure money recovered."

Show:

```text
control
vs
treatment
vs
incremental recovery
```

---

# 17. The "Wow" Moment

The strongest visual sequence is:

```text
₹12,000 AT RISK
       ↓
AI DIAGNOSES
       ↓
POLICY ALLOWS
       ↓
RECOVERY ACTION
       ↓
₹12,000 PAID
       ↓
₹12,000 RECOVERED
```

Immediately followed by:

```text
"Action blocked because payment was already complete."
```

This demonstrates both:

```text
autonomy
+
control
```

---

# 18. What NOT to Demo

Do not spend the live demo on:

```text
full B2B ERP integration
complex TDS calculation
Exotel integration
Pipecat architecture
production-scale voice
all seven recovery directions
```

These belong in the future roadmap.

---

# 19. Future Features to Mention

At the end:

```text
Checkout abandonment
Subscription recovery
Mandate retry sequencing
PTP tracker
B2B receivables
Hinglish voice recovery
Multi-channel recovery
```

Position them as extensions of the same control plane.

---

# 20. Failure Recovery Plan

If live external integrations fail:

```text
switch to deterministic demo simulator
```

The simulator must still use:

```text
same domain model
same state machine
same policy engine
same attribution engine
```

Only the provider adapter changes.

This prevents a demo failure from becoming a product failure.

---

# 21. Demo Definition of Done

- [ ] Seeded dataset works.
- [ ] Hero scenario works end-to-end.
- [ ] Payment outcome can be simulated.
- [ ] Policy decision is visible.
- [ ] AI recommendation is visible.
- [ ] Audit timeline is visible.
- [ ] Already-paid safety scenario works.
- [ ] Unknown/low-confidence scenario works.
- [ ] Batch experiment produces calculated metrics.
- [ ] Attribution is visible.
- [ ] Incremental recovery is visible.
- [ ] Demo can be reset.
- [ ] Demo can run without production credentials.
- [ ] Failure fallback exists.

---

# 22. Final Demo Principle

The demo should leave the judges with one mental model:

```text
DETECT
  ↓
DIAGNOSE
  ↓
DECIDE
  ↓
ACT
  ↓
VERIFY
  ↓
ATTRIBUTE
  ↓
MEASURE
```

That is the product.
