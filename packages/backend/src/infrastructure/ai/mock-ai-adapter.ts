import type { AIAdapter, RecommendationContext } from './ai-adapter.js';
import type { AIResponse, PTPResponse } from './schemas.js';

export class MockAIAdapter implements AIAdapter {
  async getRecommendation(context: RecommendationContext): Promise<AIResponse> {
    const fc = context.diagnosis.failure_class;
    
    let action = 'HUMAN_REVIEW' as any;
    let prob = 0.3;
    let conf = 0.4;
    
    if (fc === 'BUSINESS') { action = 'PAYMENT_LINK'; conf = 0.90; prob = 0.75; }
    else if (fc === 'TECHNICAL') { action = 'SAFE_RETRY'; conf = 0.92; prob = 0.60; }
    else if (fc === 'AUTHENTICATION') { action = 'PAYMENT_LINK'; conf = 0.85; prob = 0.65; }
    else if (fc === 'RECURRING_PAYMENT_FAILURE') { action = 'SAFE_RETRY'; conf = 0.88; prob = 0.55; }
    else if (fc === 'ABANDONMENT') { action = 'MESSAGE'; conf = 0.78; prob = 0.45; }

    return {
      diagnosis: {
        failure_class: fc,
        confidence: conf,
        reason_codes: ['MOCK_DETERMINISTIC']
      },
      recovery: {
        probability: prob,
        confidence: conf
      },
      recommendation: {
        action,
        confidence: conf,
        reason_codes: ['MOCK_RECOMMENDATION']
      },
      requires_human_review: fc === 'UNKNOWN'
    };
  }

  async extractPTP(text: string, context: any): Promise<PTPResponse> {
    const lower = text.toLowerCase();
    if (lower.includes('friday') || lower.includes('tomorrow') || lower.includes('next week')) {
      return {
        is_ptp: true,
        promised_date: new Date(Date.now() + 86400000 * 3).toISOString(),
        promised_amount: null,
        confidence: 0.9
      };
    }
    return {
      is_ptp: false,
      promised_date: null,
      promised_amount: null,
      confidence: 0
    };
  }
}
