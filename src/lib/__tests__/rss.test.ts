import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AppConfig } from '../../types.js';

// vi.mock is hoisted, so use vi.hoisted for shared mocks
const { mockParseURL } = vi.hoisted(() => ({ mockParseURL: vi.fn() }));

vi.mock('rss-parser', () => {
  class MockParser {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    constructor(_options?: any) {}
    parseURL = mockParseURL;
  }
  return { default: MockParser };
});

import { fetchPostsForAccount } from '../rss.js';

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

const range = {
  startIso: '2026-03-14T15:00:00.000Z',
  endIso: '2026-03-15T15:00:00.000Z'
};

function makeRssItem(overrides: Record<string, unknown> = {}) {
  return {
    guid: 'https://x.com/user1/status/1',
    title: 'Test post',
    link: 'https://x.com/user1/status/1',
    isoDate: '2026-03-15T10:00:00.000Z',
    content: 'Hello world',
    contentEncoded: '<p>Hello world</p>',
    ...overrides
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('fetchPostsForAccount', () => {
  it('returns mapped FeedPost objects within the date range', async () => {
    mockParseURL.mockResolvedValue({ items: [makeRssItem()] });

    const result = await fetchPostsForAccount(baseConfig, 'user1', range);
    expect(result).toHaveLength(1);
    expect(result[0].account).toBe('user1');
    expect(result[0].link).toBe('https://x.com/user1/status/1');
    expect(result[0].content).toBe('Hello world');
  });

  it('strips HTML from contentEncoded', async () => {
    mockParseURL.mockResolvedValue({
      items: [makeRssItem({ contentEncoded: '<b>Bold</b> text' })]
    });

    const result = await fetchPostsForAccount(baseConfig, 'user1', range);
    expect(result[0].content).toBe('Bold text');
  });

  it('filters out posts outside the date range', async () => {
    const outOfRangeItem = makeRssItem({
      isoDate: '2026-03-13T10:00:00.000Z',
      guid: 'https://x.com/user1/status/2',
      link: 'https://x.com/user1/status/2'
    });
    mockParseURL.mockResolvedValue({ items: [makeRssItem(), outOfRangeItem] });

    const result = await fetchPostsForAccount(baseConfig, 'user1', range);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('https://x.com/user1/status/1');
  });

  it('filters out items with no content and no link', async () => {
    const noContentItem = { isoDate: '2026-03-15T10:00:00.000Z' };
    mockParseURL.mockResolvedValue({ items: [makeRssItem(), noContentItem] });

    const result = await fetchPostsForAccount(baseConfig, 'user1', range);
    expect(result).toHaveLength(1);
  });

  it('respects maxPostsPerAccount limit', async () => {
    const items = Array.from({ length: 5 }, (_, i) =>
      makeRssItem({
        guid: `https://x.com/user1/status/${i}`,
        link: `https://x.com/user1/status/${i}`,
        content: `Post ${i}`
      })
    );
    const config = { ...baseConfig, maxPostsPerAccount: 3 };
    mockParseURL.mockResolvedValue({ items });

    const result = await fetchPostsForAccount(config, 'user1', range);
    expect(result).toHaveLength(3);
  });

  it('uses link as id fallback when guid is absent', async () => {
    const item = makeRssItem({ guid: undefined, link: 'https://x.com/user1/status/99' });
    mockParseURL.mockResolvedValue({ items: [item] });

    const result = await fetchPostsForAccount(baseConfig, 'user1', range);
    expect(result[0].id).toBe('https://x.com/user1/status/99');
  });

  it('encodes account name in the URL', async () => {
    mockParseURL.mockResolvedValue({ items: [] });
    await fetchPostsForAccount(baseConfig, 'user with spaces', range);
    expect(mockParseURL).toHaveBeenCalledWith(
      'http://localhost:1200/twitter/user/user%20with%20spaces'
    );
  });

  it('returns empty array when feed has no items', async () => {
    mockParseURL.mockResolvedValue({ items: [] });
    const result = await fetchPostsForAccount(baseConfig, 'user1', range);
    expect(result).toHaveLength(0);
  });

  describe('error handling', () => {
    it('handles 503 error and returns empty array', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
      
      mockParseURL.mockRejectedValue(new Error('Status code 503'));
      const result = await fetchPostsForAccount(baseConfig, 'user1', range);
      
      expect(result).toEqual([]);
      expect(consoleSpy).toHaveBeenCalledWith('[error] Account @user1: RSS feed unavailable (503 Service Unavailable)');
      expect(consoleSpy).toHaveBeenCalledWith('[error] This is likely due to Twitter API configuration not being set up in RSSHub.');
      expect(consoleSpy).toHaveBeenCalledWith('[error] Please check docs/troubleshooting.md for Twitter API setup instructions.');
      expect(infoSpy).toHaveBeenCalledWith('[info] Continuing with other accounts...');
      
      consoleSpy.mockRestore();
      infoSpy.mockRestore();
    });

    it('handles 404 error and returns empty array', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
      
      mockParseURL.mockRejectedValue(new Error('Status code 404'));
      const result = await fetchPostsForAccount(baseConfig, 'user1', range);
      
      expect(result).toEqual([]);
      expect(consoleSpy).toHaveBeenCalledWith('[error] Account @user1: Account not found (404)');
      expect(infoSpy).toHaveBeenCalledWith('[info] Continuing with other accounts...');
      
      consoleSpy.mockRestore();
      infoSpy.mockRestore();
    });

    it('handles 429 error and returns empty array', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
      
      mockParseURL.mockRejectedValue(new Error('Status code 429'));
      const result = await fetchPostsForAccount(baseConfig, 'user1', range);
      
      expect(result).toEqual([]);
      expect(consoleSpy).toHaveBeenCalledWith('[error] Account @user1: Rate limit exceeded (429)');
      expect(consoleSpy).toHaveBeenCalledWith('[error] Please wait and try again later.');
      expect(infoSpy).toHaveBeenCalledWith('[info] Continuing with other accounts...');
      
      consoleSpy.mockRestore();
      infoSpy.mockRestore();
    });

    it('handles generic network error and returns empty array', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
      
      mockParseURL.mockRejectedValue(new Error('Network timeout'));
      const result = await fetchPostsForAccount(baseConfig, 'user1', range);
      
      expect(result).toEqual([]);
      expect(consoleSpy).toHaveBeenCalledWith('[error] Account @user1: Failed to fetch RSS feed - Network timeout');
      expect(infoSpy).toHaveBeenCalledWith('[info] Continuing with other accounts...');
      
      consoleSpy.mockRestore();
      infoSpy.mockRestore();
    });

    it('handles non-Error objects thrown from parseURL', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
      
      mockParseURL.mockRejectedValue('String error');
      const result = await fetchPostsForAccount(baseConfig, 'user1', range);
      
      expect(result).toEqual([]);
      expect(consoleSpy).toHaveBeenCalledWith('[error] Account @user1: Failed to fetch RSS feed - String error');
      expect(infoSpy).toHaveBeenCalledWith('[info] Continuing with other accounts...');
      
      consoleSpy.mockRestore();
      infoSpy.mockRestore();
    });
  });
});
