import type { AppConfig } from '../types.js';
import type { StorageProvider } from './storage.js';
import { LocalStorage } from './storage-local.js';
import { DropboxStorage } from './storage-dropbox.js';
import { TokenManager } from './token-manager.js';
import { join } from 'path';

export function createStorageProvider(config: AppConfig): StorageProvider {
  switch (config.storageType) {
    case 'dropbox':
      // Prefer OAuth 2.0 configuration over legacy access token
      if (config.dropboxClientId && config.dropboxClientSecret) {
        const tokenManager = new TokenManager({
          clientId: config.dropboxClientId,
          clientSecret: config.dropboxClientSecret,
          tokenStoragePath: config.dropboxTokenStoragePath || join(process.cwd(), '.state', 'dropbox-tokens.json'),
          refreshToken: config.dropboxRefreshToken,
        });
        return new DropboxStorage(tokenManager, config.dropboxBasePath);
      }

      // Fallback to legacy access token mode
      if (!config.dropboxAccessToken) {
        throw new Error('Dropbox configuration error: Either DROPBOX_ACCESS_TOKEN (legacy) or DROPBOX_CLIENT_ID + DROPBOX_CLIENT_SECRET + DROPBOX_REFRESH_TOKEN (OAuth 2.0) is required');
      }
      return new DropboxStorage(config.dropboxAccessToken, config.dropboxBasePath);
    case 'local':
    default:
      return new LocalStorage(config.obsidianVaultPath);
  }
}