import type { DailyDigest, ProcessedPost } from '../types.js';
import { truncate } from './text.js';

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

export class GeminiClient {
  constructor(
    private readonly apiKey: string,
    private readonly model: string,
    private readonly timeoutMs: number,
    private readonly imageModel: string = 'gemini-2.5-flash-image'
  ) {}

  async translateBatch(texts: string[], batchSize: number): Promise<string[]> {
    if (texts.length === 0) return [];

    const results: string[] = [];

    for (let i = 0; i < texts.length; i += batchSize) {
      const chunk = texts.slice(i, i + batchSize);
      const numbered = chunk.map((text, idx) => `${idx + 1}. ${text}`).join('\n\n');

      const prompt = [
        `Translate the following ${chunk.length} X post(s) into natural Japanese.`,
        'Rules:',
        '- Keep product names, command names, and code as-is when appropriate.',
        '- Preserve bullets and line breaks when practical.',
        '- Do not add commentary.',
        `- Return a JSON array of exactly ${chunk.length} string(s), one translation per post, in the same order.`,
        '',
        numbered
      ].join('\n');

      const raw = await this.generateText(prompt, 0.2, 'application/json');

      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        throw new Error(`translateBatch: invalid JSON response: ${raw.slice(0, 100)}`);
      }

      if (!Array.isArray(parsed) || parsed.length !== chunk.length) {
        throw new Error(
          `translateBatch: expected array of length ${chunk.length}, got ${Array.isArray(parsed) ? parsed.length : typeof parsed}`
        );
      }

      results.push(...(parsed as string[]));
    }

    return results;
  }

  async generateImage(prompt: string): Promise<Buffer> {
    const maxRetries = 3;
    const baseDelay = 5000;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

      try {
        console.log(`[info] Gemini image API request (attempt ${attempt}/${maxRetries}, model: ${this.imageModel})`);
        const response = await fetch(`${API_BASE}/${this.imageModel}:generateContent?key=${this.apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { responseModalities: ['IMAGE'] }
          }),
          signal: controller.signal
        });

        if (!response.ok) {
          const body = await response.text();
          const isRetryable = this.isRetryableError(response.status, body);
          if (isRetryable && attempt < maxRetries) {
            const delay = baseDelay * Math.pow(2, attempt - 1);
            console.log(`[warn] Gemini image API error ${response.status} (attempt ${attempt}/${maxRetries}), retrying in ${delay}ms...`);
            await this.sleep(delay);
            continue;
          }
          throw new Error(`Gemini image API error ${response.status}: ${body}`);
        }

        const data = (await response.json()) as {
          candidates?: Array<{
            content?: {
              parts?: Array<{ inlineData?: { mimeType: string; data: string } }>
            }
          }>
        };

        const imagePart = data.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
        if (!imagePart?.inlineData) throw new Error('Gemini image API returned no image data');

        return Buffer.from(imagePart.inlineData.data, 'base64');
      } catch (error) {
        clearTimeout(timeout);

        if (attempt === maxRetries) throw error;

        if (this.isRetryableErrorFromException(error)) {
          const delay = baseDelay * Math.pow(2, attempt - 1);
          console.log(`[warn] Gemini image API error (attempt ${attempt}/${maxRetries}), retrying in ${delay}ms...`, error instanceof Error ? error.message : error);
          await this.sleep(delay);
          continue;
        }

        throw error;
      } finally {
        clearTimeout(timeout);
      }
    }

    throw new Error('All retry attempts failed');
  }

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
    const maxRetries = 3;
    const baseDelay = 5000; // 5秒

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

      try {
        console.log(`[info] Gemini API request (attempt ${attempt}/${maxRetries})`);
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
          const isRetryable = this.isRetryableError(response.status, body);
          
          if (isRetryable && attempt < maxRetries) {
            const delay = baseDelay * Math.pow(2, attempt - 1); // 指数バックオフ
            console.log(`[warn] Gemini API error ${response.status} (attempt ${attempt}/${maxRetries}), retrying in ${delay}ms...`);
            await this.sleep(delay);
            continue;
          }
          
          throw new Error(`Gemini API error ${response.status}: ${body}`);
        }

        const data = (await response.json()) as {
          candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
        };

        const text = data.candidates?.[0]?.content?.parts?.map((part) => part.text ?? '').join('').trim();
        if (!text) throw new Error('Gemini API returned empty content');
        return text;
      } catch (error) {
        clearTimeout(timeout);
        
        if (attempt === maxRetries) {
          throw error;
        }
        
        // リトライ可能なエラーの場合のみリトライ
        if (this.isRetryableErrorFromException(error)) {
          const delay = baseDelay * Math.pow(2, attempt - 1);
          console.log(`[warn] Gemini API error (attempt ${attempt}/${maxRetries}), retrying in ${delay}ms...`, error instanceof Error ? error.message : error);
          await this.sleep(delay);
          continue;
        }
        
        throw error;
      } finally {
        clearTimeout(timeout);
      }
    }

    throw new Error('All retry attempts failed');
  }

  private isRetryableError(status: number, body: string): boolean {
    // 503 (Service Unavailable), 429 (Too Many Requests), 500 (Internal Server Error)
    if ([503, 429, 500].includes(status)) return true;
    
    // "high demand" や "temporarily" のキーワードがある場合
    if (body.includes('high demand') || body.includes('temporarily') || body.includes('try again')) {
      return true;
    }
    
    return false;
  }

  private isRetryableErrorFromException(error: any): boolean {
    if (error?.name === 'AbortError' || error?.message?.includes('timeout')) {
      return true;
    }
    return false;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
