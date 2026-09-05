---
name: demo-engineering
description: >-
  Use this skill when implementing the demo simulator, seed data generation,
  batch experiment runner, demo reset capability, or demo control panel for
  the AI Revenue Recovery MVP. The simulator must use the same domain,
  state machine, policy engine, and attribution engine as the real flow —
  never a separate fake path.
---

# Demo Engineering Skill

## Core Principle

The demo must be:
1. **Deterministic** — same seed → same results, always
2. **Real** — uses actual domain/state/policy/attribution code (no fake paths)
3. **Resettable** — full reset in under 5 seconds
4. **Reliable** — works without live Razorpay or Gemini credentials

---

## Simulator Architecture

```
Demo Control Panel
       ↓
Demo API (/api/demo/*)
       ↓
DemoOrchestrator
       ↓
Same RecoveryOrchestrator (real code)
       ↓
SimulatorAdapter (instead of real Razorpay)
MockAIAdapter (instead of real Gemini — optional)
```

NEVER create a separate code path that bypasses the recovery engine.
The simulator only replaces external I/O adapters.

---

## Seed Data

Use a seeded PRNG for reproducibility:

```typescript
import Chance from 'chance'; // or simple seeded random

function seedDemoData(seed: number = 42, count: number = 100) {
  const rng = new Chance(seed);

  const failureDistribution = [
    { class: 'TECHNICAL',      weight: 40, codes: ['gateway_timeout', 'processor_error'] },
    { class: 'BUSINESS',       weight: 40, codes: ['insufficient_funds', 'limit_exceeded'] },
    { class: 'AUTHENTICATION', weight: 10, codes: ['authentication_required'] },
    { class: 'UNKNOWN',        weight: 10, codes: ['unknown_error'] },
  ];

  const amounts = [500, 1200, 3500, 7500, 12000, 25000, 50000]; // in paise × 100

  // Generate customers, payments, and recovery opportunities
  // Each follows the same domain model — no shortcuts
}
```

---

## Required Seed Scenarios

The seed must include all hero cases:

```typescript
const HERO_SCENARIOS = [
  {
    id: 'HERO_A',
    name: 'Technical Failure → Safe Retry → Recovered',
    failure_class: 'TECHNICAL',
    failure_code: 'gateway_timeout',
    amount: 7500,
    expected_outcome: 'RECOVERED',
    expected_attribution: 'DIRECT',
  },
  {
    id: 'HERO_B',
    name: 'Business Failure → Payment Link → Direct Recovery',
    failure_class: 'BUSINESS',
    failure_code: 'insufficient_funds',
    amount: 12000,
    expected_outcome: 'RECOVERED',
    expected_attribution: 'DIRECT',
  },
  {
    id: 'HERO_C',
    name: 'Promise to Pay → PTP_WAIT → Recovered',
    failure_class: 'BUSINESS',
    amount: 5000,
    expected_outcome: 'PTP_WAIT',
  },
  {
    id: 'HERO_D',
    name: 'Already Paid Race Condition → Blocked',
    failure_class: 'BUSINESS',
    amount: 9000,
    expected_outcome: 'BLOCKED_ALREADY_PAID',
  },
  {
    id: 'HERO_E',
    name: 'Customer Opt-Out → Stopped',
    failure_class: 'BUSINESS',
    amount: 3500,
    expected_outcome: 'STOPPED',
  },
];
```

---

## Simulation API Endpoints

All from API_CONTRACT.md §15–21:

```typescript
// POST /api/demo/seed
// Seeds deterministic demo dataset
{ seed: 42, count: 100 }

// POST /api/demo/reset
// Clears: customers, payments, sessions, actions, outcomes, audit, experiments
// Does NOT affect production data (use separate DB/schema in demo mode)

// POST /api/demo/simulate/failure
// Creates a controlled payment failure
{ customer_id, amount, failure_class, failure_code }
// → normalized event → RecoveryOrchestrator → real state machine

// POST /api/demo/simulate/payment
// Simulates payment success (triggers outcome observation + attribution)
{ payment_id, route: 'RECOVERY_LINK' | 'DIRECT' | 'OTHER' }
// → same outcome observer → attribution engine → RECOVERED

// POST /api/demo/simulate/ptp
// Creates a PTP event
{ recovery_id, promised_date, source_text }

// POST /api/demo/simulate/optout
// Simulates customer opt-out
{ recovery_id }
// → policy blocks → session → STOPPED

// POST /api/demo/experiment
// Runs batch experiment
{ seed: 42, control_size: 50, treatment_size: 50 }
// → real recovery engine for treatment, organic baseline for control
// → real incremental calculation
```

---

## Batch Experiment Implementation

```typescript
async function runExperiment(seed: number, controlSize: number, treatmentSize: number) {
  const rng = new Chance(seed);

  // 1. Generate comparable datasets
  const eligiblePayments = generateEligiblePayments(rng, controlSize + treatmentSize);

  // 2. Deterministic assignment (hash-based, not random each time)
  const { control, treatment } = assignGroups(eligiblePayments, seed);

  // 3. Run treatment through REAL recovery engine
  for (const payment of treatment) {
    await recoveryOrchestrator.process(payment);
    await simulateOutcome(payment, rng); // probabilistic but seeded
  }

  // 4. Control gets organic baseline (no recovery intervention)
  for (const payment of control) {
    await simulateOrganicOutcome(payment, rng);
  }

  // 5. Calculate REAL metrics from DB (never hardcode)
  const metrics = await calculateExperimentMetrics(experimentId);

  return {
    experiment_id: experimentId,
    control: metrics.control,
    treatment: metrics.treatment,
    incremental_recovered_revenue: metrics.treatment.recovered - metrics.control.recovered,
    roi: metrics.roi,
  };
}
```

---

## Demo Reset Implementation

```typescript
async function resetDemo() {
  // Must be safe to call repeatedly
  // Must NOT touch non-demo data if production DB is shared

  await db.transaction(async (tx) => {
    await tx.delete(auditEvents).where(eq(auditEvents.is_demo, true));
    await tx.delete(experimentAssignments).where(eq(experimentAssignments.is_demo, true));
    await tx.delete(recoveryOutcomes).where(isDemo);
    await tx.delete(recoveryActions).where(isDemo);
    await tx.delete(communicationEvents).where(isDemo);
    await tx.delete(promisesToPay).where(isDemo);
    await tx.delete(recoverySessions).where(isDemo);
    await tx.delete(payments).where(isDemo);
    await tx.delete(customers).where(isDemo);
    await tx.delete(webhookEvents).where(isDemo);
  });
}
```

Tag all demo data with `is_demo: true` to prevent accidental production pollution.

---

## Demo Timing

The demo runs fast:
- Seed → 100 customers/payments in < 2 seconds
- Hero scenario A-E → visible state transitions in < 30 seconds each
- Batch experiment (100 payments) → results in < 10 seconds
- Reset → clean state in < 5 seconds

Compress simulation delays (retry waits, observation windows) for demo mode:
```env
DEMO_MODE=true
DEMO_COMPRESS_DELAYS=true
```

Label compressed delays clearly in the UI: "Simulated 24h wait"

---

## What the Judge Sees

For every hero scenario the audit timeline must show:

```
10:01 Payment failed (failure_class, amount)
10:01 Recovery session created
10:01 Risk calculated (risk_score, expected_recoverable_revenue)
10:02 Diagnosis: BUSINESS (confidence: 96%)
10:02 AI recommendation: PAYMENT_LINK (confidence: 94%)
10:02 Policy ALLOW (rules: payment unpaid, outreach permitted, limit OK)
10:03 Payment link created
10:08 Payment observed: CAPTURED
10:08 Attribution: DIRECT (evidence: recovery_link_used)
10:08 Recovery closed: ₹12,000 recovered
```

For BLOCKED scenario:
```
10:05 Payment state rechecked
10:05 Status: CAPTURED (already paid)
10:05 ACTION BLOCKED (reason: PAYMENT_ALREADY_COMPLETED)
10:05 Recovery closed (RECOVERED — no outreach sent)
```

---

## What NOT to Do

- Do NOT create a separate "demo mode" code path that skips state machine or policy
- Do NOT hardcode metrics in the frontend — derive from DB
- Do NOT use random seeds in demo — use fixed seed (42) for reproducibility
- Do NOT depend on live Razorpay/Gemini for the demo to work
- Do NOT show fabricated audit events — every event must come from real processing
- Do NOT mark payments as RECOVERED unless the outcome engine confirms it

---

## Validation Before Demo

Run this checklist:
- [ ] `POST /api/demo/seed` returns correct counts
- [ ] Hero Scenario B completes: AT_RISK → DIAGNOSING → OUTREACH → PAYMENT_PENDING → RECOVERED
- [ ] Hero Scenario D shows ACTION_BLOCKED in audit log, no communication sent
- [ ] Batch experiment returns non-zero incremental revenue (from seeded data)
- [ ] `POST /api/demo/reset` → seed again → same results (deterministic)
- [ ] All 5 hero scenarios runnable without live credentials

---

## References

- Demo plan: `docs/DEMO_PLAN.md`
- API endpoints: `docs/API_CONTRACT.md` §15–21
- Experiment design: `docs/ATTRIBUTION.md` §13–16
