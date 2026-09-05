# Dashboard Plan — AI Revenue Recovery

> A financial control room that proves the system is a real bounded recovery
> engine, not a notification tool. Every screen must answer: **what revenue is
> at risk, what the AI decided, what policy allowed, what happened, and what
> was recovered.**

---

## Design Principles

1. **Financial control room, not a chat app** — lead with money, not messages.
2. **Decision trace is the hero** — every recovery session must show the full
   chain: failure → diagnosis → risk → AI rec → policy → action → outcome → attribution.
3. **Demo isolation** — demo data and live data are visually separated. Demo
   sessions are badged `DEMO` and can be reset without affecting live sessions.
4. **Auditability** — every number on the dashboard must be traceable to an
   audit event. No fabricated metrics.
5. **Real-time** — auto-refresh every 5 seconds for active sessions.
6. **Policy transparency** — guardrail violations and blocked actions are
   first-class citizens, not hidden in logs.

---

## Mode Isolation

### Demo Mode vs Live Mode

The dashboard must clearly indicate which mode the system is running in and
isolate the data visually.

| Aspect | Demo Mode | Live Mode |
|--------|-----------|-----------|
| Badge | `DEMO` (amber) in header | `LIVE` (green) in header |
| Data source | Simulator adapter | Razorpay adapter |
| Data badge | Each session/action shows `DEMO` tag | No demo tag |
| Reset | "Reset Demo Data" button enabled | Reset button hidden/disabled |
| Webhook source | `simulator` | `razorpay` |
| Warning banner | "Demo mode — data is simulated" | None |

### Implementation

- Read `DEMO_MODE` from the `/health` or `/ready` endpoint response.
- Filter sessions by `is_demo` flag: `is_demo=true` for demo, `is_demo=false` for live.
- Dashboard toggle: "Show Demo Data" / "Show Live Data" switch (if both exist).
- Demo control panel only visible in demo mode.

---

## Page Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Header: Logo | Mode Badge | Nav | API Status           │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Page 1: Financial Control Room (Dashboard)             │
│  Page 2: Recovery Queue                                 │
│  Page 3: Recovery Detail + Decision Trace               │
│  Page 4: Experiment Results                             │
│  Page 5: Demo Control Panel                             │
│  Page 6: Webhook Monitor (new)                          │
│  Page 7: PTP Manager (new)                              │
│                                                         │
├─────────────────────────────────────────────────────────┤
│  Footer: Version | Model | Policy Version | Build       │
└─────────────────────────────────────────────────────────┘
```

---

## Page 1: Financial Control Room (Dashboard)

> The first screen. Answers "how much money are we recovering?"

### 1A. Headline Metrics (top row, 6 cards)

| Card | Value | Source | Format |
|------|-------|--------|--------|
| Revenue at Risk | Sum of `expected_recoverable_revenue` for active sessions | `GET /api/dashboard/metrics` | INR (e.g. ₹2.4L) |
| Recovered Revenue | Sum of `amount_recovered` for all outcomes | Same | INR |
| Incremental Recovery | DIRECT + ASSISTED recovered revenue | Same | INR |
| Recovery Rate | Recovered / Total outcomes | Same | Percentage |
| Active Workflows | Count of open sessions | Same | Integer |
| Net Recovery ROI | Incremental / estimated recovery cost | Derived | Multiplier (e.g. 3.2x) |

Each card shows:
- Big number (current value)
- Sub-label (full amount or context)
- Trend indicator (up/down arrow vs. previous refresh)
- Color: red for at-risk, green for recovered, indigo for incremental, blue for rate, purple for active, emerald for ROI

### 1B. Secondary Panels (3-column grid)

#### Panel 1: Failures by Type (bar chart)

Horizontal bars for each diagnosis class:
- TECHNICAL (blue)
- BUSINESS (amber)
- AUTHENTICATION (purple)
- ABANDONMENT (gray)
- RECURRING_PAYMENT_FAILURE (orange)
- UNKNOWN (red)

Source: `GET /api/dashboard/failures-by-type`

#### Panel 2: Recovery Funnel (stage flow)

Visual funnel showing session count at each state:

```
AT_RISK (12) → DIAGNOSING (3) → OUTREACH (5) → PTP_WAIT (2) → RECOVERED (8)
                                                              → STOPPED (2)
                                                              → ESCALATED (1)
```

Source: `GET /api/dashboard/recovery-funnel`

Each state is a pill with count, colored by `stateColor()`:
- AT_RISK: gray
- DIAGNOSING: blue
- SAFE_RETRY: cyan
- OUTREACH: amber
- PAYMENT_PENDING: indigo
- PTP_WAIT: purple
- RECOVERED: green
- ESCALATED: orange
- STOPPED: red
- HUMAN_REVIEW: yellow

#### Panel 3: Attribution Breakdown (stacked bar or donut)

Four segments:
- DIRECT (green) — AI-generated recovery link was used
- ASSISTED (blue) — qualifying intervention, paid through another route
- ORGANIC (gray) — paid without intervention
- UNKNOWN (amber) — insufficient evidence

Show amount + percentage for each.

Source: `GET /api/dashboard/metrics` → `attribution_breakdown`

### 1C. Best Interventions (table)

| Action | Total | Succeeded | Success Rate | Avg Revenue Recovered |
|--------|-------|-----------|--------------|-----------------------|
| PAYMENT_LINK | 15 | 8 | 53% | ₹1.2L |
| MESSAGE | 22 | 5 | 23% | ₹0.4L |
| SAFE_RETRY | 8 | 6 | 75% | ₹0.8L |
| PTP_WAIT | 4 | 2 | 50% | ₹0.3L |

Source: `GET /api/dashboard/best-interventions`

### 1D. Guardrail Events (scrollable list)

Recent policy blocks and guardrail triggers:

| Time | Session | Event | Reason |
|------|---------|-------|--------|
| 14:32 | ses_abc... | POLICY_BLOCKED | RULE-001: Payment already captured |
| 14:28 | ses_def... | POLICY_BLOCKED | RULE-005: Customer opted out |
| 14:15 | ses_ghi... | TRANSITION_BLOCKED | Terminal state RECOVERED |

Source: `GET /api/dashboard/guardrail-events`

Each row is clickable → navigates to the recovery detail page.

### 1E. Audit Timeline (scrollable feed)

Real-time feed of all audit events (most recent first):

| Time | Event Type | Session | Customer | Details |
|------|-----------|---------|----------|---------|
| 14:35 | ACTION_EXECUTED | ses_abc... | cust_xyz... | PAYMENT_LINK succeeded |
| 14:34 | POLICY_DECISION | ses_abc... | cust_xyz... | ALLOW |
| 14:33 | AI_RECOMMENDATION | ses_abc... | cust_xyz... | PAYMENT_LINK (0.82) |
| 14:32 | STATE_TRANSITION | ses_abc... | cust_xyz... | DIAGNOSING → OUTREACH |
| 14:31 | WEBHOOK_RECEIVED | ses_abc... | cust_xyz... | payment.failed |

Source: `GET /api/dashboard/audit-timeline`

Auto-refresh every 5 seconds. New events fade in at top.

---

## Page 2: Recovery Queue

> The work queue. Answers "what needs attention right now?"

### 2A. Filter Bar

- State filter: All / AT_RISK / DIAGNOSING / OUTREACH / PTP_WAIT / ESCALATED / HUMAN_REVIEW
- Diagnosis filter: All / TECHNICAL / BUSINESS / AUTHENTICATION / ABANDONMENT / UNKNOWN
- Sort: Revenue at Risk (desc) / Risk Score (desc) / Created (newest) / State
- Search: by customer ID, payment ID, or session ID
- Demo/Live toggle: show only demo, only live, or all

### 2B. Queue Table

| Revenue at Risk | Customer | Payment | State | Diagnosis | Risk | AI Rec | Confidence | Attempts | Comms | Created | Demo |
|----------------|----------|---------|-------|-----------|------|--------|------------|----------|-------|---------|------|
| ₹50,000 | cust_abc | pay_xyz | OUTREACH | BUSINESS | 72 | PAYMENT_LINK | 82% | 1 | 1 | 2m ago | DEMO |
| ₹25,000 | cust_def | pay_uvw | PTP_WAIT | BUSINESS | 45 | PTP_WAIT | 85% | 1 | 2 | 5m ago | — |
| ₹10,000 | cust_ghi | pay_rst | HUMAN_REVIEW | UNKNOWN | 90 | HUMAN_REVIEW | 60% | 0 | 0 | 10m ago | DEMO |

- Revenue at Risk column is bold and colored (red for high, amber for medium, gray for low)
- State is a colored badge
- AI Rec is a badge with the action type
- Confidence is a mini progress bar
- Row click → navigate to Recovery Detail page
- "Demo" badge in amber if `is_demo=true`

Source: `GET /api/recovery?limit=50&offset=0`

### 2C. Quick Actions (per row, on hover)

- **View Trace** → navigate to detail page
- **Sync Payment** → `POST /api/recovery/:id/sync-payment`
- **Execute Action** → `POST /api/recovery/:id/actions` (dropdown of allowed actions)
- **Add PTP Reply** → opens PTP reply modal

---

## Page 3: Recovery Detail + Decision Trace

> The hero page. Answers "what exactly happened in this recovery?"

### 3A. Session Header

```
[← Back]  Recovery Session: ses_abc123...    [OUTREACH]  [DEMO]
          Customer: cust_xyz...    Payment: pay_def...
          Created: 2m ago    Last action: 30s ago
```

### 3B. Decision Trace (vertical timeline — the hero panel)

This is the visual proof of the bounded recovery loop. Each step is a node
connected by a vertical line:

```
  ●─── Payment Failed
  │     ₹500 at risk · customer cust_xyz · UPI · insufficient_funds
  │
  ●─── Diagnosis
  │     BUSINESS (95% confidence)
  │     Deterministic map: insufficient_funds → BUSINESS
  │
  ●─── Risk Assessment
  │     Risk Score: 72/100
  │     P(Recovery): 60%
  │     Expected Recoverable: ₹240
  │
  ●─── AI Recommendation
  │     Action: PAYMENT_LINK (82% confidence)
  │     Model: minimax/minimax-m3:free
  │     Is fallback: false
  │     Reason codes: BUSINESS_FAILURE_REQUIRES_CUSTOMER_ACTION,
  │                   TOP_UP_LIKELY_NEEDED, HIGH_RECOVERY_PROBABILITY_0.60
  │     Message: "Hi! Your recent payment of ₹500 didn't go through..."
  │     [Show full AI recommendation JSON in expandable section]
  │
  ●─── Policy Decision
  │     ALLOW
  │     Rules evaluated: RULE-KILL-SWITCH, RULE-001, RULE-005, RULE-006,
  │                       RULE-COMM-COUNT, RULE-HIGH-VALUE, RULE-004, RULE-008
  │     Blocking reasons: (none)
  │     [Show full policy decision JSON in expandable section]
  │
  ●─── Action Executed
  │     PAYMENT_LINK → SUCCEEDED
  │     Provider reference: plink_abc123
  │     Message sent: "Please complete your payment of ₹500.00 here: https://..."
  │     Executed at: 14:35:22
  │
  ●─── Outcome
  │     PAYMENT_RECOVERED
  │     Amount: ₹500
  │     Attribution: DIRECT
  │     Evidence: Payment completed through agent-generated recovery link
  │
  ●─── Session Closed
        Closed at: 14:42:10
        Closure reason: PAYMENT_RECOVERED
```

Source: `GET /api/recovery/:id/trace`

### 3C. AI Recommendation Detail (expandable card)

Full AI output with all fields:

```
┌─────────────────────────────────────────────┐
│  AI Recommendation                          │
│                                             │
│  Diagnosis:     BUSINESS                    │
│  Confidence:    0.95                        │
│  Reason codes:  [BUSINESS_FAILURE_...]      │
│                                             │
│  Recovery:                                  │
│  Probability:   0.60                        │
│  Confidence:    0.78                        │
│                                             │
│  Recommendation:                            │
│  Action:        PAYMENT_LINK                │
│  Confidence:    0.82                        │
│  Reason codes:  [TOP_UP_LIKELY_NEEDED, ...] │
│                                             │
│  Message:                                   │
│  Text:         "Hi! Your recent payment..." │
│  Tone:         HELPFUL                      │
│                                             │
│  Requires human review: false               │
│  Model:         minimax/minimax-m3:free     │
│  Prompt version: recommendation-v1          │
│  Is fallback:   false                       │
└─────────────────────────────────────────────┘
```

### 3D. Policy Decision Detail (expandable card)

```
┌─────────────────────────────────────────────┐
│  Policy Decision                            │
│                                             │
│  Decision: ALLOW                            │
│  Policy version: 1.0.0                      │
│                                             │
│  Rules Evaluated:                           │
│  ✓ RULE-KILL-SWITCH    → pass (system on)   │
│  ✓ RULE-001            → pass (not paid)     │
│  ✓ RULE-005            → pass (not opted out)│
│  ✓ RULE-006            → pass (retries < 3)  │
│  ✓ RULE-COMM-COUNT     → pass (comms < 5)    │
│  ✓ RULE-HIGH-VALUE     → pass (< ₹50k)       │
│  ✓ RULE-004            → pass (conf > 0.70)  │
│  ✓ RULE-008            → pass (known failure)│
│                                             │
│  Blocking reasons: (none)                   │
└─────────────────────────────────────────────┘
```

### 3E. PTP Records (if any)

If the session has PTP records, show them:

```
┌─────────────────────────────────────────────┐
│  Promise to Pay                             │
│                                             │
│  Promised date:   Sept 10, 2026             │
│  Promised amount: ₹500                       │
│  Confidence:      0.85                      │
│  Source:          TEXT                      │
│  Status:          ACTIVE                    │
│  Source text:     "I promise to pay on..."  │
│  Created:         Sept 5, 2026 14:04        │
│                                             │
│  [Mark as Missed]  [Mark as Fulfilled]      │
└─────────────────────────────────────────────┘
```

Source: `GET /api/recovery/:id/ptp`

### 3F. Audit Timeline (per session)

Vertical timeline of all audit events for this session, with:
- Event type
- Timestamp
- Payload (expandable JSON)
- Hash chain verification (show hash + previous hash)

Source: `GET /api/recovery/:id/trace` → `audit_events`

### 3G. Action Buttons

- **Sync Payment** — re-check payment status from provider
- **Execute Manual Action** — dropdown: MESSAGE, PAYMENT_LINK, SAFE_RETRY, ESCALATE, STOP
- **Add PTP Reply** — opens modal with text input and source selector
- **Close Session** — manual close with reason

---

## Page 4: Experiment Results

> Proves incremental recovery. Answers "does the AI actually recover more?"

### 4A. Experiment Setup Panel

```
┌─────────────────────────────────────────────┐
│  Run Batch Experiment                       │
│                                             │
│  Seed:          [42]                        │
│  Control size:  [500]                       │
│  Treatment size:[500]                       │
│                                             │
│  [Run Experiment]                           │
└─────────────────────────────────────────────┘
```

Source: `POST /api/demo/experiment`

### 4B. Experiment Results (side-by-side comparison)

| Metric | Control | AI Treatment | Lift |
|--------|---------|-------------|------|
| Transactions | 500 | 500 | — |
| Revenue at Risk | ₹25L | ₹25L | — |
| Recovered Revenue | ₹2.5L | ₹4.8L | +92% |
| Recovery Rate | 10% | 19.2% | +9.2pp |
| Incremental Revenue | — | ₹2.3L | — |
| AI-Attributed Revenue | — | ₹2.1L | — |
| Recovery Cost | ₹0 | ₹0.15L | — |
| Net Recovery | ₹2.5L | ₹4.65L | +86% |
| ROI | — | 15.3x | — |
| Guardrail Violations | 0 | 0 | — |
| False Outreach | 0 | 2 | — |

### 4C. Recovery Rate Chart

Bar chart comparing control vs treatment recovery rates over time.

### 4D. Attribution Breakdown (treatment group only)

Donut chart: DIRECT / ASSISTED / ORGANIC / UNKNOWN for the treatment group.

---

## Page 5: Demo Control Panel

> Only visible in demo mode. Controls the simulator.

### 5A. Demo Status

```
┌─────────────────────────────────────────────┐
│  Demo Status                                │
│                                             │
│  Mode:           DEMO (simulator adapter)   │
│  Seed:           42                         │
│  Compress delays: true                      │
│  Active sessions: 5                         │
│  Total sessions:  12                        │
│                                             │
│  [Reset Demo Data]                          │
│  [Seed 50 Transactions]                     │
└─────────────────────────────────────────────┘
```

### 5B. Simulate Events

```
┌──────────────────────────────────────────────┐
│  Simulate Payment Failure                    │
│                                              │
│  Amount:       [50000]  (in paise)           │
│  Currency:     [INR]                         │
│  Error code:   [insufficient_funds ▾]        │
│  Method:       [upi ▾]                       │
│                                              │
│  [Simulate Failure]                          │
└──────────────────────────────────────────────┘

┌──────────────────────────────────────────────┐
│  Simulate Payment Success                    │
│                                              │
│  Session ID:  [ses_abc... ▾]                 │
│                                              │
│  [Simulate Payment]                          │
└──────────────────────────────────────────────┘

┌──────────────────────────────────────────────┐
│  Simulate PTP                                │
│                                              │
│  Session ID:  [ses_abc... ▾]                 │
│  PTP date:    [2026-09-10]                   │
│                                              │
│  [Simulate PTP]                              │
└──────────────────────────────────────────────┘

┌──────────────────────────────────────────────┐
│  Simulate Opt-Out                            │
│                                              │
│  Session ID:  [ses_abc... ▾]                 │
│                                              │
│  [Simulate Opt-Out]                          │
└──────────────────────────────────────────────┘
```

### 5C. Send Test Webhook

```
┌──────────────────────────────────────────────┐
│  Send Test Webhook                           │
│                                              │
│  Event type:  [payment.failed ▾]             │
│  Target URL:  [auto-detected]                │
│                                              │
│  [Send Test Webhook]                         │
│  [Use scripts/test-webhook.js]               │
└──────────────────────────────────────────────┘
```

Event types: payment.failed, payment.captured, payment.authorized,
subscription.payment_failed, subscription.charged, payment.link.paid

---

## Page 6: Webhook Monitor (new)

> Shows incoming webhooks in real-time. Proves the system is live.

### 6A. Webhook Stats

| Metric | Value |
|--------|-------|
| Total received | 42 |
| Signature verified | 42 |
| Signature rejected | 0 |
| Duplicate (idempotent skip) | 3 |
| Processing errors | 1 |
| Last received | 2m ago |

### 6B. Webhook Event Log

| Time | Event ID | Event Type | Status | Session | Source |
|------|----------|-----------|--------|---------|--------|
| 14:35 | evt_abc... | payment.failed | PROCESSED | ses_xyz... | razorpay |
| 14:32 | evt_def... | payment.captured | PROCESSED | ses_xyz... | razorpay |
| 14:30 | evt_ghi... | payment.failed | DUPLICATE | — | razorpay |
| 14:28 | evt_jkl... | payment.failed | REJECTED | — | razorpay |

Status badges:
- PROCESSED (green)
- DUPLICATE (gray)
- REJECTED (red — invalid signature)
- ERROR (amber — processing failed)

Source: New endpoint `GET /api/webhooks/events` (reads from `webhook_events` table)

### 6C. Webhook Detail (expandable)

Click a row to see:
- Full raw payload (JSON, expandable)
- Signature verification result
- Processing timeline
- Normalized event data
- Created session/action links

---

## Page 7: PTP Manager (new)

> Manages all promises to pay across sessions.

### 7A. PTP Summary

| Metric | Value |
|--------|-------|
| Active PTPs | 3 |
| Fulfilled | 8 |
| Missed | 2 |
| Ambiguous | 1 |
| Total promised amount | ₹1.5L |

### 7B. PTP Table

| Promised Date | Customer | Session | Amount | Confidence | Source | Status | Days Until |
|---------------|----------|---------|--------|------------|--------|--------|------------|
| Sept 10 | cust_abc | ses_xyz | ₹500 | 85% | TEXT | ACTIVE | 5 days |
| Sept 8 | cust_def | ses_uvw | ₹1,200 | 90% | TEXT | ACTIVE | 3 days |
| Sept 3 | cust_ghi | ses_rst | ₹800 | 92% | TEXT | MISSED | -2 days |

- ACTIVE + past date → highlighted red (missed, needs follow-up)
- ACTIVE + future date → highlighted green (waiting)
- FULFILLED → gray
- MISSED → red with "Resume Outreach" button

### 7C. PTP Reply Input

```
┌──────────────────────────────────────────────┐
│  Add Customer Reply                          │
│                                              │
│  Session ID:  [ses_abc... ▾]                 │
│  Reply text:  [I'll pay on Friday..........] │
│  Source:      [TEXT ▾]                       │
│                                              │
│  [Extract PTP]                               │
└──────────────────────────────────────────────┘
```

Calls `POST /api/recovery/:id/ptp-reply` and shows the AI extraction result inline:

```
┌──────────────────────────────────────────────┐
│  PTP Extraction Result                       │
│                                              │
│  PTP detected:      true                     │
│  Promised date:     Sept 12, 2026            │
│  Confidence:        0.85                     │
│  Status:            ACTIVE                   │
│  Session state:     PTP_WAIT                 │
│                                              │
│  ✓ Promise recorded — outreach paused        │
└──────────────────────────────────────────────┘
```

Source: `POST /api/recovery/:id/ptp-reply`, `GET /api/recovery/:id/ptp`

---

## Header (all pages)

```
┌──────────────────────────────────────────────────────────────┐
│  [RR] AI Revenue Recovery    [LIVE] or [DEMO]                │
│       Financial Control Room                                  │
│                                                              │
│  [Dashboard] [Queue] [Experiment] [Webhooks] [PTP] [Demo]   │
│                                                              │
│  Model: minimax/minimax-m3:free  Policy: v1.0.0  ● Online   │
└──────────────────────────────────────────────────────────────┘
```

- Mode badge: `LIVE` (green) or `DEMO` (amber) — from `/health`
- Status indicator: green dot if healthy, red if down
- Model name: from last AI recommendation
- Policy version: from last policy decision
- Nav items with icons

## Footer (all pages)

```
AI Revenue Recovery MVP — Razorpay Buildathon Track 03
Build: 8a42d74  |  Provider: razorpay  |  AI: openrouter
```

---

## API Endpoints Needed

### Existing (already implemented)

| Endpoint | Purpose |
|----------|---------|
| `GET /api/dashboard/metrics` | Headline metrics |
| `GET /api/dashboard/failures-by-type` | Failure breakdown |
| `GET /api/dashboard/recovery-funnel` | State funnel |
| `GET /api/dashboard/guardrail-events` | Policy blocks |
| `GET /api/dashboard/audit-timeline` | Recent audit events |
| `GET /api/dashboard/best-interventions` | Action success rates |
| `GET /api/recovery?limit=&offset=` | Session list |
| `GET /api/recovery/:id` | Single session |
| `GET /api/recovery/:id/trace` | Full decision trace |
| `POST /api/recovery/:id/actions` | Manual action |
| `POST /api/recovery/:id/sync-payment` | Payment re-check |
| `POST /api/recovery/:id/ptp-reply` | PTP extraction |
| `GET /api/recovery/:id/ptp` | PTP records |
| `POST /api/demo/reset` | Clear demo data |
| `POST /api/demo/seed` | Seed demo data |
| `POST /api/demo/simulate/failure` | Simulate failure |
| `POST /api/demo/simulate/payment` | Simulate success |
| `POST /api/demo/simulate/ptp` | Simulate PTP |
| `POST /api/demo/simulate/optout` | Simulate opt-out |
| `POST /api/demo/experiment` | Run batch experiment |

### New endpoints needed

| Endpoint | Purpose |
|----------|---------|
| `GET /api/webhooks/events?limit=50` | Webhook event log for Webhook Monitor |
| `GET /api/ptp?status=ACTIVE&limit=50` | Cross-session PTP list for PTP Manager |
| `GET /api/system/status` | System info (mode, model, policy version, provider) |
| `GET /api/dashboard/trends?window=24h` | Time-series for trend indicators |

---

## Frontend API Key Handling

Since `DEMO_MODE=false` requires API key auth for `/api/*`:

1. Frontend reads API key from:
   - URL parameter: `?api_key=xxx` (for sharing)
   - localStorage: `recovery_api_key` (persistent)
   - Environment variable baked at build time: `VITE_API_KEY`
2. All API calls include `x-api-key` header
3. If 401 → show "API Key Required" screen with input field
4. API key is never logged or sent to third parties

---

## Color System

| Color | Usage |
|-------|-------|
| Red (#dc2626) | Revenue at risk, failures, blocked, STOPPED |
| Amber (#f59e0b) | Warnings, HUMAN_REVIEW, DEMO badge |
| Green (#16a34a) | Recovered, success, ALLOW, LIVE badge |
| Blue (#2563eb) | Info, DIAGNOSING, recovery rate |
| Indigo (#4f46e5) | AI, incremental recovery, PAYMENT_PENDING |
| Purple (#9333ea) | PTP_WAIT, active workflows |
| Gray (#6b7280) | ORGANIC attribution, neutral states |
| Cyan (#0891b2) | SAFE_RETRY |

---

## Implementation Priority

1. **Fix frontend auth** — add API key handling so dashboard works in live mode
2. **Enhance Decision Trace** — add AI recommendation + policy decision expandable cards
3. **Add PTP Manager page** — new page for PTP records across sessions
4. **Add Webhook Monitor page** — new page for webhook event log
5. **Add mode badge** — LIVE/DEMO indicator in header
6. **Add trend indicators** — up/down arrows on metric cards
7. **Add system status endpoint** — model, policy version, provider info
8. **Polish** — animations, transitions, responsive layout
