import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { AppConfig, DailyDigest } from '../../types.js';
import { LocalStorage } from '../storage-local.js';

// Mock child_process before importing thumbnail
vi.mock('node:child_process', () => ({
  spawn: vi.fn()
}));

import { maybeGenerateThumbnail } from '../thumbnail.js';
import { spawn } from 'node:child_process';
import { EventEmitter } from 'node:events';

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
  thumbnailCommand: 'echo {promptFile} {outputPath}',
  thumbnailImageExt: 'png',
  modelText: 'gemini-2.5-flash-lite',
  thumbnailPromptStyle: 'clean, modern',
  requestTimeoutMs: 30000,
  storageType: 'local'
};

const sampleDigest: DailyDigest = {
  title: 'Digest',
  summary: 'Summary',
  highlights: [{ headline: 'H1', whyItMatters: 'Why', points: [], sources: [] }],
  notableAccounts: ['user1']
};

function makeSpawnMock(exitCode: number) {
  vi.mocked(spawn).mockImplementation(() => {
    const emitter = new EventEmitter();
    setImmediate(() => emitter.emit('exit', exitCode));
    return emitter as ReturnType<typeof spawn>;
  });
}

let vaultRoot: string;
let storage: LocalStorage;

beforeEach(async () => {
  vaultRoot = path.join(tmpdir(), `vitest-thumb-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  await mkdir(vaultRoot, { recursive: true });
  storage = new LocalStorage('/');
  vi.clearAllMocks();
});

afterEach(async () => {
  await rm(vaultRoot, { recursive: true, force: true });
});

describe('maybeGenerateThumbnail', () => {
  it('returns undefined when enableThumbnail is false', async () => {
    const config = { ...baseConfig, enableThumbnail: false, obsidianVaultPath: vaultRoot };
    const result = await maybeGenerateThumbnail(config, storage, sampleDigest, '2026-03-15', vaultRoot);
    expect(result).toBeUndefined();
    expect(spawn).not.toHaveBeenCalled();
  });

  it('returns undefined when thumbnailCommand is not set', async () => {
    const config = { ...baseConfig, thumbnailCommand: undefined, obsidianVaultPath: vaultRoot };
    const result = await maybeGenerateThumbnail(config, storage, sampleDigest, '2026-03-15', vaultRoot);
    expect(result).toBeUndefined();
    expect(spawn).not.toHaveBeenCalled();
  });

  it('returns relative path on successful spawn (exit code 0)', async () => {
    makeSpawnMock(0);
    const config = { ...baseConfig, obsidianVaultPath: vaultRoot };
    const result = await maybeGenerateThumbnail(config, storage, sampleDigest, '2026-03-15', vaultRoot);
    expect(result).toBe(`${config.assetsSubdir}/2026-03-15.png`);
    expect(spawn).toHaveBeenCalledOnce();
  });

  it('throws when spawn exits with non-zero code', async () => {
    makeSpawnMock(1);
    const config = { ...baseConfig, obsidianVaultPath: vaultRoot };
    await expect(
      maybeGenerateThumbnail(config, storage, sampleDigest, '2026-03-15', vaultRoot)
    ).rejects.toThrow('exit code 1');
  });

  it('passes substituted promptFile and outputPath to spawn args', async () => {
    makeSpawnMock(0);
    const config = { ...baseConfig, obsidianVaultPath: vaultRoot };
    await maybeGenerateThumbnail(config, storage, sampleDigest, '2026-03-15', vaultRoot);

    expect(spawn).toHaveBeenCalledOnce();
    const [cmd, args] = vi.mocked(spawn).mock.calls[0];
    expect(cmd).toBe('echo');
    expect(args[0]).toContain('2026-03-15.thumbnail-prompt.txt');
    expect(args[1]).toContain('2026-03-15.png');
  });
});
