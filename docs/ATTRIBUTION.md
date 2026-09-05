# ATTRIBUTION.md — AI Revenue Recovery MVP

## 1. Purpose

Attribution answers:

> **Did the recovery system actually contribute to recovered revenue, and how much?**

The system must distinguish observed payment from attributable incremental recovery.

A payment occurring after an AI action is not automatically proof that the AI caused it.

---

# 2. Attribution Categories

## DIRECT

Payment can be directly connected to an agent-generated recovery path.

Examples:

```text
agent-generated payment link
→ customer pays through that link
```

or an explicitly tracked recovery route.

Definition:

```text
strong causal/technical evidence
```

---

## ASSISTED

The agent intervention plausibly contributed to recovery, but the payment cannot be directly tied to a unique recovery route.

Examples:

```text
agent outreach
→ customer returns to normal checkout
→ payment succeeds
```

The intervention occurred within the configured attribution window, but there is no direct recovery-link evidence.

---

## ORGANIC

Payment occurred without a qualifying recovery intervention.

Examples:

```text
customer independently returns
→ normal payment
```

Organic payments are important because they form the counterfactual baseline.

---

## UNKNOWN

There is insufficient evidence to classify the payment.

Never force attribution.

---

# 3. Attribution Evidence

Possible evidence sources:

```text
payment_link_id
recovery_session_id
action_id
payment_id
customer_id
timestamp
checkout/session identifier
campaign/recovery metadata
```

The strongest evidence should be preferred.

---

# 4. Attribution Priority

When multiple evidence types exist:

```text
DIRECT
   ↓
ASSISTED
   ↓
ORGANIC
   ↓
UNKNOWN
```

But the priority must not create false direct attribution.

Example:

```text
agent link exists
but customer paid through unrelated checkout
```

Do not call it DIRECT solely because the link existed.

---

# 5. Attribution Window

For assisted recovery, define a configurable window:

```text
ATTRIBUTION_WINDOW
```

Example:

```text
outreach
   ↓
customer pays within configured window
   ↓
ASSISTED
```

The exact duration should be configuration, not embedded throughout the code.

---

# 6. Direct Attribution Rule

A payment is DIRECT when:

```text
payment succeeded
AND
payment route is explicitly tied to recovery action
AND
recovery session is active/valid
```

Persist the evidence.

Example:

```json
{
  "type": "DIRECT",
  "payment_id": "pay_123",
  "recovery_session_id": "rec_123",
  "action_id": "act_456",
  "evidence": "RECOVERY_PAYMENT_LINK"
}
```

---

# 7. Assisted Attribution Rule

A payment may be ASSISTED when:

```text
payment succeeded
AND
qualifying recovery intervention occurred
AND
payment is within attribution window
AND
no stronger direct evidence exists
```

The system should preserve the intervention that created the attribution.

---

# 8. Organic Attribution Rule

A payment is ORGANIC when:

```text
payment succeeded
AND
no qualifying recovery intervention preceded it
```

Organic revenue must remain visible.

It must not be counted as AI-recovered revenue.

---

# 9. Unknown Attribution

Use UNKNOWN when:

```text
timestamps conflict
payment route is unavailable
recovery identity cannot be resolved
multiple possible sessions exist
evidence is incomplete
```

Unknown is preferable to fabricated certainty.

---

# 10. Double-Counting Protection

A single payment must correspond to one recovery outcome.

Invariant:

```text
payment_id → max one RecoveryOutcome
```

If multiple recovery sessions appear connected:

```text
resolve using evidence and timestamps
```

Do not count the same rupee twice.

---

# 11. Recovery Outcome

Persist:

```text
payment_id
recovery_session_id
amount_recovered
currency
attribution_type
attribution_evidence
recovered_at
```

Example:

```json
{
  "payment_id": "pay_123",
  "recovery_session_id": "rec_123",
  "amount_recovered": 12000,
  "currency": "INR",
  "attribution_type": "DIRECT",
  "attribution_evidence": "RECOVERY_PAYMENT_LINK"
}
```

---

# 12. Gross Recovered Revenue

Gross recovered revenue is:

```text
sum(amount of successful payments
classified as recovery outcomes)
```

This metric is useful but should not automatically be presented as incremental revenue.

---

# 13. Incremental Recovered Revenue

The strongest demo metric is estimated incremental recovery.

Use a control/treatment experiment.

```text
Treatment recovery rate
-
Control recovery rate
=
incremental lift
```

Then:

```text
incremental recovered revenue
=
incremental lift
×
treatment eligible revenue base
```

Example:

```text
Control:
20 / 100 recovered = 20%

Treatment:
30 / 100 recovered = 30%

Lift:
10 percentage points

Treatment eligible revenue:
₹100,000

Estimated incremental recovery:
₹10,000
```

These numbers are illustrative.

---

# 14. Control Group

The control group should:

```text
receive normal/non-agent treatment
```

The treatment group:

```text
receives the bounded recovery workflow
```

Both groups should be comparable.

For the MVP, deterministic seeded assignment is acceptable.

Example:

```text
customer/payment hash
→ control or treatment
```

Persist assignment.

---

# 15. Treatment Eligibility

Do not include every record blindly.

A treatment/control unit should satisfy the experiment's eligibility criteria.

Examples:

```text
payment failed
payment amount valid
recovery opportunity valid
not already recovered
```

Record exclusion reasons.

---

# 16. Experiment Metrics

Minimum metrics:

```text
eligible payments
successful payments
recovery rate
recovered revenue
incremental lift
incremental recovered revenue
```

Optional:

```text
average recovery time
recovery by failure class
recovery by action
cost per recovery
net recovery
```

---

# 17. Cost-Aware Recovery

Future/optional MVP metric:

```text
net recovered revenue
=
recovered revenue
-
recovery cost
```

Recovery cost may include:

```text
AI inference
communications
provider fees
operational cost
```

Do not claim net revenue unless these costs are actually measured or explicitly labeled as estimates.

---

# 18. Attribution Timeline

Example:

```text
10:00 Payment fails
        ↓
10:01 Recovery session created
        ↓
10:02 AI recommends payment link
        ↓
10:02 Policy ALLOW
        ↓
10:03 Payment link created
        ↓
10:08 Customer pays
        ↓
10:08 Provider confirms success
        ↓
10:08 Attribution = DIRECT
        ↓
10:08 Recovery = ₹12,000
```

---

# 19. Race Condition

If:

```text
agent creates payment link
```

and then:

```text
customer pays through normal checkout
```

the system must determine attribution from actual evidence.

Do not automatically call it DIRECT.

Possible result:

```text
ASSISTED
```

if intervention evidence and timing support contribution.

Otherwise:

```text
ORGANIC
```

or:

```text
UNKNOWN
```

---

# 20. Dashboard Metrics

The dashboard should distinguish:

```text
Revenue at risk
Gross recovered
Direct recovery
Assisted recovery
Organic recovery
Unknown
Estimated incremental recovery
```

Recommended headline:

```text
₹X incremental revenue recovered
```

when the experiment supports the claim.

Secondary:

```text
₹Y gross recovered through recovery workflows
```

---

# 21. Auditability

Attribution decisions must be explainable.

The UI should be able to answer:

```text
Why DIRECT?
```

Example:

```text
Paid through recovery payment link
Action: act_456
Recovery session: rec_123
Payment: pay_123
```

For ASSISTED:

```text
Recovery message sent 18 minutes before payment.
Payment occurred within attribution window.
No direct recovery-link evidence.
```

---

# 22. Attribution Invariants

```text
A payment cannot be counted twice.

A payment cannot be marked recovered before provider/payment confirmation.

Organic revenue cannot be reported as incremental AI recovery.

AI cannot assign attribution.

Attribution must reference evidence.

Unknown is valid.
```

---

# 23. Definition of Done

- [ ] DIRECT attribution implemented.
- [ ] ASSISTED attribution implemented or explicitly stubbed.
- [ ] ORGANIC attribution implemented.
- [ ] UNKNOWN supported.
- [ ] Attribution evidence persisted.
- [ ] Double-counting prevented.
- [ ] Control/treatment assignment persisted.
- [ ] Recovery metrics calculated from data.
- [ ] Incremental recovery calculation implemented.
- [ ] Dashboard separates gross and incremental recovery.
- [ ] Attribution is auditable.
