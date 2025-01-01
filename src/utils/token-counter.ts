// src/_core/helper/codesnap/utils/token-counter.ts
import { get_encoding, encoding_for_model } from '@dqbd/tiktoken';
import type { TiktokenModel } from '@dqbd/tiktoken';
import { TokenCount } from '../types/types';
import { PRICING } from '../constants/pricing';

export class TokenCounter {
  // Initialize tiktoken encoders
  private static async getTokenizer(model: TiktokenModel) {
    try {
      return encoding_for_model(model);
    } catch (error) {
      console.error(`Error initializing tokenizer: ${error}`);
      return get_encoding('cl100k_base'); // fallback to base encoding
    }
  }

  // GPT-3.5 tokens using tiktoken
  static async countGPT35Tokens(text: string): Promise<number> {
    const encoder = await this.getTokenizer('gpt-3.5-turbo');
    return encoder.encode(text).length;
  }

  // GPT-4 tokens using tiktoken
  static async countGPT4Tokens(text: string): Promise<number> {
    const encoder = await this.getTokenizer('gpt-4');
    return encoder.encode(text).length;
  }

  // Claude tokens using cl100k_base encoding
  static async countClaudeTokens(text: string): Promise<number> {
    const encoder = await get_encoding('cl100k_base');
    return encoder.encode(text).length;
  }

  // LLaMA 2 tokens (approximation using cl100k_base)
  static async countLlama2Tokens(text: string): Promise<number> {
    const encoder = await get_encoding('cl100k_base');
    return Math.ceil(encoder.encode(text).length * 1.1); // 10% margin for differences
  }

  // Count tokens for all models
  static async countTokens(text: string): Promise<TokenCount> {
    // Remove unwanted tokens
    const sanitizedText = text.replace(/<\|endoftext\|>/g, '');

    const [gpt35, gpt4, claude, llama2] = await Promise.all([
      this.countGPT35Tokens(sanitizedText),
      this.countGPT4Tokens(sanitizedText),
      this.countClaudeTokens(sanitizedText),
      this.countLlama2Tokens(sanitizedText)
    ]);

    return {
      gpt35,
      gpt4,
      claude,
      llama2
    };
  }

  // Calculate token cost
  static calculateTokenCost(counts: TokenCount): Record<string, string> {
    return {
      gpt35: `$${((counts.gpt35 / 1000) * PRICING.gpt35).toFixed(4)}`,
      gpt4: `$${((counts.gpt4 / 1000) * PRICING.gpt4).toFixed(4)}`,
      claude: `$${((counts.claude / 1000) * PRICING.claude).toFixed(4)}`,
      llama2: `$${((counts.llama2 / 1000) * PRICING.llama2).toFixed(4)}`
    };
  }

  // Format token counts and costs in a readable way
  static formatTokenCounts(counts: TokenCount): string {
    const costs = this.calculateTokenCost(counts);
    return [
      'Token counts and costs by model:',
      `   GPT-3.5: ${this.formatNumber(counts.gpt35)} tokens → ${costs.gpt35}`,
      `   GPT-4:   ${this.formatNumber(counts.gpt4)} tokens → ${costs.gpt4}`,
      `   Claude:  ${this.formatNumber(counts.claude)} tokens → ${costs.claude}`,
      `   LLaMA 2: ${this.formatNumber(counts.llama2)} tokens → ${costs.llama2}`
    ].join('\n');
  }

  private static formatNumber(num: number): string {
    if (num >= 1_000_000) {
      return `${(num / 1_000_000).toFixed(2)}M`;
    }
    if (num >= 1_000) {
      return `${(num / 1_000).toFixed(1)}K`;
    }
    return num.toString();
  }
}