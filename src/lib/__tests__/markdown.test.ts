import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { writeDigestMarkdown, writeRawMarkdown } from '../markdown.js';
import type { DailyDigest, ProcessedPost } from '../../types.js';

let vaultRoot: string;

beforeEach(async () => {
  vaultRoot = path.join(tmpdir(), `vitest-md-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  await mkdir(vaultRoot, { recursive: true });
});

afterEach(async () => {
  await rm(vaultRoot, { recursive: true, force: true });
});

const sampleDigest: DailyDigest = {
  title: 'Claude Code Daily - 2026-03-15',
  summary: 'Today summary',
  highlights: [
    {
      headline: 'Feature A released',
      whyItMatters: 'Improves productivity',
      points: ['Point 1', 'Point 2'],
      sources: ['https://x.com/user1/status/1']
    }
  ],
  notableAccounts: ['user1', 'user2']
};

const samplePosts: ProcessedPost[] = [
  {
    account: 'user1',
    title: 'Post title',
    link: 'https://x.com/user1/status/1',
    id: 'id-1',
    publishedAt: '2026-03-15T10:00:00.000Z',
    content: 'Original English content',
    translatedText: '日本語の翻訳',
    language: 'en'
  }
];

describe('writeDigestMarkdown', () => {
  it('creates the output file at the expected path', async () => {
    const filePath = await writeDigestMarkdown({
      vaultRoot,
      outputSubdir: 'AI Digest/Claude Code',
      day: '2026-03-15',
      digest: sampleDigest
    });
    expect(filePath).toBe(path.join(vaultRoot, 'AI Digest/Claude Code', '2026-03-15.md'));
    const stat = await import('node:fs/promises').then((m) => m.stat(filePath));
    expect(stat.isFile()).toBe(true);
  });

  it('includes frontmatter with title, date, and tags', async () => {
    const filePath = await writeDigestMarkdown({
      vaultRoot,
      outputSubdir: 'AI Digest',
      day: '2026-03-15',
      digest: sampleDigest
    });
    const content = await readFile(filePath, 'utf8');
    expect(content).toContain('---');
    expect(content).toContain('date: 2026-03-15');
    expect(content).toContain('claude-code');
  });

  it('includes digest title and summary', async () => {
    const filePath = await writeDigestMarkdown({
      vaultRoot,
      outputSubdir: 'AI Digest',
      day: '2026-03-15',
      digest: sampleDigest
    });
    const content = await readFile(filePath, 'utf8');
    expect(content).toContain('Claude Code Daily - 2026-03-15');
    expect(content).toContain('Today summary');
  });

  it('includes highlight headline and points', async () => {
    const filePath = await writeDigestMarkdown({
      vaultRoot,
      outputSubdir: 'AI Digest',
      day: '2026-03-15',
      digest: sampleDigest
    });
    const content = await readFile(filePath, 'utf8');
    expect(content).toContain('Feature A released');
    expect(content).toContain('Point 1');
    expect(content).toContain('https://x.com/user1/status/1');
  });

  it('includes notable accounts', async () => {
    const filePath = await writeDigestMarkdown({
      vaultRoot,
      outputSubdir: 'AI Digest',
      day: '2026-03-15',
      digest: sampleDigest
    });
    const content = await readFile(filePath, 'utf8');
    expect(content).toContain('@user1');
    expect(content).toContain('@user2');
  });

  it('includes thumbnail info when thumbnailRelativePath is provided', async () => {
    const filePath = await writeDigestMarkdown({
      vaultRoot,
      outputSubdir: 'AI Digest',
      day: '2026-03-15',
      digest: sampleDigest,
      thumbnailRelativePath: 'AI Digest/Claude Code/assets/2026-03-15.png'
    });
    const content = await readFile(filePath, 'utf8');
    expect(content).toContain('thumbnail:');
    expect(content).toContain('2026-03-15.png');
  });

  it('does not include thumbnail when thumbnailRelativePath is not provided', async () => {
    const filePath = await writeDigestMarkdown({
      vaultRoot,
      outputSubdir: 'AI Digest',
      day: '2026-03-15',
      digest: sampleDigest
    });
    const content = await readFile(filePath, 'utf8');
    expect(content).not.toContain('thumbnail:');
  });
});

describe('writeRawMarkdown', () => {
  it('creates the output file at the expected path', async () => {
    const filePath = await writeRawMarkdown({
      vaultRoot,
      rawSubdir: 'AI Digest/raw',
      day: '2026-03-15',
      posts: samplePosts
    });
    expect(filePath).toBe(path.join(vaultRoot, 'AI Digest/raw', '2026-03-15.md'));
    const stat = await import('node:fs/promises').then((m) => m.stat(filePath));
    expect(stat.isFile()).toBe(true);
  });

  it('includes frontmatter', async () => {
    const filePath = await writeRawMarkdown({
      vaultRoot,
      rawSubdir: 'AI Digest/raw',
      day: '2026-03-15',
      posts: samplePosts
    });
    const content = await readFile(filePath, 'utf8');
    expect(content).toContain('---');
    expect(content).toContain('date: 2026-03-15');
  });

  it('includes post account, link, publishedAt, language, content, translatedText', async () => {
    const filePath = await writeRawMarkdown({
      vaultRoot,
      rawSubdir: 'AI Digest/raw',
      day: '2026-03-15',
      posts: samplePosts
    });
    const content = await readFile(filePath, 'utf8');
    expect(content).toContain('@user1');
    expect(content).toContain('https://x.com/user1/status/1');
    expect(content).toContain('2026-03-15T10:00:00.000Z');
    expect(content).toContain('en');
    expect(content).toContain('Original English content');
    expect(content).toContain('日本語の翻訳');
  });

  it('writes an empty post list without error', async () => {
    const filePath = await writeRawMarkdown({
      vaultRoot,
      rawSubdir: 'AI Digest/raw',
      day: '2026-03-15',
      posts: []
    });
    const content = await readFile(filePath, 'utf8');
    expect(content).toContain('Claude Code Raw Feed 2026-03-15');
  });
});
