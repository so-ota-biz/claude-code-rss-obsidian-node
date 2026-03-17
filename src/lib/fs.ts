import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { State } from '../types.js';
import type { StorageProvider } from './storage.js';

export async function ensureDir(target: string): Promise<void> {
  await mkdir(target, { recursive: true });
}

export async function readState(storage: StorageProvider, stateDir: string): Promise<State> {
  const filePath = path.join(stateDir, 'state.json');
  try {
    const raw = await storage.readFile(filePath);
    return JSON.parse(raw) as State;
  } catch {
    return {};
  }
}

export async function writeState(storage: StorageProvider, stateDir: string, state: State): Promise<void> {
  const filePath = path.join(stateDir, 'state.json');
  await storage.ensureDir(stateDir);
  await storage.writeFile(filePath, JSON.stringify(state, null, 2));
}

export function resolveVaultPath(vaultRoot: string, subdir: string, filename: string): string {
  return path.join(vaultRoot, subdir, filename);
}
