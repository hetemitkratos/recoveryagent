import { describe, it, expect } from 'vitest';
import { PTPExtractor } from '../../../src/domain/ptp/ptp-extractor.js';
import { makeConfig } from '../../fixtures/index.js';
import type { AIAdapter } from '../../../src/infrastructure/ai/ai-adapter.js';
import type { AIResponse, PTPResponse } from '../../../src/infrastructure/ai/schemas.js';

// Stub AI adapter for deterministic PTP tests
class StubAIAdapter implements AIAdapter {
  constructor(private ptpResponse: PTPResponse) {}
  async getRecommendation(): Promise<AIResponse> {
    throw new Error('Not used in PTP tests');
  }
  async extractPTP(): Promise<PTPResponse> {
    return this.ptpResponse;
  }
}

// Failing AI adapter for AI-unavailable tests
class FailingAIAdapter implements AIAdapter {
  async getRecommendation(): Promise<AIResponse> {
    throw new Error('AI unavailable');
  }
  async extractPTP(): Promise<PTPResponse> {
    throw new Error('AI unavailable');
  }
}

describe('PTPExtractor', () => {
  const config = makeConfig({ PTP_CONFIDENCE_THRESHOLD: 0.80 });
  const context = { customer_id: 'cus_test_001', payment_id: 'pay_test_001' };

  it('valid date: extracts PTP with ACTIVE status when confidence above threshold', async () => {
    const ai = new StubAIAdapter({
      is_ptp: true,
      promised_date: '2026-01-15T00:00:00Z',
      promised_amount: null,
      confidence: 0.90,
    });
    const extractor = new PTPExtractor(ai, config);
    const result = await extractor.extract('I will pay on January 15th', context);
    expect(result.status).toBe('ACTIVE');
    expect(result.promised_date).toEqual(new Date('2026-01-15T00:00:00Z'));
    expect(result.confidence).toBe(0.90);
  });

  it('ambiguous date: returns AMBIGUOUS when confidence below threshold', async () => {
    const ai = new StubAIAdapter({
      is_ptp: true,
      promised_date: '2026-01-15T00:00:00Z',
      promised_amount: null,
      confidence: 0.50, // below 0.80 threshold
    });
    const extractor = new PTPExtractor(ai, config);
    const result = await extractor.extract('Maybe I will pay soon', context);
    expect(result.status).toBe('AMBIGUOUS');
    expect(result.confidence).toBe(0.50);
  });

  it('ambiguous: returns AMBIGUOUS when is_ptp=true but no date extracted', async () => {
    const ai = new StubAIAdapter({
      is_ptp: true,
      promised_date: null,
      promised_amount: null,
      confidence: 0.95,
    });
    const extractor = new PTPExtractor(ai, config);
    const result = await extractor.extract('I will pay later', context);
    expect(result.status).toBe('AMBIGUOUS');
  });

  it('not a PTP: returns CANCELLED when is_ptp=false', async () => {
    const ai = new StubAIAdapter({
      is_ptp: false,
      promised_date: null,
      promised_amount: null,
      confidence: 0.10,
    });
    const extractor = new PTPExtractor(ai, config);
    const result = await extractor.extract('I am not going to pay', context);
    expect(result.status).toBe('CANCELLED');
    expect(result.confidence).toBe(0.10);
  });

  it('AI unavailable: throws error (caller must handle with safe fallback)', async () => {
    const ai = new FailingAIAdapter();
    const extractor = new PTPExtractor(ai, config);
    await expect(extractor.extract('I will pay Friday', context)).rejects.toThrow('AI unavailable');
  });

  it('extracts promised amount when provided', async () => {
    const ai = new StubAIAdapter({
      is_ptp: true,
      promised_date: '2026-01-15T00:00:00Z',
      promised_amount: 50000,
      confidence: 0.95,
    });
    const extractor = new PTPExtractor(ai, config);
    const result = await extractor.extract('I will pay 500 rupees on January 15th', context);
    expect(result.status).toBe('ACTIVE');
    expect(result.promised_amount).toBe(50000);
  });
});
