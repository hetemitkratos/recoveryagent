---
name: policy-engine
description: >-
  Use this skill when implementing, testing, or extending the deterministic
  policy engine for the AI Revenue Recovery MVP. The policy engine is the
  mandatory safety gate between AI recommendations and action execution.
  It returns ALLOW, BLOCK, or HUMAN_REVIEW. AI cannot bypass it. This skill
  encodes all POLICY_RULES.md rules as executable implementation guidance.
---

# Policy Engine Skill

## Purpose

The policy engine answers one question for every proposed recovery action:

> **Is this action allowed right now?**

It is the most important safety boundary in the system.
AI is the lowest-authority decision input. Payment/provider truth is highest.

---

## Authority Hierarchy

When signals conflict, use this order (highest to lowest):

1. Payment/provider truth (PAID → always blocks outreach)
2. Explicit customer constraints (opted-out → always blocks communication)
3. Hard policy rules (retry limits, communication limits)
4. State-machine constraints
5. Risk/recovery scoring
6. AI recommendation

---

## Policy Decision Interface

```typescript
interface PolicyContext {
  session: RecoverySession;
  payment: Payment;
  customer: Customer;
  proposedAction: ActionType;
  aiRecommendation?: AIRecommendation;
  config: PolicyConfig;
}

interface PolicyResult {
  decision: 'ALLOW' | 'BLOCK' | 'HUMAN_REVIEW';
  rulesEvaluated: string[];       // e.g. ['RULE-001', 'RULE-006']
  blockingReasons: string[];      // e.g. ['PAYMENT_ALREADY_PAID']
  policyVersion: string;          // e.g. 'v1'
  evaluatedAt: string;            // ISO timestamp
}

function evaluatePolicy(context: PolicyContext): PolicyResult
```

---

## The 10 Hard Rules (POLICY_RULES.md)

Evaluate in this order — first BLOCK or HUMAN_REVIEW terminates evaluation:

### RULE-001: Payment State
```
if payment.status IN [CAPTURED, SUCCESSFUL, PAID]:
  return BLOCK('PAYMENT_ALREADY_COMPLETED')
```
Always check latest known payment status. Never skip this rule.

### RULE-002: Active Session Required
```
if session.state IN [RECOVERED, STOPPED]:
  return BLOCK('RECOVERY_ALREADY_CLOSED')
```

### RULE-003: LLM Cannot Authorize Money Movement
AI output is a recommendation only. Never allow direct AI→executor path.
This is an architectural invariant, not a runtime rule.

### RULE-004: Low Confidence + High Risk
```
if ai.confidence < AI_CONFIDENCE_THRESHOLD AND action IN HIGH_RISK_ACTIONS:
  return HUMAN_REVIEW('LOW_CONFIDENCE_HIGH_RISK')
```
HIGH_RISK_ACTIONS = ['PAYMENT_LINK', 'MESSAGE', 'SAFE_RETRY'] (configurable)

### RULE-005: Customer Opt-Out
```
if customer.opted_out == true:
  return BLOCK('CUSTOMER_OPTED_OUT')
```
This blocks ALL communication channels: MESSAGE, EMAIL, VOICE, WHATSAPP.

### RULE-006: Retry Ceiling
```
if session.attempt_count >= MAX_RETRIES AND action == 'SAFE_RETRY':
  return BLOCK('RETRY_LIMIT_REACHED')
```

### RULE-007: Every External Action Requires Policy Approval
Architectural rule: no action executor may run without a PolicyDecision record
with decision = ALLOW. Enforce at the orchestrator level.

### RULE-008: Unknown/Unsupported Failure → No Aggressive Action
```
if diagnosis.failure_class == 'UNKNOWN':
  if action IN ['PAYMENT_LINK', 'MESSAGE', 'SAFE_RETRY']:
    return HUMAN_REVIEW('UNKNOWN_FAILURE_CLASS')
```

### RULE-009: Provider/Action Failure → Safe Fallback
Architectural rule: if provider call fails, record audit event, do not retry
blindly, do not duplicate the action. This is enforced in ActionExecutor.

### RULE-010: Close Workflow When Recovery Satisfied
```
if payment.status IN [CAPTURED, PAID] AND session.state != 'RECOVERED':
  forceTransition(session, 'RECOVERED')
  return BLOCK('ALREADY_RECOVERED')
```

---

## Outreach Rules (additive to hard rules above)

A communication action is allowed only when ALL are true:
```
payment status != PAID
AND customer.opted_out == false
AND session.communication_count < MAX_COMMUNICATIONS
AND time_since_last_communication >= MIN_COMMUNICATION_INTERVAL_HOURS
AND channel is in allowed_channels
AND policy.decision == ALLOW
```

---

## Payment Link Rules

Allowed only when:
```
payment unpaid
AND recovery session active
AND customer not opted out
AND communication limits permit
AND policy allows payment-link recovery
```

---

## PTP Rules

```
if promise.confidence < PTP_CONFIDENCE_THRESHOLD:
  return HUMAN_REVIEW('AMBIGUOUS_PTP')
if promise.date is ambiguous:
  return HUMAN_REVIEW('AMBIGUOUS_PROMISE_DATE')
```

---

## Global Kill Switch

```typescript
if (!config.RECOVERY_AUTOMATION_ENABLED) {
  // Still allow: webhook ingestion, payment observation, audit, dashboard
  // Block ALL new external recovery actions
  return BLOCK('RECOVERY_AUTOMATION_DISABLED');
}
```

---

## High-Value Threshold

```
if payment.amount > HIGH_VALUE_THRESHOLD AND ai.confidence < HIGH_VALUE_CONFIDENCE_THRESHOLD:
  return HUMAN_REVIEW('HIGH_VALUE_LOW_CONFIDENCE')
```

---

## Action Matrix (from POLICY_RULES.md §17)

| Condition | Retry | Payment Link | Message | Human Review |
|---|---|---|---|---|
| Technical + eligible | ALLOW | optional | optional | — |
| Business + eligible | usually BLOCK | ALLOW | ALLOW | — |
| Authentication | BLOCK | conditional | ALLOW | conditional |
| Unknown failure | BLOCK | BLOCK | BLOCK | ALLOW |
| Low AI confidence | conditional | conditional | conditional | usually ALLOW |
| Already paid | BLOCK | BLOCK | BLOCK | — |
| Opted out | BLOCK | BLOCK | BLOCK | — |
| Retry limit reached | BLOCK | conditional | conditional | conditional |
| Communication limit reached | n/a | BLOCK | BLOCK | conditional |

---

## PolicyDecision Must Be Persisted

Every call to `evaluatePolicy()` that results in action execution must persist:

```typescript
{
  id: uuid(),
  recovery_session_id: session.id,
  action_id: action.id,
  decision: 'ALLOW' | 'BLOCK' | 'HUMAN_REVIEW',
  rules_evaluated: ['RULE-001', ...],
  blocking_reasons: [...],
  policy_version: 'v1',
  created_at: new Date(),
}
```

---

## Testing Requirements

```
✓ RULE-001: payment paid → BLOCK (even with AI confidence 0.99)
✓ RULE-002: terminal session → BLOCK
✓ RULE-004: low confidence + high-risk → HUMAN_REVIEW
✓ RULE-005: opted-out → BLOCK all communication
✓ RULE-006: retry ceiling → BLOCK SAFE_RETRY
✓ RULE-008: unknown failure → HUMAN_REVIEW (not autonomous action)
✓ Kill switch off → BLOCK all external actions
✓ High-value + low confidence → HUMAN_REVIEW
✓ Communication limit reached → BLOCK outreach
✓ All BLOCK decisions produce an audit event
✓ ALLOW decision produces persisted PolicyDecision record
✓ Policy version stored in every decision
```

---

## What NOT to Do

- Do NOT let AI output directly trigger execution without policy evaluation
- Do NOT scatter policy checks across routes/controllers
- Do NOT hardcode thresholds in policy logic — read from config
- Do NOT silently swallow BLOCK decisions — always audit them
- Do NOT allow a client-provided `"policy": "ALLOW"` to override server-side evaluation

---

## References

- Full policy rules: `docs/POLICY_RULES.md`
- AI contract: `docs/AI_CONTRACT.md`
- State machine guards: `docs/STATE_MACHINE.md` §13
