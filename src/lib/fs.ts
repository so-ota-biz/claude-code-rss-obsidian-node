import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { State } from '../types.js';

export async function ensureDir(target: string): Promise<void> {
  await mkdir(target, { recursive: true });
}

export async function readState(stateDir: string): Promise<State> {
  const filePath = path.join(stateDir, 'state.json');
  try {
    const raw = await readFile(filePath, 'utf8');
    return JSON.parse(raw) as State;
  } catch {
    return {};
  }
}

export async function writeState(stateDir: string, state: State): Promise<void> {
  await ensureDir(stateDir);
  await writeFile(path.join(stateDir, 'state.json'), JSON.stringify(state, null, 2), 'utf8');
}

export function resolveVaultPath(vaultRoot: string, subdir: string, filename: string): string {
  return path.join(vaultRoot, subdir, filename);
}
