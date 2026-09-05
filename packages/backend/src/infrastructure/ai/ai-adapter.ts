import type { Payment } from '../../domain/entities/payment.js';
import type { Customer } from '../../domain/entities/customer.js';
import type { ActionType } from '../../domain/entities/recovery-action.js';
import type { DiagnosisResult } from '../../domain/diagnosis/diagnosis-engine.js';
import type { RiskAssessment } from '../../domain/risk/risk-engine.js';
import type { AIResponse, PTPResponse } from './schemas.js';

export interface CustomerHistory {
  success_count: number;
  fail_count: number;
  prior_recovery_outcomes: string[];
}

export interface DiagnosisContext {
  payment: Payment;
  customer: Customer;
  failure_code: string;
  failure_description?: string;
  customer_history: CustomerHistory;
}

export interface RecommendationContext extends DiagnosisContext {
  diagnosis: DiagnosisResult;
  risk_assessment: RiskAssessment;
  available_actions: ActionType[];
}

export interface AIAdapter {
  getRecommendation(context: RecommendationContext): Promise<AIResponse>;
  extractPTP(text: string, context: { customer_id: string; payment_id: string }): Promise<PTPResponse>;
}
