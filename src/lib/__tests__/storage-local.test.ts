import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, writeFile, rmdir } from 'node:fs/promises';
import path from 'node:path';
import { LocalStorage } from '../storage-local.js';

describe('LocalStorage', () => {
  const testVaultRoot = path.join(process.cwd(), '.test-vault');
  let storage: LocalStorage;

  beforeEach(async () => {
    storage = new LocalStorage(testVaultRoot);
    await mkdir(testVaultRoot, { recursive: true });
  });

  afterEach(async () => {
    try {
      await rmdir(testVaultRoot, { recursive: true });
    } catch {
      // ignore cleanup errors
    }
  });

  describe('writeFile', () => {
    it('writes file content correctly', async () => {
      await storage.writeFile('test.txt', 'Hello, World!');
      
      const content = await storage.readFile('test.txt');
      expect(content).toBe('Hello, World!');
    });

    it('creates directories automatically', async () => {
      await storage.writeFile('nested/deep/test.txt', 'content');
      
      const content = await storage.readFile('nested/deep/test.txt');
      expect(content).toBe('content');
    });

    it('handles Buffer input (utf8 text)', async () => {
      const buffer = Buffer.from('Binary content', 'utf8');
      await storage.writeFile('binary.txt', buffer);

      const content = await storage.readFile('binary.txt');
      expect(content).toBe('Binary content');
    });

    it('preserves raw binary data (non-utf8 bytes) without corruption', async () => {
      // PNG-like byte sequence containing bytes that would be mangled by utf8 encoding
      const binaryData = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0xff, 0xfe, 0x00]);
      await storage.writeFile('image.png', binaryData);

      const { readFile: fsReadFile } = await import('node:fs/promises');
      const written = await fsReadFile(path.join(testVaultRoot, 'image.png'));
      expect(written).toEqual(binaryData);
    });
  });

  describe('readFile', () => {
    it('reads existing file', async () => {
      await writeFile(path.join(testVaultRoot, 'existing.txt'), 'Existing content', 'utf8');
      
      const content = await storage.readFile('existing.txt');
      expect(content).toBe('Existing content');
    });

    it('throws error for non-existent file', async () => {
      await expect(storage.readFile('nonexistent.txt')).rejects.toThrow();
    });
  });

  describe('ensureDir', () => {
    it('creates directory', async () => {
      await storage.ensureDir('new/directory');
      
      const exists = await storage.exists('new/directory');
      expect(exists).toBe(true);
    });

    it('succeeds for existing directory', async () => {
      await storage.ensureDir('existing');
      await storage.ensureDir('existing');
      
      const exists = await storage.exists('existing');
      expect(exists).toBe(true);
    });
  });

  describe('exists', () => {
    it('returns true for existing file', async () => {
      await storage.writeFile('exists.txt', 'content');
      
      const exists = await storage.exists('exists.txt');
      expect(exists).toBe(true);
    });

    it('returns true for existing directory', async () => {
      await storage.ensureDir('exists-dir');
      
      const exists = await storage.exists('exists-dir');
      expect(exists).toBe(true);
    });

    it('returns false for non-existent path', async () => {
      const exists = await storage.exists('does-not-exist');
      expect(exists).toBe(false);
    });
  });
});