import { describe, it, expect, vi, beforeEach } from 'vitest';
import { processPosts, buildDigest } from '../pipeline.js';
import type { AppConfig, FeedPost, ProcessedPost, DailyDigest } from '../../types.js';
import type { GeminiClient } from '../gemini.js';

const baseConfig: AppConfig = {
  geminiApiKey: 'key',
  rsshubBaseUrl: 'http://localhost:1200',
  rsshubRouteTemplate: '/twitter/user/:account',
  obsidianVaultPath: '/vault',
  targetAccounts: ['user1'],
  timezone: 'Asia/Tokyo',
  outputSubdir: 'AI Digest/Claude Code',
  rawSubdir: 'AI Digest/Claude Code/raw',
  assetsSubdir: 'AI Digest/Claude Code/assets',
  stateDir: '.state',
  maxPostsPerAccount: 20,
  lookbackDays: 1,
  onlyIncludeOriginalPosts: true,
  skipRetweets: true,
  skipReplies: true,
  enableTranslation: true,
  enableDigest: true,
  enableThumbnail: true,
  maxHighlights: 5,
  thumbnailImageExt: 'png',
  modelText: 'gemini-2.5-flash-lite',
  thumbnailPromptStyle: 'clean, modern',
  requestTimeoutMs: 30000,
  storageType: 'local'
};

function makePost(overrides: Partial<FeedPost> = {}): FeedPost {
  return {
    account: 'user1',
    title: 'Test post',
    link: 'https://x.com/user1/status/1',
    id: 'id-1',
    publishedAt: '2026-03-15T10:00:00.000Z',
    content: 'Hello world from the test post',
    ...overrides
  };
}

function makeMockGemini(overrides: Partial<GeminiClient> = {}): GeminiClient {
  return {
    translate: vi.fn().mockResolvedValue('翻訳テキスト'),
    buildDigest: vi.fn().mockResolvedValue({
      title: 'Digest',
      summary: 'Summary',
      highlights: [],
      notableAccounts: ['user1']
    } satisfies DailyDigest),
    ...overrides
  } as unknown as GeminiClient;
}

describe('processPosts', () => {
  let gemini: GeminiClient;

  beforeEach(() => {
    gemini = makeMockGemini();
  });

  it('filters out retweets when skipRetweets is true', async () => {
    const posts = [
      makePost({ content: 'RT @anthropic: some announcement', id: 'rt-1' }),
      makePost({ content: 'Normal post content here', id: 'normal-1' })
    ];
    const result = await processPosts(posts, baseConfig, gemini);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('normal-1');
  });

  it('does not filter retweets when skipRetweets is false', async () => {
    const config = { ...baseConfig, skipRetweets: false };
    const posts = [makePost({ content: 'RT @anthropic: announcement', id: 'rt-1' })];
    const result = await processPosts(posts, config, gemini);
    expect(result).toHaveLength(1);
  });

  it('filters out replies when skipReplies is true', async () => {
    const posts = [
      makePost({ content: '@user thanks for the update', id: 'reply-1' }),
      makePost({ content: 'Normal post content here', id: 'normal-1', link: 'https://x.com/user1/status/2' })
    ];
    const result = await processPosts(posts, baseConfig, gemini);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('normal-1');
  });

  it('deduplicates posts with same normalized content', async () => {
    const posts = [
      makePost({ content: 'Hello world content', id: 'id-1' }),
      makePost({ content: 'Hello world content', id: 'id-2', link: 'https://x.com/user1/status/2' })
    ];
    const result = await processPosts(posts, baseConfig, gemini);
    expect(result).toHaveLength(1);
  });

  it('calls gemini.translate for English posts when enableTranslation is true', async () => {
    const posts = [makePost({ content: 'This is an English post with enough characters to qualify' })];
    await processPosts(posts, baseConfig, gemini);
    expect(gemini.translate).toHaveBeenCalledOnce();
  });

  it('does not call gemini.translate for Japanese posts', async () => {
    const posts = [makePost({ content: 'これは日本語の投稿です。テスト。' })];
    await processPosts(posts, baseConfig, gemini);
    expect(gemini.translate).not.toHaveBeenCalled();
  });

  it('does not call gemini.translate when enableTranslation is false', async () => {
    const config = { ...baseConfig, enableTranslation: false };
    const posts = [makePost({ content: 'This is an English post with many characters here' })];
    await processPosts(posts, config, gemini);
    expect(gemini.translate).not.toHaveBeenCalled();
  });

  it('sorts result by publishedAt ascending', async () => {
    const posts = [
      makePost({ id: 'id-2', publishedAt: '2026-03-15T12:00:00.000Z', content: 'second post content text', link: 'https://x.com/user1/status/2' }),
      makePost({ id: 'id-1', publishedAt: '2026-03-15T10:00:00.000Z', content: 'first post content text', link: 'https://x.com/user1/status/1' })
    ];
    const result = await processPosts(posts, baseConfig, gemini);
    expect(result[0].id).toBe('id-1');
    expect(result[1].id).toBe('id-2');
  });

  it('returns empty array when all posts are filtered out', async () => {
    const posts = [makePost({ content: 'RT @user: something' })];
    const result = await processPosts(posts, baseConfig, gemini);
    expect(result).toHaveLength(0);
  });
});

describe('buildDigest', () => {
  let gemini: GeminiClient;

  beforeEach(() => {
    gemini = makeMockGemini();
  });

  it('returns default digest when enableDigest is false', async () => {
    const config = { ...baseConfig, enableDigest: false };
    const posts: ProcessedPost[] = [
      { ...makePost(), translatedText: 'test', language: 'en' }
    ];
    const result = await buildDigest(posts, config, gemini, '2026-03-15');
    expect(result.highlights).toHaveLength(0);
    expect(result.summary).toBe('Digest generation is disabled.');
    expect(gemini.buildDigest).not.toHaveBeenCalled();
  });

  it('calls gemini.buildDigest when enableDigest is true', async () => {
    const posts: ProcessedPost[] = [
      { ...makePost(), translatedText: 'test', language: 'en' }
    ];
    await buildDigest(posts, baseConfig, gemini, '2026-03-15');
    expect(gemini.buildDigest).toHaveBeenCalledOnce();
    expect(gemini.buildDigest).toHaveBeenCalledWith(posts, '2026-03-15', baseConfig.maxHighlights);
  });

  it('default digest includes notableAccounts from posts', async () => {
    const config = { ...baseConfig, enableDigest: false };
    const posts: ProcessedPost[] = [
      { ...makePost({ account: 'acc1' }), translatedText: 'test', language: 'en' },
      { ...makePost({ account: 'acc2', id: 'id-2', link: 'https://x.com/2' }), translatedText: 'test2', language: 'en' }
    ];
    const result = await buildDigest(posts, config, gemini, '2026-03-15');
    expect(result.notableAccounts).toContain('acc1');
    expect(result.notableAccounts).toContain('acc2');
  });
});
