import { describe, it, expect } from 'vitest';
import { createStorageProvider } from '../storage-factory.js';
import { LocalStorage } from '../storage-local.js';
import { DropboxStorage } from '../storage-dropbox.js';
import type { AppConfig } from '../../types.js';

describe('Storage Factory', () => {
  it('creates LocalStorage for local type', () => {
    const config = {
      storageType: 'local' as const,
      obsidianVaultPath: '/test/vault'
    } as AppConfig;

    const storage = createStorageProvider(config);
    expect(storage).toBeInstanceOf(LocalStorage);
  });

  it('creates DropboxStorage for dropbox type with token', () => {
    const config = {
      storageType: 'dropbox' as const,
      dropboxAccessToken: 'test-token',
      dropboxBasePath: '/test'
    } as AppConfig;

    const storage = createStorageProvider(config);
    expect(storage).toBeInstanceOf(DropboxStorage);
  });

  it('throws error for dropbox type without token', () => {
    const config = {
      storageType: 'dropbox' as const,
      dropboxAccessToken: undefined
    } as AppConfig;

    expect(() => createStorageProvider(config)).toThrow('Dropbox configuration error: Either DROPBOX_ACCESS_TOKEN (legacy) or DROPBOX_CLIENT_ID + DROPBOX_CLIENT_SECRET + DROPBOX_REFRESH_TOKEN (OAuth 2.0) is required');
  });

  it('defaults to LocalStorage for unknown types', () => {
    const config = {
      storageType: 'unknown' as any,
      obsidianVaultPath: '/test/vault'
    } as AppConfig;

    const storage = createStorageProvider(config);
    expect(storage).toBeInstanceOf(LocalStorage);
  });
});