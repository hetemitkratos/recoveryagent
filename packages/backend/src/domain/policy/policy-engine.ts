import type { PolicyContext, PolicyRuleResult } from './policy-rules.js';
import {
  rule001PaymentState,
  rule005OptOut,
  ruleKillSwitch,
  rule006RetryCeiling,
  ruleCommunicationCount,
  rule004LowConfidence,
  rule008UnknownFailure,
  ruleHighValue
} from './policy-rules.js';
import type { PolicyDecisionResult } from '../entities/policy-decision.js';

export interface PolicyEvalResult {
  decision: PolicyDecisionResult;
  rulesEvaluated: string[];
  blockingReasons: string[];
  policyVersion: string;
}

export class PolicyEngine {
  private rules = [
    ruleKillSwitch,
    rule001PaymentState,
    rule005OptOut,
    rule006RetryCeiling,
    ruleCommunicationCount,
    ruleHighValue,
    rule004LowConfidence,
    rule008UnknownFailure
  ];

  evaluate(context: PolicyContext): PolicyEvalResult {
    const rulesEvaluated: string[] = [];
    const blockingReasons: string[] = [];
    let finalDecision: PolicyDecisionResult = 'ALLOW';

    for (const rule of this.rules) {
      const result = rule(context);
      rulesEvaluated.push(result.ruleId);

      if (result.decision === 'BLOCK') {
        finalDecision = 'BLOCK';
        if (result.reason) blockingReasons.push(result.reason);
        break; // Fail fast on block
      }
      
      if (result.decision === 'HUMAN_REVIEW') {
        finalDecision = 'HUMAN_REVIEW';
        if (result.reason) blockingReasons.push(result.reason);
        // Don't break immediately, let it gather other potential HR reasons, but for now we break to keep it simple.
        break;
      }
    }

    return {
      decision: finalDecision,
      rulesEvaluated,
      blockingReasons,
      policyVersion: '1.0.0'
    };
  }
}
