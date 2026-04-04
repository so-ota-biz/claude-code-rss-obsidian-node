import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TokenManager } from '../token-manager.js';
import type { TokenInfo, TokenManagerConfig } from '../token-manager.js';
import { promises as fs } from 'fs';

// Mock external dependencies
vi.mock('fs', () => ({
  promises: {
    readFile: vi.fn(),
    writeFile: vi.fn(),
    mkdir: vi.fn(),
  }
}));

const mockDropbox = {
  getAuthenticationUrl: vi.fn(),
  getAccessTokenFromCode: vi.fn(),
  getCodeVerifier: vi.fn(),
  checkAndRefreshAccessToken: vi.fn(),
  getAccessToken: vi.fn(),
  getRefreshToken: vi.fn(),
  getAccessTokenExpiresAt: vi.fn(),
};

vi.mock('dropbox', () => ({
  DropboxAuth: function MockDropboxAuth() {
    return mockDropbox;
  }
}));

describe('TokenManager', () => {
  let tokenManager: TokenManager;
  let config: TokenManagerConfig;
  let mockTokenInfo: TokenInfo;

  beforeEach(() => {
    vi.clearAllMocks();
    config = {
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret',
      tokenStoragePath: '/test/tokens.json',
      refreshToken: 'test-refresh-token'
    };
    
    mockTokenInfo = {
      accessToken: 'test-access-token',
      refreshToken: 'test-refresh-token',
      expiresAt: Date.now() + 3600 * 1000, // 1 hour from now
      tokenType: 'bearer'
    };
    
    tokenManager = new TokenManager(config);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('creates TokenManager with valid config', () => {
      expect(tokenManager).toBeInstanceOf(TokenManager);
    });
  });

  describe('generateAuthUrl', () => {
    it('generates OAuth authorization URL with PKCE', async () => {
      const mockCodeVerifier = 'mock-code-verifier';

      mockDropbox.getAuthenticationUrl.mockReturnValue('https://dropbox.com/oauth/authorize?...');
      mockDropbox.getCodeVerifier.mockReturnValue(mockCodeVerifier);

      const result = await tokenManager.generateAuthUrl('http://localhost:3000/callback');

      expect(result).toEqual({
        url: 'https://dropbox.com/oauth/authorize?...',
        codeVerifier: mockCodeVerifier
      });

      expect(mockDropbox.getAuthenticationUrl).toHaveBeenCalledWith(
        'http://localhost:3000/callback',
        undefined,
        'code',
        'offline',
        undefined,
        'none',
        true  // usePKCE — SDK generates codeVerifier/codeChallenge internally
      );
    });

    it('uses default redirect URI', async () => {
      mockDropbox.getAuthenticationUrl.mockReturnValue('https://dropbox.com/oauth/authorize');
      mockDropbox.getCodeVerifier.mockReturnValue('any-verifier');

      await tokenManager.generateAuthUrl();

      expect(mockDropbox.getAuthenticationUrl).toHaveBeenCalledWith(
        'http://localhost:8080/callback',
        undefined,
        'code',
        'offline',
        undefined,
        'none',
        true
      );
    });
  });

  describe('exchangeCodeForTokens', () => {
    it('successfully exchanges authorization code for tokens', async () => {
      const mockResponse = {
        result: {
          access_token: 'new-access-token',
          refresh_token: 'new-refresh-token',
          expires_in: 14400, // 4 hours
          token_type: 'bearer'
        }
      };

      mockDropbox.getAccessTokenFromCode.mockResolvedValue(mockResponse);
      (fs.mkdir as any).mockResolvedValue(undefined);
      (fs.writeFile as any).mockResolvedValue(undefined);

      const result = await tokenManager.exchangeCodeForTokens('auth-code', 'code-verifier');

      expect(result).toEqual({
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
        expiresAt: expect.any(Number),
        tokenType: 'bearer'
      });

      expect(mockDropbox.getAccessTokenFromCode).toHaveBeenCalledWith(
        'http://localhost:8080/callback',
        'auth-code'
        // codeVerifier is used internally by the SDK, not passed as an argument
      );

      expect(fs.writeFile).toHaveBeenCalledWith(
        config.tokenStoragePath,
        expect.stringContaining('new-access-token'),
        { mode: 0o600 }
      );
    });

    it('throws error on API failure', async () => {
      mockDropbox.getAccessTokenFromCode.mockRejectedValue(new Error('Invalid code'));

      await expect(
        tokenManager.exchangeCodeForTokens('invalid-code', 'code-verifier')
      ).rejects.toThrow('Failed to exchange code for tokens: Invalid code');
    });
  });

  describe('loadTokenInfo', () => {
    it('successfully loads token from file', async () => {
      (fs.readFile as any).mockResolvedValue(JSON.stringify(mockTokenInfo));

      const result = await tokenManager.loadTokenInfo();

      expect(result).toEqual(mockTokenInfo);
      expect(fs.readFile).toHaveBeenCalledWith(config.tokenStoragePath, 'utf-8');
    });

    it('returns null when file does not exist', async () => {
      const error = new Error('File not found') as NodeJS.ErrnoException;
      error.code = 'ENOENT';
      (fs.readFile as any).mockRejectedValue(error);

      const result = await tokenManager.loadTokenInfo();

      expect(result).toBeNull();
    });

    it('throws error for invalid token format', async () => {
      const invalidToken = { invalid: 'format' };
      (fs.readFile as any).mockResolvedValue(JSON.stringify(invalidToken));

      await expect(tokenManager.loadTokenInfo()).rejects.toThrow('Invalid token format');
    });

    it('throws error for file read errors', async () => {
      (fs.readFile as any).mockRejectedValue(new Error('Permission denied'));

      await expect(tokenManager.loadTokenInfo()).rejects.toThrow('Failed to load token info: Permission denied');
    });
  });

  describe('refreshAccessToken', () => {
    beforeEach(() => {
      // Set up current token info
      tokenManager['currentTokenInfo'] = mockTokenInfo;
    });

    it('successfully refreshes access token', async () => {
      mockDropbox.checkAndRefreshAccessToken.mockResolvedValue(undefined);
      mockDropbox.getAccessToken.mockReturnValue('refreshed-access-token');
      mockDropbox.getRefreshToken.mockReturnValue(undefined);
      mockDropbox.getAccessTokenExpiresAt.mockReturnValue(new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString());
      (fs.mkdir as any).mockResolvedValue(undefined);
      (fs.writeFile as any).mockResolvedValue(undefined);

      const result = await tokenManager['refreshAccessToken']();

      expect(result.accessToken).toBe('refreshed-access-token');
      expect(result.refreshToken).toBe('test-refresh-token'); // Should keep original refresh token
      expect(mockDropbox.checkAndRefreshAccessToken).toHaveBeenCalled();
    });

    it('throws error when no refresh token available', async () => {
      tokenManager['currentTokenInfo'] = null;

      await expect(
        tokenManager['refreshAccessToken']()
      ).rejects.toThrow('No refresh token available for token refresh');
    });

    it('throws error on API failure', async () => {
      mockDropbox.checkAndRefreshAccessToken.mockRejectedValue(new Error('Invalid refresh token'));

      await expect(
        tokenManager['refreshAccessToken']()
      ).rejects.toThrow('Failed to refresh access token: Invalid refresh token');
    });
  });

  describe('getValidAccessToken', () => {
    it('returns current token when still valid', async () => {
      tokenManager['currentTokenInfo'] = {
        ...mockTokenInfo,
        expiresAt: Date.now() + 10 * 60 * 1000 // 10 minutes from now
      };

      const token = await tokenManager.getValidAccessToken();

      expect(token).toBe('test-access-token');
    });

    it('loads token from storage when not in memory', async () => {
      (fs.readFile as any).mockResolvedValue(JSON.stringify(mockTokenInfo));

      const token = await tokenManager.getValidAccessToken();

      expect(token).toBe('test-access-token');
      expect(fs.readFile).toHaveBeenCalledWith(config.tokenStoragePath, 'utf-8');
    });

    it('refreshes token when expired', async () => {
      const expiredTokenInfo = {
        ...mockTokenInfo,
        expiresAt: Date.now() - 1000 // 1 second ago (expired)
      };

      tokenManager['currentTokenInfo'] = expiredTokenInfo;

      mockDropbox.checkAndRefreshAccessToken.mockResolvedValue(undefined);
      mockDropbox.getAccessToken.mockReturnValue('refreshed-access-token');
      mockDropbox.getRefreshToken.mockReturnValue(undefined);
      mockDropbox.getAccessTokenExpiresAt.mockReturnValue(new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString());
      (fs.mkdir as any).mockResolvedValue(undefined);
      (fs.writeFile as any).mockResolvedValue(undefined);

      const token = await tokenManager.getValidAccessToken();

      expect(token).toBe('refreshed-access-token');
    });

    it('refreshes token when expiring soon (within buffer)', async () => {
      const soonToExpireTokenInfo = {
        ...mockTokenInfo,
        expiresAt: Date.now() + 2 * 60 * 1000 // 2 minutes from now (within 5-minute buffer)
      };

      tokenManager['currentTokenInfo'] = soonToExpireTokenInfo;

      mockDropbox.checkAndRefreshAccessToken.mockResolvedValue(undefined);
      mockDropbox.getAccessToken.mockReturnValue('refreshed-access-token');
      mockDropbox.getRefreshToken.mockReturnValue(undefined);
      mockDropbox.getAccessTokenExpiresAt.mockReturnValue(new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString());
      (fs.mkdir as any).mockResolvedValue(undefined);
      (fs.writeFile as any).mockResolvedValue(undefined);

      const token = await tokenManager.getValidAccessToken();

      expect(token).toBe('refreshed-access-token');
    });

    it('uses config refresh token when no token info available', async () => {
      tokenManager['currentTokenInfo'] = null;
      (fs.readFile as any).mockRejectedValue({ code: 'ENOENT' });

      mockDropbox.checkAndRefreshAccessToken.mockResolvedValue(undefined);
      mockDropbox.getAccessToken.mockReturnValue('initial-access-token');
      mockDropbox.getRefreshToken.mockReturnValue(undefined);
      mockDropbox.getAccessTokenExpiresAt.mockReturnValue(new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString());
      (fs.mkdir as any).mockResolvedValue(undefined);
      (fs.writeFile as any).mockResolvedValue(undefined);

      const token = await tokenManager.getValidAccessToken();

      expect(token).toBe('initial-access-token');
    });

    it('throws error when no authentication available', async () => {
      const configWithoutRefreshToken = {
        ...config,
        refreshToken: undefined
      };
      
      const tokenManagerWithoutRefresh = new TokenManager(configWithoutRefreshToken);
      (fs.readFile as any).mockRejectedValue({ code: 'ENOENT' });

      await expect(
        tokenManagerWithoutRefresh.getValidAccessToken()
      ).rejects.toThrow('No token info available. Please run OAuth authentication first.');
    });

    it('handles concurrent refresh requests', async () => {
      const expiredTokenInfo = {
        ...mockTokenInfo,
        expiresAt: Date.now() - 1000
      };

      tokenManager['currentTokenInfo'] = expiredTokenInfo;

      mockDropbox.checkAndRefreshAccessToken.mockResolvedValue(undefined);
      mockDropbox.getAccessToken.mockReturnValue('refreshed-access-token');
      mockDropbox.getRefreshToken.mockReturnValue(undefined);
      mockDropbox.getAccessTokenExpiresAt.mockReturnValue(new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString());
      (fs.mkdir as any).mockResolvedValue(undefined);
      (fs.writeFile as any).mockResolvedValue(undefined);

      // Make multiple concurrent calls
      const promises = [
        tokenManager.getValidAccessToken(),
        tokenManager.getValidAccessToken(),
        tokenManager.getValidAccessToken()
      ];

      const results = await Promise.all(promises);

      // All should return the same refreshed token
      results.forEach(token => {
        expect(token).toBe('refreshed-access-token');
      });

      // Refresh should only be called once
      expect(mockDropbox.checkAndRefreshAccessToken).toHaveBeenCalledTimes(1);
    });
  });

  describe('initializeWithRefreshToken', () => {
    it('initializes and gets access token', async () => {
      mockDropbox.checkAndRefreshAccessToken.mockResolvedValue(undefined);
      mockDropbox.getAccessToken.mockReturnValue('initial-access-token');
      mockDropbox.getRefreshToken.mockReturnValue(undefined);
      mockDropbox.getAccessTokenExpiresAt.mockReturnValue(new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString());
      (fs.mkdir as any).mockResolvedValue(undefined);
      (fs.writeFile as any).mockResolvedValue(undefined);

      await tokenManager.initializeWithRefreshToken('new-refresh-token');

      expect(tokenManager['currentTokenInfo']?.refreshToken).toBe('new-refresh-token');
      expect(mockDropbox.checkAndRefreshAccessToken).toHaveBeenCalled();
    });
  });

  describe('isAuthenticated', () => {
    it('returns true when refresh token is available', async () => {
      tokenManager['currentTokenInfo'] = mockTokenInfo;

      const isAuth = await tokenManager.isAuthenticated();

      expect(isAuth).toBe(true);
    });

    it('returns true when token can be loaded from storage', async () => {
      tokenManager['currentTokenInfo'] = null;
      (fs.readFile as any).mockResolvedValue(JSON.stringify(mockTokenInfo));

      const isAuth = await tokenManager.isAuthenticated();

      expect(isAuth).toBe(true);
    });

    it('returns false when no token available', async () => {
      tokenManager['currentTokenInfo'] = null;
      (fs.readFile as any).mockRejectedValue(new Error('Not found'));

      const isAuth = await tokenManager.isAuthenticated();

      expect(isAuth).toBe(false);
    });
  });
});