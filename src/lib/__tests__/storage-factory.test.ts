import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createStorageProvider } from '../storage-factory.js';
import { LocalStorage } from '../storage-local.js';
import { DropboxStorage } from '../storage-dropbox.js';
import { TokenManager } from '../token-manager.js';
import type { AppConfig } from '../../types.js';

// Mock dependencies
vi.mock('../storage-local.js');
vi.mock('../storage-dropbox.js');
vi.mock('../token-manager.js');

describe('createStorageProvider', () => {
  let baseConfig: AppConfig;

  beforeEach(() => {
    vi.clearAllMocks();
    
    baseConfig = {
      geminiApiKey: 'test-key',
      rsshubBaseUrl: 'http://localhost:1200',
      rsshubRouteTemplate: '/twitter/user/:account',
      obsidianVaultPath: '/test/vault',
      targetAccounts: ['test'],
      timezone: 'Asia/Tokyo',
      outputSubdir: 'output',
      rawSubdir: 'raw',
      assetsSubdir: 'assets',
      stateDir: '.state',
      maxPostsPerAccount: 20,
      onlyIncludeOriginalPosts: true,
      skipRetweets: true,
      skipReplies: true,
      enableTranslation: true,
      enableDigest: true,
      enableThumbnail: true,
      maxHighlights: 5,
      thumbnailImageExt: 'png',
      modelText: 'gemini-2.5-flash-lite',
      thumbnailPromptStyle: 'style',
      requestTimeoutMs: 30000,
      storageType: 'local',
      dropboxBasePath: '/'
    };
  });

  describe('local storage', () => {
    it('creates LocalStorage when storage type is local', () => {
      const config = { ...baseConfig, storageType: 'local' as const };
      
      createStorageProvider(config);
      
      expect(LocalStorage).toHaveBeenCalledWith('/test/vault');
    });

    it('creates LocalStorage by default', () => {
      const config = { ...baseConfig };
      delete (config as any).storageType;
      
      createStorageProvider(config);
      
      expect(LocalStorage).toHaveBeenCalledWith('/test/vault');
    });
  });

  describe('dropbox storage with OAuth', () => {
    it('creates DropboxStorage with TokenManager when CLIENT_ID is provided', () => {
      const config = {
        ...baseConfig,
        storageType: 'dropbox' as const,
        dropboxOAuthComplete: true,
        dropboxClientId: 'test-client-id',
        dropboxClientSecret: 'test-client-secret',
        dropboxRefreshToken: 'test-refresh-token',
        dropboxTokenStoragePath: '/test/tokens.json',
        dropboxBasePath: '/test/path'
      };

      createStorageProvider(config);

      expect(TokenManager).toHaveBeenCalledWith({
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
        tokenStoragePath: '/test/tokens.json',
        refreshToken: 'test-refresh-token'
      });
      
      expect(DropboxStorage).toHaveBeenCalledWith(
        expect.any(Object), // TokenManager instance
        '/test/path'
      );
    });

    it('uses default token storage path when not specified', () => {
      const config = {
        ...baseConfig,
        storageType: 'dropbox' as const,
        dropboxOAuthComplete: true,
        dropboxClientId: 'test-client-id',
        dropboxClientSecret: 'test-client-secret',
        dropboxRefreshToken: 'test-refresh-token'
      };

      createStorageProvider(config);

      expect(TokenManager).toHaveBeenCalledWith({
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
        tokenStoragePath: expect.stringContaining('dropbox-tokens.json'),
        refreshToken: 'test-refresh-token'
      });
    });

    it('handles OAuth config without refresh token for first-time setup', () => {
      const config = {
        ...baseConfig,
        storageType: 'dropbox' as const,
        dropboxOAuthComplete: true,
        dropboxClientId: 'test-client-id',
        dropboxClientSecret: 'test-client-secret',
        dropboxTokenStoragePath: '/test/tokens.json'
      };

      createStorageProvider(config);

      expect(TokenManager).toHaveBeenCalledWith({
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
        tokenStoragePath: '/test/tokens.json',
        refreshToken: undefined
      });
    });
  });

  describe('dropbox storage with legacy access token', () => {
    it('creates DropboxStorage with access token when CLIENT_ID is not provided', () => {
      const config = {
        ...baseConfig,
        storageType: 'dropbox' as const,
        dropboxAccessToken: 'legacy-access-token',
        dropboxBasePath: '/legacy/path'
      };
      
      createStorageProvider(config);
      
      expect(DropboxStorage).toHaveBeenCalledWith(
        'legacy-access-token',
        '/legacy/path'
      );
      
      expect(TokenManager).not.toHaveBeenCalled();
    });

    it('throws error when no authentication method is provided', () => {
      const config = {
        ...baseConfig,
        storageType: 'dropbox' as const
      };
      
      expect(() => createStorageProvider(config)).toThrow(
        'Dropbox configuration error: Either DROPBOX_ACCESS_TOKEN (legacy) or DROPBOX_CLIENT_ID + DROPBOX_CLIENT_SECRET + (DROPBOX_REFRESH_TOKEN or DROPBOX_TOKEN_STORAGE_PATH) (OAuth 2.0) is required'
      );
    });
  });

  describe('priority handling', () => {
    it('prefers OAuth configuration over legacy access token when both are provided', () => {
      const config = {
        ...baseConfig,
        storageType: 'dropbox' as const,
        dropboxOAuthComplete: true,
        dropboxClientId: 'test-client-id',
        dropboxClientSecret: 'test-client-secret',
        dropboxRefreshToken: 'test-refresh-token',
        dropboxAccessToken: 'legacy-token', // Should be ignored
        dropboxTokenStoragePath: '/test/tokens.json',
        dropboxBasePath: '/test/path'
      };

      createStorageProvider(config);

      // Should create TokenManager (OAuth mode)
      expect(TokenManager).toHaveBeenCalledWith({
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
        tokenStoragePath: '/test/tokens.json',
        refreshToken: 'test-refresh-token'
      });
      
      // Should pass TokenManager to DropboxStorage, not the legacy token
      expect(DropboxStorage).toHaveBeenCalledWith(
        expect.any(Object), // TokenManager instance, not string
        '/test/path'
      );
    });

    it('falls back to legacy token when dropboxOAuthComplete is false even if CLIENT_ID/SECRET are present', () => {
      // Regression: partial OAuth config (missing refresh token + no explicit token storage path)
      // should not trigger TokenManager mode and should fall back to the valid access token
      const config = {
        ...baseConfig,
        storageType: 'dropbox' as const,
        dropboxOAuthComplete: false,
        dropboxClientId: 'test-client-id',
        dropboxClientSecret: 'test-client-secret',
        dropboxAccessToken: 'valid-legacy-token',
        dropboxBasePath: '/test/path'
      };

      createStorageProvider(config);

      expect(TokenManager).not.toHaveBeenCalled();
      expect(DropboxStorage).toHaveBeenCalledWith('valid-legacy-token', '/test/path');
    });
  });

  describe('path handling', () => {
    it('uses base path from config', () => {
      const config = {
        ...baseConfig,
        storageType: 'dropbox' as const,
        dropboxAccessToken: 'test-token',
        dropboxBasePath: '/custom/base/path'
      };
      
      createStorageProvider(config);
      
      expect(DropboxStorage).toHaveBeenCalledWith(
        'test-token',
        '/custom/base/path'
      );
    });

    it('uses undefined base path when not specified (defaults to root)', () => {
      const config = {
        ...baseConfig,
        storageType: 'dropbox' as const,
        dropboxAccessToken: 'test-token'
      };
      delete config.dropboxBasePath;
      
      createStorageProvider(config);
      
      expect(DropboxStorage).toHaveBeenCalledWith(
        'test-token',
        undefined
      );
    });
  });
});