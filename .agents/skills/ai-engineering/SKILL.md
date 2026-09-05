---
name: ai-engineering
description: >-
  Use this skill when implementing the AI adapter, AI output schemas,
  prompt management, confidence handling, mock/fallback adapters, PTP
  extraction, or AI-related tests for the AI Revenue Recovery MVP.
  This skill enforces the strict AI boundary defined in AI_CONTRACT.md:
  AI recommends, policy decides, deterministic code executes.
---

# AI Engineering Skill

## Purpose

The AI layer provides contextual intelligence inside a strict boundary:

```
Payment Context → AI → Policy Engine → Action Executor
```

The AI NEVER directly executes actions, modifies payment state, determines
attribution, or bypasses policy.

---

## Adapter Interface

All AI calls go through a single interface. Never scatter LLM calls across business logic.

```typescript
interface AIAdapter {
  getDiagnosis(context: DiagnosisContext): Promise<DiagnosisResult>;
  getRecommendation(context: RecommendationContext): Promise<RecommendationResult>;
  extractPTP(text: string, context: PTPContext): Promise<PTPResult>;
  generateMessage(context: MessageContext): Promise<MessageResult>;
}
```

Provide two implementations:
1. `GeminiAdapter` — real Gemini Flash calls (used when `GEMINI_API_KEY` set)
2. `MockAIAdapter` — deterministic, no external calls (used in tests and when no key)

Wire via dependency injection / config, not hard-coded conditionals throughout the codebase.

---

## Strict Output Schema (Zod)

Every AI response must be validated with Zod before use:

```typescript
const AIResponseSchema = z.object({
  diagnosis: z.object({
    failure_class: z.enum(['TECHNICAL', 'BUSINESS', 'AUTHENTICATION', 'ABANDONMENT', 'UNKNOWN']),
    confidence: z.number().min(0).max(1),
    reason_codes: z.array(z.string()),
  }),
  recovery: z.object({
    probability: z.number().min(0).max(1),
    confidence: z.number().min(0).max(1),
  }),
  recommendation: z.object({
    action: z.enum(['WAIT', 'SAFE_RETRY', 'PAYMENT_LINK', 'MESSAGE', 'PTP_WAIT', 'ESCALATE', 'HUMAN_REVIEW', 'STOP']),
    confidence: z.number().min(0).max(1),
    reason_codes: z.array(z.string()),
  }),
  message: z.object({
    text: z.string().max(500),
    tone: z.enum(['HELPFUL', 'URGENT', 'NEUTRAL']),
  }).optional(),
  requires_human_review: z.boolean(),
});
```

If validation fails → log structured error → fall back to deterministic diagnosis.
Never execute malformed AI output.

---

## Action Vocabulary Enforcement

AI can only recommend from this closed set:
```
WAIT | SAFE_RETRY | PAYMENT_LINK | MESSAGE | PTP_WAIT | ESCALATE | HUMAN_REVIEW | STOP
```

If AI returns anything outside this set:
```
→ log 'INVALID_AI_ACTION'
→ fall back to HUMAN_REVIEW
→ audit the fallback
```

---

## Confidence Handling

```typescript
const CONFIDENCE_LEVELS = {
  HIGH:   0.90,   // configurable via AI_CONFIDENCE_THRESHOLD
  MEDIUM: 0.70,
  LOW:    0.0,
} as const;

// Low confidence → conservative behavior
if (recommendation.confidence < config.AI_CONFIDENCE_THRESHOLD) {
  // Do NOT increase autonomy to compensate
  // Route to HUMAN_REVIEW or safe fallback
}
```

High confidence (0.99) NEVER overrides a hard BLOCK.

---

## Deterministic Rules Before AI

Apply these mappings deterministically **before** calling the AI:

```typescript
const DETERMINISTIC_FAILURE_MAP: Record<string, FailureClass> = {
  'insufficient_funds': 'BUSINESS',
  'limit_exceeded': 'BUSINESS',
  'card_declined': 'BUSINESS',
  'do_not_honor': 'BUSINESS',
  'gateway_timeout': 'TECHNICAL',
  'processor_error': 'TECHNICAL',
  'network_error': 'TECHNICAL',
  'authentication_required': 'AUTHENTICATION',
  'invalid_3ds': 'AUTHENTICATION',
};

function classifyDeterministically(code: string): FailureClass | null {
  return DETERMINISTIC_FAILURE_MAP[code.toLowerCase()] ?? null;
}
```

Call AI only when deterministic mapping returns `null` (genuinely ambiguous).
This reduces cost, latency, and improves reliability.

---

## AI Failure Handling

```typescript
async function getAIRecommendation(context): Promise<AIResult> {
  try {
    const raw = await aiAdapter.getRecommendation(context);
    const validated = AIResponseSchema.safeParse(raw);

    if (!validated.success) {
      auditLog('AI_OUTPUT_INVALID', { error: validated.error });
      return deterministicFallback(context);
    }

    return validated.data;
  } catch (err) {
    auditLog('AI_UNAVAILABLE', { error: err.message });
    return deterministicFallback(context);  // system keeps running
  }
}
```

AI failure must NEVER stop the recovery system. Always have a safe fallback.

---

## Deterministic Fallback

```typescript
function deterministicFallback(context: RecommendationContext): AIResult {
  const failureClass = classifyDeterministically(context.failure_code) ?? 'UNKNOWN';

  return {
    diagnosis: { failure_class: failureClass, confidence: 0.6, reason_codes: ['DETERMINISTIC_FALLBACK'] },
    recovery: { probability: 0.5, confidence: 0.5 },
    recommendation: {
      action: failureClass === 'UNKNOWN' ? 'HUMAN_REVIEW' : getDefaultAction(failureClass),
      confidence: 0.6,
      reason_codes: ['DETERMINISTIC_FALLBACK'],
    },
    requires_human_review: failureClass === 'UNKNOWN',
  };
}
```

---

## PTP Extraction

```typescript
interface PTPResult {
  promised_date: string | null;   // ISO date string
  confidence: number;             // 0.0–1.0
  source_text: string;
  status: 'ACTIVE' | 'AMBIGUOUS';
}
```

If `confidence < PTP_CONFIDENCE_THRESHOLD` or `promised_date == null`:
→ `status = 'AMBIGUOUS'` → route to HUMAN_REVIEW

The AI extracts the promise. The **application** verifies fulfillment through payment state.
AI must NOT mark PTP as fulfilled, extend deadlines, or claim recovery.

---

## Model Versioning — Persist for Every Decision

```typescript
{
  model_name: 'gemini-1.5-flash',
  model_version: 'v1',
  prompt_version: 'recovery-diagnosis-v1',
  schema_version: '1.0',
  created_at: new Date().toISOString(),
}
```

Store this alongside every `AIRecommendation` record for auditability.

---

## Context Management — Minimal, Relevant Only

Pass to AI:
- payment amount, status, failure code and description
- attempt number
- customer recovery history (counts only, not raw PII)
- available action vocabulary
- relevant policy constraints

Do NOT pass:
- raw customer PII dumps
- entire payment history
- database connection strings
- internal implementation details

---

## Message Generation Guardrails

AI-generated messages must NOT:
- threaten the customer
- impersonate a bank/regulator
- invent penalties not actually applicable
- claim a payment succeeded when it has not
- reveal internal AI reasoning or system details
- circumvent opt-out rules

Always validate generated messages against policy before sending.

---

## Testing Requirements

```
✓ Valid failure code → correct deterministic classification (no AI call)
✓ Ambiguous failure code → AI is called
✓ AI returns invalid action → rejected, falls back to HUMAN_REVIEW
✓ AI returns UNKNOWN class → HUMAN_REVIEW (not autonomous action)
✓ AI timeout → deterministic fallback, system continues
✓ AI invalid JSON → fallback, audit event written
✓ AI confidence < threshold + high-risk action → HUMAN_REVIEW (not blocked outright)
✓ Payment already paid + AI recommends outreach → policy BLOCKS (not AI's decision)
✓ PTP ambiguous date → HUMAN_REVIEW
✓ PTP clear date + high confidence → structured result stored
✓ MockAIAdapter returns deterministic results (no external calls in tests)
✓ Model/prompt version stored in every AIRecommendation record
```

---

## What NOT to Do

- Do NOT put LLM calls in HTTP route handlers
- Do NOT allow AI to directly change recovery state
- Do NOT trust AI output without Zod validation
- Do NOT hardcode model names throughout code (read from config)
- Do NOT skip AI calls for genuinely ambiguous cases (cost is justified)
- Do NOT allow AI-generated messages to reach customers without policy check
- Do NOT let AI declare attribution or recovery

---

## References

- Full AI contract: `docs/AI_CONTRACT.md`
- Policy interaction: `docs/POLICY_RULES.md` §15
- PTP spec: `docs/AI_CONTRACT.md` §16–17
