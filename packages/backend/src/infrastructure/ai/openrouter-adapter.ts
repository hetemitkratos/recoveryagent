import type { AIAdapter, RecommendationContext } from './ai-adapter.js';
import { AIResponseSchema, PTPResponseSchema, type AIResponse, type PTPResponse } from './schemas.js';
import { RECOMMENDATION_V1 } from './prompts/recommendation-v1.js';
import { PTP_V1 } from './prompts/ptp-v1.js';

/**
 * OpenRouter AI adapter — OpenAI-compatible chat completions API.
 * Supports any model available on https://openrouter.ai/models
 *
 * Recommended models for this use case (text/chat completion):
 *   - google/gemini-flash-2.0       (fast, cheap, good JSON)
 *   - openai/gpt-4o-mini            (fast, cheap, reliable JSON)
 *   - anthropic/claude-3.5-sonnet   (best reasoning, pricier)
 *   - meta-llama/llama-3.3-70b-instruct (open-source, cheap)
 *
 * NOT suitable: embedding models, reranking models, image models.
 * You need a chat/instruction-tuned text model that can return JSON.
 */
export class OpenRouterAdapter implements AIAdapter {
  private apiKey: string;
  private model: string;
  private baseUrl: string;
  private timeoutMs: number;

  constructor(config: {
    OPENROUTER_API_KEY: string;
    OPENROUTER_MODEL: string;
    OPENROUTER_BASE_URL?: string;
    OPENROUTER_TIMEOUT_MS?: number;
  }) {
    this.apiKey = config.OPENROUTER_API_KEY;
    this.model = config.OPENROUTER_MODEL;
    this.baseUrl = config.OPENROUTER_BASE_URL ?? 'https://openrouter.ai/api/v1';
    this.timeoutMs = config.OPENROUTER_TIMEOUT_MS ?? 15_000;
  }

  async getRecommendation(context: RecommendationContext): Promise<AIResponse> {
    const systemPrompt = RECOMMENDATION_V1;
    const userPrompt = `Context: ${JSON.stringify(context)}`;

    const json = await this.chatCompletion(systemPrompt, userPrompt);
    return AIResponseSchema.parse(json);
  }

  async extractPTP(text: string, _ctx: { customer_id: string; payment_id: string }): Promise<PTPResponse> {
    const systemPrompt = PTP_V1;
    const userPrompt = `Text: ${text}`;

    const json = await this.chatCompletion(systemPrompt, userPrompt);
    return PTPResponseSchema.parse(json);
  }

  private async chatCompletion(systemPrompt: string, userPrompt: string): Promise<Record<string, unknown>> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const res = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://recovery-agent.onrender.com',
          'X-Title': 'AI Revenue Recovery MVP',
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          response_format: { type: 'json_object' },
          temperature: 0.3,
          max_tokens: 1000,
        }),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        throw new Error(`OpenRouter API error ${res.status}: ${errText}`);
      }

      const data = await res.json() as {
        choices: Array<{ message: { content: string } }>;
      };

      const content = data.choices?.[0]?.message?.content;
      if (!content) {
        throw new Error('OpenRouter returned empty response');
      }

      // Some models wrap JSON in markdown code blocks — strip them.
      const cleaned = content
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim();

      return JSON.parse(cleaned);
    } finally {
      clearTimeout(timeout);
    }
  }
}
