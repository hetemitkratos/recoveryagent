import type { Payment } from '../entities/payment.js';
import type { DiagnosisResult } from '../diagnosis/diagnosis-engine.js';

export interface RiskAssessment {
  risk_score: number;           // 0-100
  recovery_probability: number; // 0.0-1.0
  expected_recoverable_revenue: number; // paise
  risk_factors: string[];
}

export class RiskEngine {
  assess(params: {
    payment: Payment;
    diagnosis: DiagnosisResult;
    session_history: { attempt_count: number; communication_count: number };
    customer_history: { success_count: number; fail_count: number; prior_recovery_outcomes: string[] };
  }): RiskAssessment {
    const { payment, diagnosis, customer_history } = params;
    
    // Heuristic probability base
    let baseProb = 0.5;
    if (diagnosis.failure_class === 'TECHNICAL') baseProb = 0.8;
    if (diagnosis.failure_class === 'BUSINESS') baseProb = 0.6;
    if (diagnosis.failure_class === 'AUTHENTICATION') baseProb = 0.7;
    if (diagnosis.failure_class === 'ABANDONMENT') baseProb = 0.4;
    
    // Adjust by history
    const totalPrior = customer_history.success_count + customer_history.fail_count;
    if (totalPrior > 0) {
      const historicalSuccessRate = customer_history.success_count / totalPrior;
      baseProb = (baseProb + historicalSuccessRate) / 2; // blend
    }
    
    const pRecovery = Math.min(Math.max(baseProb, 0.1), 0.95);
    const pIncremental = 0.8; // Estimated
    
    const err = Math.floor(payment.amount * pRecovery * pIncremental);
    
    // Risk score: scale based on amount and probability
    // Higher amount + lower probability = higher risk. But we also care about value.
    // Let's use a simple value at risk score.
    const normalizedAmount = Math.min(payment.amount / 1000000, 1.0); // max 10k INR
    const riskScore = Math.floor(((1 - pRecovery) * 0.5 + normalizedAmount * 0.5) * 100);
    
    return {
      risk_score: Math.min(100, Math.max(0, riskScore)),
      recovery_probability: pRecovery,
      expected_recoverable_revenue: err,
      risk_factors: [`FAILURE_${diagnosis.failure_class}`, `P_RECOVERY_${pRecovery.toFixed(2)}`]
    };
  }
}
