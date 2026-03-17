import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { ensureDir, readState, writeState, resolveVaultPath } from '../fs.js';

let testDir: string;

beforeEach(async () => {
  testDir = path.join(tmpdir(), `vitest-fs-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  await mkdir(testDir, { recursive: true });
});

afterEach(async () => {
  await rm(testDir, { recursive: true, force: true });
});

describe('ensureDir', () => {
  it('creates a directory that does not exist', async () => {
    const target = path.join(testDir, 'a', 'b', 'c');
    await ensureDir(target);
    const stat = await import('node:fs/promises').then((m) => m.stat(target));
    expect(stat.isDirectory()).toBe(true);
  });

  it('does not throw if the directory already exists', async () => {
    await expect(ensureDir(testDir)).resolves.toBeUndefined();
  });
});

describe('readState', () => {
  it('returns empty object when state file does not exist', async () => {
    const result = await readState(testDir);
    expect(result).toEqual({});
  });

  it('parses and returns state from valid JSON file', async () => {
    const stateFile = path.join(testDir, 'state.json');
    const state = { lastRunDate: '2026-03-15', seenIds: ['id1', 'id2'] };
    await import('node:fs/promises').then((m) => m.writeFile(stateFile, JSON.stringify(state)));
    const result = await readState(testDir);
    expect(result).toEqual(state);
  });

  it('returns empty object when state file contains invalid JSON', async () => {
    const stateFile = path.join(testDir, 'state.json');
    await import('node:fs/promises').then((m) => m.writeFile(stateFile, 'not json'));
    const result = await readState(testDir);
    expect(result).toEqual({});
  });
});

describe('writeState', () => {
  it('writes state as JSON to the state file', async () => {
    const state = { lastRunDate: '2026-03-15', seenIds: ['id1'] };
    await writeState(testDir, state);
    const raw = await readFile(path.join(testDir, 'state.json'), 'utf8');
    expect(JSON.parse(raw)).toEqual(state);
  });

  it('creates the directory if it does not exist', async () => {
    const newDir = path.join(testDir, 'new-state-dir');
    const state = { lastRunDate: '2026-03-15' };
    await writeState(newDir, state);
    const raw = await readFile(path.join(newDir, 'state.json'), 'utf8');
    expect(JSON.parse(raw)).toEqual(state);
  });

  it('overwrites existing state file', async () => {
    await writeState(testDir, { lastRunDate: '2026-03-14' });
    await writeState(testDir, { lastRunDate: '2026-03-15' });
    const raw = await readFile(path.join(testDir, 'state.json'), 'utf8');
    expect(JSON.parse(raw).lastRunDate).toBe('2026-03-15');
  });
});

describe('resolveVaultPath', () => {
  it('joins vaultRoot, subdir, and filename', () => {
    const result = resolveVaultPath('/vault', 'AI Digest/Claude Code', '2026-03-15.md');
    expect(result).toBe(path.join('/vault', 'AI Digest/Claude Code', '2026-03-15.md'));
  });
});
