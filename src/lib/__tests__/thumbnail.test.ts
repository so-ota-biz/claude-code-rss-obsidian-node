import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { AppConfig, DailyDigest } from '../../types.js';
import type { GeminiClient } from '../gemini.js';
import { LocalStorage } from '../storage-local.js';
import { maybeGenerateThumbnail } from '../thumbnail.js';

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
  modelImage: 'gemini-2.5-flash-image',
  thumbnailPromptStyle: 'clean, modern',
  requestTimeoutMs: 30000,
  translateBatchSize: 10,
  storageType: 'local'
};

const sampleDigest: DailyDigest = {
  title: 'Digest',
  summary: 'Summary',
  highlights: [{ headline: 'H1', whyItMatters: 'Why', points: [], sources: [] }],
  notableAccounts: ['user1']
};

const DUMMY_IMAGE = Buffer.from('dummy-image-data');

function makeMockGemini(overrides: Partial<GeminiClient> = {}): GeminiClient {
  return {
    generateImage: vi.fn().mockResolvedValue(DUMMY_IMAGE),
    translate: vi.fn(),
    translateBatch: vi.fn(),
    buildDigest: vi.fn(),
    ...overrides
  } as unknown as GeminiClient;
}

let vaultRoot: string;
let storage: LocalStorage;
let gemini: GeminiClient;

beforeEach(async () => {
  vaultRoot = path.join(tmpdir(), `vitest-thumb-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  await mkdir(vaultRoot, { recursive: true });
  storage = new LocalStorage('/');
  gemini = makeMockGemini();
});

afterEach(async () => {
  await rm(vaultRoot, { recursive: true, force: true });
});

describe('maybeGenerateThumbnail', () => {
  it('returns undefined when enableThumbnail is false', async () => {
    const config = { ...baseConfig, enableThumbnail: false };
    const result = await maybeGenerateThumbnail(config, gemini, storage, sampleDigest, '2026-03-15', vaultRoot);
    expect(result).toBeUndefined();
    expect(gemini.generateImage).not.toHaveBeenCalled();
  });

  it('returns relative path on successful image generation', async () => {
    const result = await maybeGenerateThumbnail(baseConfig, gemini, storage, sampleDigest, '2026-03-15', vaultRoot);
    expect(result).toBe(`${baseConfig.assetsSubdir}/2026-03-15.png`);
    expect(gemini.generateImage).toHaveBeenCalledOnce();
  });

  it('passes a prompt containing the digest headline to generateImage', async () => {
    await maybeGenerateThumbnail(baseConfig, gemini, storage, sampleDigest, '2026-03-15', vaultRoot);
    const [prompt] = (gemini.generateImage as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(prompt).toContain('H1');
    expect(prompt).toContain(baseConfig.thumbnailPromptStyle);
  });

  it('writes the image buffer to storage at the assets path', async () => {
    const mockStorage = {
      writeFile: vi.fn().mockResolvedValue(undefined),
      readFile: vi.fn(),
      ensureDir: vi.fn().mockResolvedValue(undefined),
      exists: vi.fn()
    };
    await maybeGenerateThumbnail(baseConfig, gemini, mockStorage, sampleDigest, '2026-03-15', vaultRoot);
    expect(mockStorage.writeFile).toHaveBeenCalledOnce();
    const [filePath, content] = mockStorage.writeFile.mock.calls[0];
    expect(filePath).toContain('2026-03-15.png');
    expect(content).toEqual(DUMMY_IMAGE);
  });

  it('throws when generateImage throws', async () => {
    const failingGemini = makeMockGemini({
      generateImage: vi.fn().mockRejectedValue(new Error('Gemini image API error 500'))
    });
    await expect(
      maybeGenerateThumbnail(baseConfig, failingGemini, storage, sampleDigest, '2026-03-15', vaultRoot)
    ).rejects.toThrow('Gemini image API error 500');
  });
});
