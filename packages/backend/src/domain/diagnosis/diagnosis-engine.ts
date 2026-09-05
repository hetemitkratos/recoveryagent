import type { Payment, FailureClass } from '../entities/payment.js';
import { classifyDeterministically } from './failure-codes.js';

export interface DiagnosisResult {
  failure_class: FailureClass;
  confidence: number;
  reason_codes: string[];
  is_deterministic: boolean;
}

export class DiagnosisEngine {
  diagnose(payment: Payment): DiagnosisResult {
    const code = payment.failure_code ?? '';
    const deterministic = classifyDeterministically(code);
    
    if (deterministic) {
      return { 
        failure_class: deterministic, 
        confidence: 0.95, 
        reason_codes: ['DETERMINISTIC_RULE'], 
        is_deterministic: true 
      };
    }
    
    return { 
      failure_class: 'UNKNOWN', 
      confidence: 0.5, 
      reason_codes: ['NO_MATCHING_RULE'], 
      is_deterministic: false 
    };
  }
}
