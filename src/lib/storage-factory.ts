import type { AppConfig } from '../types.js';
import type { StorageProvider } from './storage.js';
import { LocalStorage } from './storage-local.js';
import { DropboxStorage } from './storage-dropbox.js';

export function createStorageProvider(config: AppConfig): StorageProvider {
  switch (config.storageType) {
    case 'dropbox':
      if (!config.dropboxAccessToken) {
        throw new Error('Dropbox access token is required when storage type is "dropbox"');
      }
      return new DropboxStorage(config.dropboxAccessToken, config.dropboxBasePath);
    case 'local':
    default:
      return new LocalStorage(config.obsidianVaultPath);
  }
}