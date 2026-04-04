import { mkdir, readFile, writeFile, access } from 'node:fs/promises';
import path from 'node:path';
import type { StorageProvider } from './storage.js';

export class LocalStorage implements StorageProvider {
  constructor(private vaultRoot: string) {}

  async writeFile(filePath: string, content: string | Buffer): Promise<void> {
    const fullPath = path.resolve(this.vaultRoot, filePath);
    await this.ensureDir(path.dirname(fullPath));
    if (Buffer.isBuffer(content)) {
      await writeFile(fullPath, content);
    } else {
      await writeFile(fullPath, content, 'utf8');
    }
  }

  async readFile(filePath: string): Promise<string> {
    const fullPath = path.resolve(this.vaultRoot, filePath);
    return await readFile(fullPath, 'utf8');
  }

  async ensureDir(dirPath: string): Promise<void> {
    const fullPath = path.resolve(this.vaultRoot, dirPath);
    await mkdir(fullPath, { recursive: true });
  }

  async exists(filePath: string): Promise<boolean> {
    const fullPath = path.resolve(this.vaultRoot, filePath);
    try {
      await access(fullPath);
      return true;
    } catch {
      return false;
    }
  }
}