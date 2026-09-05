# API_CONTRACT.md — AI Revenue Recovery MVP

## 1. Purpose

This document defines the API contract between the frontend, recovery engine, demo simulator, and external integrations.

The API must expose the recovery system without exposing internal implementation details.

Core rule:

```text
Frontend → API → Application/Domain → Infrastructure
```

The frontend must never directly call:

```text
Razorpay
LLM
database
notification provider
```

---

# 2. API Conventions

## Base path

```text
/api
```

## Response format

Successful response:

```json
{
  "data": {},
  "error": null
}
```

Error response:

```json
{
  "data": null,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable message"
  }
}
```

Do not expose stack traces or provider secrets.

---

# 3. Recovery APIs

## GET /api/recovery

Returns the recovery queue.

### Query parameters

```text
state
failure_class
attribution
min_risk
limit
offset
```

### Example

```json
{
  "data": {
    "items": [
      {
        "id": "rec_123",
        "customer_id": "cus_123",
        "payment_id": "pay_123",
        "state": "OUTREACH",
        "risk_score": 87,
        "recovery_probability": 0.78,
        "amount_at_risk": 12000,
        "expected_recoverable_revenue": 9360
      }
    ],
    "total": 1
  },
  "error": null
}
```

---

# 4. GET /api/recovery/:id

Returns the complete recovery session.

Must include enough information for the UI to explain:

```text
What happened?
Why is this revenue at risk?
What did AI recommend?
What did policy decide?
What action happened?
What happened afterward?
Was money recovered?
How was it attributed?
```

### Response

```json
{
  "data": {
    "id": "rec_123",
    "state": "RECOVERED",

    "customer": {
      "id": "cus_123",
      "name": "Demo Customer"
    },

    "payment": {
      "id": "pay_123",
      "amount": 12000,
      "currency": "INR",
      "status": "CAPTURED",
      "failure_class": "BUSINESS"
    },

    "risk": {
      "score": 87,
      "recovery_probability": 0.78,
      "expected_recoverable_revenue": 9360
    },

    "diagnosis": {
      "class": "BUSINESS",
      "confidence": 0.96,
      "reason_codes": [
        "INSUFFICIENT_FUNDS"
      ]
    },

    "recommendation": {
      "action": "PAYMENT_LINK",
      "confidence": 0.94,
      "reason": "Customer can complete payment through an alternate path."
    },

    "policy": {
      "decision": "ALLOW",
      "blocking_reasons": []
    },

    "actions": [],

    "outcome": {
      "result": "PAYMENT_RECOVERED",
      "amount_recovered": 12000,
      "attribution": "DIRECT"
    },

    "audit": []
  },
  "error": null
}
```

---

# 5. POST /api/recovery/:id/retry

Requests a retry of the recovery workflow.

The API must NOT blindly execute a retry.

Flow:

```text
request
→ latest payment check
→ policy
→ action execution
→ result
```

### Request

```json
{
  "reason": "manual_retry"
}
```

### Success

```json
{
  "data": {
    "action_id": "act_123",
    "action_type": "SAFE_RETRY",
    "status": "EXECUTED"
  },
  "error": null
}
```

### Already paid

```json
{
  "data": null,
  "error": {
    "code": "PAYMENT_ALREADY_COMPLETED",
    "message": "Recovery action was not executed because payment is already complete."
  }
}
```

---

# 6. POST /api/recovery/:id/payment-link

Creates an approved recovery payment link.

### Flow

```text
request
→ payment state guard
→ policy engine
→ create payment link
→ persist action
→ return link
```

### Response

```json
{
  "data": {
    "action_id": "act_456",
    "status": "EXECUTED",
    "payment_link": "https://example.test/pay/abc",
    "expires_at": "..."
  },
  "error": null
}
```

The implementation may return a simulated link during demo mode.

---

# 7. POST /api/recovery/:id/outreach

Executes an approved communication action.

### Request

```json
{
  "channel": "SIMULATED",
  "template_id": "payment_recovery_v1"
}
```

The server must validate:

```text
opt-out
communication limit
minimum interval
payment status
policy
```

The client cannot override these constraints.

---

# 8. POST /api/recovery/:id/stop

Stops an active recovery session.

### Request

```json
{
  "reason": "manual_stop"
}
```

### Response

```json
{
  "data": {
    "id": "rec_123",
    "state": "STOPPED"
  },
  "error": null
}
```

This action must be auditable.

---

# 9. Dashboard APIs

## GET /api/dashboard/summary

Returns the primary business metrics.

```json
{
  "data": {
    "revenue_at_risk": 250000,
    "recovered_revenue": 87500,
    "incremental_recovered_revenue": 42000,
    "recovery_rate": 0.35,
    "net_recovery": 81000,
    "active_workflows": 23
  },
  "error": null
}
```

Do not hardcode these metrics.

They must be calculated from persisted domain data.

---

# 10. GET /api/dashboard/recovery

Returns recovery performance by category.

Example:

```json
{
  "data": {
    "by_failure_class": [
      {
        "failure_class": "TECHNICAL",
        "at_risk": 100000,
        "recovered": 35000,
        "recovery_rate": 0.35
      },
      {
        "failure_class": "BUSINESS",
        "at_risk": 150000,
        "recovered": 52500,
        "recovery_rate": 0.35
      }
    ]
  },
  "error": null
}
```

---

# 11. GET /api/dashboard/attribution

Returns:

```text
DIRECT
ASSISTED
ORGANIC
UNKNOWN
```

Example:

```json
{
  "data": {
    "direct": 50000,
    "assisted": 15000,
    "organic": 17500,
    "unknown": 5000
  },
  "error": null
}
```

---

# 12. GET /api/dashboard/audit

Returns recent audit events.

### Query parameters

```text
recovery_id
event_type
from
to
limit
```

Audit data should be read-only through the dashboard API.

---

# 13. Webhook API

## POST /webhooks/razorpay

This endpoint is provider-facing rather than frontend-facing.

Processing:

```text
receive raw body
      ↓
verify signature
      ↓
extract event ID
      ↓
idempotency check
      ↓
persist/process event
      ↓
acknowledge
```

Important:

The signature must be calculated against the raw request body.

Do not parse and reserialize the JSON before signature verification.

---

# 14. Webhook Response

Valid event:

```http
200 OK
```

Invalid signature:

```http
401 Unauthorized
```

Malformed request:

```http
400 Bad Request
```

Duplicate event:

```http
200 OK
```

A duplicate event should not be treated as a processing failure.

---

# 15. Demo APIs

The demo requires deterministic control over the environment.

## POST /api/demo/seed

Seeds the demo dataset.

### Request

```json
{
  "seed": 42,
  "count": 100
}
```

### Response

```json
{
  "data": {
    "customers_created": 100,
    "payments_created": 100,
    "recovery_opportunities": 42
  },
  "error": null
}
```

---

# 16. POST /api/demo/reset

Resets demo state.

This should clear or recreate:

```text
customers
payments
recovery sessions
actions
outcomes
audit events
experiment assignments
```

Do not affect production data.

---

# 17. POST /api/demo/simulate/failure

Creates a controlled failure.

### Request

```json
{
  "customer_id": "cus_demo_1",
  "amount": 12000,
  "failure_class": "BUSINESS",
  "failure_code": "insufficient_funds"
}
```

The simulator should generate the same normalized event path as a real provider event.

---

# 18. POST /api/demo/simulate/payment

Simulates successful payment.

### Request

```json
{
  "payment_id": "pay_demo_1",
  "route": "RECOVERY_LINK"
}
```

The resulting payment event must flow through the same outcome/attribution engine.

---

# 19. POST /api/demo/simulate/ptp

Creates a deterministic PTP event.

### Request

```json
{
  "recovery_id": "rec_demo_1",
  "promised_date": "2026-09-10",
  "source_text": "I'll pay on Thursday."
}
```

---

# 20. POST /api/demo/simulate/optout

Simulates customer opt-out.

```json
{
  "recovery_id": "rec_demo_1"
}
```

Expected:

```text
OUTREACH
→ STOPPED
```

---

# 21. Experiment APIs

## POST /api/demo/experiment

Runs the batch experiment.

### Request

```json
{
  "seed": 42,
  "control_size": 50,
  "treatment_size": 50
}
```

### Response

```json
{
  "data": {
    "experiment_id": "exp_123",
    "control": {
      "count": 50,
      "recovered": 12,
      "recovery_rate": 0.24,
      "recovered_revenue": 18000
    },
    "treatment": {
      "count": 50,
      "recovered": 19,
      "recovery_rate": 0.38,
      "recovered_revenue": 31000
    },
    "incremental_recovered_revenue": 13000,
    "roi": 4.2
  },
  "error": null
}
```

The values above are examples only.

The implementation must calculate real values from the experiment data.

---

# 22. API Error Codes

Recommended codes:

```text
INVALID_REQUEST
UNAUTHORIZED
FORBIDDEN
NOT_FOUND

PAYMENT_ALREADY_COMPLETED
RECOVERY_ALREADY_CLOSED
RECOVERY_NOT_ACTIVE

POLICY_BLOCKED
HUMAN_REVIEW_REQUIRED

RETRY_LIMIT_REACHED
COMMUNICATION_LIMIT_REACHED
CUSTOMER_OPTED_OUT

DUPLICATE_EVENT
DUPLICATE_ACTION

PROVIDER_ERROR
AI_ERROR
INTERNAL_ERROR
```

Error codes should be stable even if internal implementation changes.

---

# 23. API Authorization Boundary

The frontend may request an action.

It may not authorize an action.

Example:

```text
Frontend:
POST /recovery/123/payment-link

Server:
check payment
check policy
check limits
execute
```

Never accept:

```json
{
  "policy": "ALLOW"
}
```

from the client as authoritative.

---

# 24. API and State Machine

API endpoints must respect the state machine.

For example:

```text
POST /retry
```

must fail if:

```text
RECOVERED
STOPPED
```

unless explicitly reopened by an authorized workflow.

Similarly:

```text
POST /outreach
```

must fail/block if:

```text
PAYMENT_ALREADY_COMPLETED
CUSTOMER_OPTED_OUT
COMMUNICATION_LIMIT_REACHED
POLICY_BLOCKED
```

---

# 25. API and Audit

Every mutation must produce an audit trail.

At minimum:

```text
API request
→ policy decision
→ action
→ result
```

For example:

```text
POST /payment-link
      ↓
PAYMENT_STATE_CHECK
      ↓
POLICY_EVALUATED
      ↓
ACTION_EXECUTED
      ↓
PAYMENT_LINK_CREATED
```

---

# 26. API Contract Rules

The implementation agent must follow these rules:

1. Never expose secrets.
2. Never trust client-provided policy decisions.
3. Never mark revenue recovered from a requested action alone.
4. Always check current payment state before customer-facing recovery actions.
5. Keep provider-specific payloads behind adapters.
6. Make mutations idempotent where external side effects are possible.
7. Return stable error codes.
8. Keep dashboard metrics derived from persisted data.
9. Keep demo endpoints isolated from production behavior.
10. Do not invent endpoints unless necessary.

---

# 27. API Definition of Done

- [ ] Recovery queue API exists.
- [ ] Recovery detail API exists.
- [ ] Action endpoints respect policy.
- [ ] Dashboard metrics are data-driven.
- [ ] Audit API exists.
- [ ] Razorpay webhook endpoint validates signatures.
- [ ] Duplicate webhooks are safe.
- [ ] Demo seed/reset exists.
- [ ] Demo failure/payment simulation exists.
- [ ] Batch experiment endpoint exists.
- [ ] Stable error codes exist.
- [ ] Frontend cannot bypass policy.
- [ ] All state-changing operations are auditable.
