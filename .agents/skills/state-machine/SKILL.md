---
name: state-machine
description: >-
  Use this skill when implementing, modifying, or testing the RecoverySession
  state machine for the AI Revenue Recovery MVP. Covers deterministic
  transition tables, entry/exit guards, global overrides, idempotency,
  illegal-transition rejection, terminal-state protection, and race-condition
  handling. This skill is authoritative for how recovery state changes.
---

# State Machine Engineering Skill

## Purpose

The recovery state machine is the **control plane** of the system.
AI recommends. Policy authorizes. The state machine controls what transitions
are allowed and when.

---

## Implementation Pattern

Use an **explicit transition table** — NOT a framework, NOT scattered `if/else` flags.

```typescript
// Canonical pattern
const TRANSITIONS: Record<RecoveryState, RecoveryState[]> = {
  AT_RISK:         ['DIAGNOSING', 'STOPPED'],
  DIAGNOSING:      ['SAFE_RETRY', 'OUTREACH', 'PTP_WAIT', 'HUMAN_REVIEW', 'STOPPED', 'RECOVERED'],
  SAFE_RETRY:      ['PAYMENT_PENDING', 'OUTREACH', 'ESCALATED', 'STOPPED'],
  OUTREACH:        ['PAYMENT_PENDING', 'PTP_WAIT', 'ESCALATED', 'STOPPED'],
  PAYMENT_PENDING: ['RECOVERED', 'OUTREACH', 'ESCALATED', 'STOPPED'],
  PTP_WAIT:        ['RECOVERED', 'OUTREACH', 'ESCALATED', 'STOPPED'],
  HUMAN_REVIEW:    ['OUTREACH', 'SAFE_RETRY', 'ESCALATED', 'STOPPED'],
  ESCALATED:       ['HUMAN_REVIEW', 'RECOVERED', 'STOPPED'],
  RECOVERED:       [],   // terminal
  STOPPED:         [],   // terminal
};
```

`transition(session, toState, event)` must:
1. Check transition is in allowed set → throw `InvalidTransitionError` if not
2. Check global guards (payment status, opt-out, limits, confidence)
3. If any guard fails → block and audit
4. Apply transition and persist atomically
5. Write audit event

---

## Global Guards (apply before ANY external action)

Run these in order — first failure wins:

| Guard | Condition | Result |
|---|---|---|
| Payment status | `payment.status == PAID/CAPTURED` | → RECOVERED, block outreach |
| Opt-out | `customer.opted_out == true` | → STOPPED |
| Retry limit | `session.attempt_count >= MAX_RETRIES` | → STOPPED or ESCALATED |
| Communication limit | `session.communication_count >= MAX_COMMUNICATIONS` | → STOPPED or ESCALATED |
| Confidence | `ai.confidence < threshold AND high_risk_action` | → HUMAN_REVIEW |
| Policy | `policy.decision != ALLOW` | → block execution |

---

## Terminal State Protection

```typescript
const TERMINAL_STATES = new Set(['RECOVERED', 'STOPPED']);

if (TERMINAL_STATES.has(session.state)) {
  throw new InvalidTransitionError(
    `Cannot transition from terminal state ${session.state}`
  );
}
```

This check must run **before** any business logic, not after.

---

## Idempotent Transition

Before applying a transition, check if it's already in the target state:

```typescript
if (session.state === targetState) {
  return session; // idempotent — already there
}
```

For external actions (payment link creation, retry), use an idempotency key:
```
${recovery_session_id}:${action_type}:${attempt_number}
```

Check this key before executing any provider call.

---

## Race Conditions

### Race A — Payment during outreach
Always re-check payment status immediately before sending outreach.
If payment status = PAID → transition to RECOVERED, cancel outreach.

### Race B — Duplicate webhook
Use `source_event_id` as DB unique key. Duplicate → return 200, do nothing.

### Race C — Two workers same recovery
Enforce `UNIQUE(customer_id, payment_id)` at DB level for active sessions.
Second worker gets constraint violation → exits safely.

### Race D — Payment during action execution
Check for existing active action with idempotency key before executing.
If already executing → do not duplicate.

---

## Audit on Every Transition

Every state change must write an `AuditEvent`:

```typescript
{
  event_type: 'STATE_TRANSITION',
  recovery_session_id: session.id,
  from: previousState,
  to: newState,
  trigger: event.type,
  reason: decision.reason,
  policy_decision: policyResult.decision,
  timestamp: new Date().toISOString(),
}
```

Blocked transitions must also be audited:
```typescript
{ event_type: 'TRANSITION_BLOCKED', reason: 'PAYMENT_ALREADY_PAID', ... }
```

---

## Configuration (never hardcode)

```env
MAX_RETRIES=3
MAX_COMMUNICATIONS=5
MIN_COMMUNICATION_INTERVAL_HOURS=24
AI_CONFIDENCE_THRESHOLD=0.70
PTP_CONFIDENCE_THRESHOLD=0.80
PAYMENT_OBSERVATION_WINDOW_HOURS=48
```

Read from config at runtime. Do not embed these numbers in transition logic.

---

## Testing Requirements

Every transition MUST have a test. Minimum test categories:

```
✓ All valid transitions (happy path)
✓ All invalid transitions (must throw InvalidTransitionError)
✓ Terminal state → any transition (must throw)
✓ Payment paid during outreach (must cancel outreach, → RECOVERED)
✓ Duplicate webhook (idempotent, no duplicate session)
✓ Retry limit reached (→ STOPPED or ESCALATED)
✓ Communication limit reached (→ STOPPED or ESCALATED)
✓ Low-confidence AI + high-risk action (→ HUMAN_REVIEW)
✓ Global kill switch off (→ BLOCK all external actions)
✓ Opt-out during active session (→ STOPPED immediately)
✓ RECOVERED → any action (must throw)
✓ STOPPED → any automatic action (must throw)
```

---

## What NOT to Do

- Do NOT scatter state transitions across HTTP handlers or controllers
- Do NOT use `is_failed`, `is_contacted`, `is_retrying` boolean flags
- Do NOT let AI directly mutate `session.state`
- Do NOT allow `RECOVERED → OUTREACH` even if AI recommends it
- Do NOT use a heavyweight state machine library unless the project already uses one
- Do NOT put configuration thresholds inside transition logic

---

## References

- Full spec: `docs/STATE_MACHINE.md`
- Domain model: `docs/DOMAIN_MODEL.md` §7–9
