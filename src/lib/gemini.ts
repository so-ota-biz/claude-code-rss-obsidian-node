import type { DailyDigest, ProcessedPost } from '../types.js';
import { truncate } from './text.js';

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

export class GeminiClient {
  constructor(
    private readonly apiKey: string,
    private readonly model: string,
    private readonly timeoutMs: number
  ) {}

  async translate(text: string): Promise<string> {
    const prompt = [
      'Translate the following X post into natural Japanese.',
      'Rules:',
      '- Keep product names, command names, and code as-is when appropriate.',
      '- Preserve bullets and line breaks when practical.',
      '- Do not add commentary.',
      '',
      text
    ].join('\n');

    return this.generateText(prompt, 0.2);
  }

  async buildDigest(posts: ProcessedPost[], day: string, maxHighlights: number): Promise<DailyDigest> {
    const payload = posts.map((post) => ({
      account: post.account,
      url: post.link,
      publishedAt: post.publishedAt,
      original: truncate(post.content, 500),
      translated: truncate(post.translatedText, 500)
    }));

    const prompt = [
      `You are creating a Japanese daily digest for developers about Claude Code and related AI coding workflows.`,
      `Target date: ${day}`,
      `Return JSON only with this exact schema:`,
      '{"title": string, "summary": string, "notableAccounts": string[], "highlights": [{"headline": string, "whyItMatters": string, "points": string[], "sources": string[]}]}',
      `Rules:`,
      `- Output must be in Japanese.`,
      `- Keep only high-signal information.`,
      `- Merge duplicates.`,
      `- highlights length must be <= ${maxHighlights}.`,
      `- Each highlight.sources must contain one or more source URLs from input.`,
      `- notableAccounts should include only accounts that materially contributed to the digest.`,
      '',
      JSON.stringify(payload)
    ].join('\n');

    const raw = await this.generateText(prompt, 0.2, 'application/json');
    const parsed = JSON.parse(raw) as DailyDigest;
    return parsed;
  }

  private async generateText(prompt: string, temperature = 0.2, responseMimeType = 'text/plain'): Promise<string> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(`${API_BASE}/${this.model}:generateContent?key=${this.apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature,
            responseMimeType
          }
        }),
        signal: controller.signal
      });

      if (!response.ok) {
        const body = await response.text();
        throw new Error(`Gemini API error ${response.status}: ${body}`);
      }

      const data = (await response.json()) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      };

      const text = data.candidates?.[0]?.content?.parts?.map((part) => part.text ?? '').join('').trim();
      if (!text) throw new Error('Gemini API returned empty content');
      return text;
    } finally {
      clearTimeout(timeout);
    }
  }
}
