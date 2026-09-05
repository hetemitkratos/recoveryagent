import type { AIAdapter } from '../../infrastructure/ai/ai-adapter.js';
import type { Config } from '../../config.js';
import type { PTPStatus } from '../entities/promise-to-pay.js';

export interface PTPExtractionResult {
  status: PTPStatus;
  promised_date?: Date;
  promised_amount?: number;
  confidence: number;
}

export class PTPExtractor {
  constructor(private aiAdapter: AIAdapter, private config: Config) {}

  async extract(text: string, context: { customer_id: string; payment_id: string }): Promise<PTPExtractionResult> {
    const res = await this.aiAdapter.extractPTP(text, context);
    
    if (!res.is_ptp) {
      return { status: 'CANCELLED', confidence: res.confidence };
    }
    
    if (res.confidence < this.config.PTP_CONFIDENCE_THRESHOLD) {
      return { status: 'AMBIGUOUS', confidence: res.confidence };
    }
    
    if (!res.promised_date) {
      return { status: 'AMBIGUOUS', confidence: res.confidence };
    }
    
    return {
      status: 'ACTIVE',
      promised_date: new Date(res.promised_date),
      promised_amount: res.promised_amount || undefined,
      confidence: res.confidence
    };
  }
}
