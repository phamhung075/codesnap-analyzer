// src/_core/helper/codesnap/utils/token-counter.ts
import { get_encoding, encoding_for_model } from '@dqbd/tiktoken';
import type { TiktokenModel } from '@dqbd/tiktoken';
import { TokenCount } from '../types/types';


export class TokenCounter {
  // Initialize tiktoken encoders
  private static async getTokenizer(model: TiktokenModel) {
    try {
      return encoding_for_model(model);
    } catch (error) {
      console.error(`Error checking if file is text: ${error}`);
      return get_encoding('cl100k_base');  // fallback to base encoding
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
    const [gpt35, gpt4, claude, llama2] = await Promise.all([
      this.countGPT35Tokens(text),
      this.countGPT4Tokens(text),
      this.countClaudeTokens(text),
      this.countLlama2Tokens(text)
    ]);

    return {
      gpt35,
      gpt4,
      claude,
      llama2
    };
  }

  // Format token counts in a readable way
  static formatTokenCounts(counts: TokenCount): string {
    return [
      'Token counts by model:',
      `   GPT-3.5: ${this.formatNumber(counts.gpt35)}`,
      `   GPT-4:   ${this.formatNumber(counts.gpt4)}`,
      `   Claude:  ${this.formatNumber(counts.claude)}`,
      `   LLaMA 2: ${this.formatNumber(counts.llama2)}`
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