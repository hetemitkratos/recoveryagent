import { GoogleGenerativeAI } from '@google/generative-ai';
import type { AIAdapter, RecommendationContext } from './ai-adapter.js';
import { AIResponseSchema, PTPResponseSchema, type AIResponse, type PTPResponse } from './schemas.js';
import { RECOMMENDATION_V1 } from './prompts/recommendation-v1.js';
import { PTP_V1 } from './prompts/ptp-v1.js';

export class GeminiAdapter implements AIAdapter {
  private client: GoogleGenerativeAI;
  private model: string;

  constructor(config: { GEMINI_API_KEY: string; GEMINI_MODEL: string }) {
    this.client = new GoogleGenerativeAI(config.GEMINI_API_KEY);
    this.model = config.GEMINI_MODEL;
  }

  async getRecommendation(context: RecommendationContext): Promise<AIResponse> {
    const aiModel = this.client.getGenerativeModel({
      model: this.model,
      generationConfig: { responseMimeType: 'application/json' }
    });
    
    const prompt = `${RECOMMENDATION_V1}\n\nContext: ${JSON.stringify(context)}`;
    const result = await aiModel.generateContent(prompt);
    
    const parsed = JSON.parse(result.response.text());
    return AIResponseSchema.parse(parsed);
  }

  async extractPTP(text: string, ctx: any): Promise<PTPResponse> {
    const aiModel = this.client.getGenerativeModel({
      model: this.model,
      generationConfig: { responseMimeType: 'application/json' }
    });
    
    const prompt = `${PTP_V1}\n\nText: ${text}`;
    const result = await aiModel.generateContent(prompt);
    
    const parsed = JSON.parse(result.response.text());
    return PTPResponseSchema.parse(parsed);
  }
}
