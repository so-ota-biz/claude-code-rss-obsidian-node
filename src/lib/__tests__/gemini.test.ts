import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GeminiClient } from '../gemini.js';
import type { ProcessedPost } from '../../types.js';

function makeClient() {
  return new GeminiClient('test-api-key', 'gemini-2.5-flash-lite', 5000);
}

function makePost(overrides: Partial<ProcessedPost> = {}): ProcessedPost {
  return {
    account: 'user1',
    title: 'Test',
    link: 'https://x.com/user1/status/1',
    id: 'id-1',
    publishedAt: '2026-03-15T10:00:00.000Z',
    content: 'Hello world',
    translatedText: 'こんにちは',
    language: 'en',
    ...overrides
  };
}

function makeFetchResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: vi.fn().mockResolvedValue(JSON.stringify(body)),
    json: vi.fn().mockResolvedValue(body)
  } as unknown as Response;
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('GeminiClient.translate', () => {
  it('returns translated text from a successful response', async () => {
    const responseBody = {
      candidates: [{ content: { parts: [{ text: '日本語翻訳' }] } }]
    };
    vi.mocked(fetch).mockResolvedValue(makeFetchResponse(responseBody));

    const client = makeClient();
    const result = await client.translate('Hello world');
    expect(result).toBe('日本語翻訳');
  });

  it('throws on non-200 HTTP response', async () => {
    const errorBody = { error: { message: 'API error' } };
    vi.mocked(fetch).mockResolvedValue(makeFetchResponse(errorBody, 400));

    const client = makeClient();
    await expect(client.translate('Hello')).rejects.toThrow('Gemini API error 400');
  });

  it('throws when response content is empty', async () => {
    const responseBody = { candidates: [{ content: { parts: [] } }] };
    vi.mocked(fetch).mockResolvedValue(makeFetchResponse(responseBody));

    const client = makeClient();
    await expect(client.translate('Hello')).rejects.toThrow('empty content');
  });

  it('throws when candidates array is empty', async () => {
    const responseBody = { candidates: [] };
    vi.mocked(fetch).mockResolvedValue(makeFetchResponse(responseBody));

    const client = makeClient();
    await expect(client.translate('Hello')).rejects.toThrow('empty content');
  });

  it('throws on fetch error (network failure)', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('network error'));

    const client = makeClient();
    await expect(client.translate('Hello')).rejects.toThrow('network error');
  });

  it('concatenates multiple text parts', async () => {
    const responseBody = {
      candidates: [{ content: { parts: [{ text: 'part1' }, { text: 'part2' }] } }]
    };
    vi.mocked(fetch).mockResolvedValue(makeFetchResponse(responseBody));

    const client = makeClient();
    const result = await client.translate('Hello');
    expect(result).toBe('part1part2');
  });
});

describe('GeminiClient.translateBatch', () => {
  function makeBatchResponse(translations: string[]): Response {
    const responseBody = {
      candidates: [{ content: { parts: [{ text: JSON.stringify(translations) }] } }]
    };
    return makeFetchResponse(responseBody);
  }

  it('returns empty array without calling fetch when texts is empty', async () => {
    const client = makeClient();
    const result = await client.translateBatch([], 10);
    expect(result).toEqual([]);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('returns translations for a single batch (texts <= batchSize)', async () => {
    vi.mocked(fetch).mockResolvedValue(makeBatchResponse(['翻訳1', '翻訳2', '翻訳3']));
    const client = makeClient();
    const result = await client.translateBatch(['text1', 'text2', 'text3'], 10);
    expect(result).toEqual(['翻訳1', '翻訳2', '翻訳3']);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('splits into multiple batches when texts exceed batchSize', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(makeBatchResponse(['翻訳1', '翻訳2']))
      .mockResolvedValueOnce(makeBatchResponse(['翻訳3', '翻訳4']))
      .mockResolvedValueOnce(makeBatchResponse(['翻訳5']));
    const client = makeClient();
    const result = await client.translateBatch(['t1', 't2', 't3', 't4', 't5'], 2);
    expect(result).toEqual(['翻訳1', '翻訳2', '翻訳3', '翻訳4', '翻訳5']);
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it('handles a single text', async () => {
    vi.mocked(fetch).mockResolvedValue(makeBatchResponse(['翻訳のみ']));
    const client = makeClient();
    const result = await client.translateBatch(['only one'], 10);
    expect(result).toEqual(['翻訳のみ']);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('throws when response array length does not match chunk size', async () => {
    const responseBody = {
      candidates: [{ content: { parts: [{ text: JSON.stringify(['翻訳1']) }] } }]
    };
    vi.mocked(fetch).mockResolvedValue(makeFetchResponse(responseBody));
    const client = makeClient();
    await expect(client.translateBatch(['text1', 'text2'], 10)).rejects.toThrow(
      'translateBatch: expected array of length 2, got 1'
    );
  });

  it('throws on non-200 HTTP response', async () => {
    vi.mocked(fetch).mockResolvedValue(makeFetchResponse({ error: 'bad request' }, 400));
    const client = makeClient();
    await expect(client.translateBatch(['hello'], 10)).rejects.toThrow('Gemini API error 400');
  });
});

describe('GeminiClient.buildDigest', () => {
  it('returns parsed DailyDigest from valid JSON response', async () => {
    const digest = {
      title: 'Daily Digest',
      summary: 'Summary text',
      highlights: [
        { headline: 'H1', whyItMatters: 'Why', points: ['p1'], sources: ['https://x.com/1'] }
      ],
      notableAccounts: ['user1']
    };
    const responseBody = {
      candidates: [{ content: { parts: [{ text: JSON.stringify(digest) }] } }]
    };
    vi.mocked(fetch).mockResolvedValue(makeFetchResponse(responseBody));

    const client = makeClient();
    const result = await client.buildDigest([makePost()], '2026-03-15', 5);
    expect(result).toEqual(digest);
  });

  it('throws when response is not valid JSON', async () => {
    const responseBody = {
      candidates: [{ content: { parts: [{ text: 'not json at all' }] } }]
    };
    vi.mocked(fetch).mockResolvedValue(makeFetchResponse(responseBody));

    const client = makeClient();
    await expect(client.buildDigest([makePost()], '2026-03-15', 5)).rejects.toThrow();
  });

  it('throws on non-200 response', async () => {
    vi.useFakeTimers();
    vi.mocked(fetch).mockResolvedValue(makeFetchResponse({}, 500));

    const client = makeClient();
    const rejectPromise = expect(
      client.buildDigest([makePost()], '2026-03-15', 5)
    ).rejects.toThrow('Gemini API error 500');

    await vi.runAllTimersAsync();
    await rejectPromise;
    vi.useRealTimers();
  });
});
