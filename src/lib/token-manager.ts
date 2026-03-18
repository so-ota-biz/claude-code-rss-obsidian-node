import { Dropbox } from 'dropbox';
import { promises as fs } from 'fs';
import * as crypto from 'crypto';
import { join } from 'path';

export interface TokenInfo {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // Unix timestamp in milliseconds
  tokenType?: string;
}

export interface TokenManagerConfig {
  clientId: string;
  tokenStoragePath: string;
  refreshToken?: string; // For initial setup
}

export class TokenManager {
  private dropbox: Dropbox;
  private config: TokenManagerConfig;
  private currentTokenInfo: TokenInfo | null = null;
  private refreshPromise: Promise<TokenInfo> | null = null;

  constructor(config: TokenManagerConfig) {
    this.config = config;
    this.dropbox = new Dropbox({
      clientId: config.clientId,
    });
  }

  /**
   * Generate PKCE parameters for OAuth 2.0 flow
   */
  private generatePKCEParams(): { codeVerifier: string; codeChallenge: string } {
    const codeVerifier = crypto.randomBytes(32).toString('base64url');
    const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url');
    return { codeVerifier, codeChallenge };
  }

  /**
   * Generate OAuth 2.0 authorization URL for initial setup
   */
  async generateAuthUrl(redirectUri = 'http://localhost:8080/callback'): Promise<{
    url: string;
    codeVerifier: string;
  }> {
    const { codeVerifier, codeChallenge } = this.generatePKCEParams();
    
    const authUrl = this.dropbox.getAuthenticationUrl(
      redirectUri,
      undefined,
      'code',
      'offline',
      undefined,
      undefined,
      true, // use PKCE
      codeChallenge
    );

    return { url: authUrl, codeVerifier };
  }

  /**
   * Exchange authorization code for access and refresh tokens
   */
  async exchangeCodeForTokens(
    authCode: string,
    codeVerifier: string,
    redirectUri = 'http://localhost:8080/callback'
  ): Promise<TokenInfo> {
    try {
      const response = await this.dropbox.getAccessTokenFromCode(
        redirectUri,
        authCode,
        codeVerifier
      );

      const tokenInfo: TokenInfo = {
        accessToken: response.result.access_token,
        refreshToken: response.result.refresh_token,
        expiresAt: Date.now() + (response.result.expires_in * 1000), // Convert seconds to milliseconds
        tokenType: response.result.token_type,
      };

      await this.saveTokenInfo(tokenInfo);
      this.currentTokenInfo = tokenInfo;
      
      return tokenInfo;
    } catch (error) {
      throw new Error(`Failed to exchange code for tokens: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Load token info from storage
   */
  async loadTokenInfo(): Promise<TokenInfo | null> {
    try {
      const tokenData = await fs.readFile(this.config.tokenStoragePath, 'utf-8');
      const tokenInfo: TokenInfo = JSON.parse(tokenData);
      
      // Basic validation
      if (!tokenInfo.accessToken || !tokenInfo.refreshToken || !tokenInfo.expiresAt) {
        throw new Error('Invalid token format');
      }
      
      this.currentTokenInfo = tokenInfo;
      return tokenInfo;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return null; // File doesn't exist
      }
      throw new Error(`Failed to load token info: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Save token info to storage with secure permissions
   */
  private async saveTokenInfo(tokenInfo: TokenInfo): Promise<void> {
    try {
      // Ensure directory exists
      const tokenDir = join(this.config.tokenStoragePath, '..');
      await fs.mkdir(tokenDir, { recursive: true });

      // Save token file
      await fs.writeFile(
        this.config.tokenStoragePath,
        JSON.stringify(tokenInfo, null, 2),
        { mode: 0o600 } // Read/write for owner only
      );
      
      this.currentTokenInfo = tokenInfo;
    } catch (error) {
      throw new Error(`Failed to save token info: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Check if current access token is expired or will expire soon
   */
  private isTokenExpired(tokenInfo: TokenInfo, bufferMinutes = 5): boolean {
    const bufferMs = bufferMinutes * 60 * 1000;
    return Date.now() >= (tokenInfo.expiresAt - bufferMs);
  }

  /**
   * Refresh access token using refresh token
   */
  private async refreshAccessToken(): Promise<TokenInfo> {
    if (!this.currentTokenInfo?.refreshToken) {
      throw new Error('No refresh token available for token refresh');
    }

    try {
      // Create a new Dropbox instance with refresh token for token refresh
      // Note: clientSecret is required for refresh token flow in Dropbox SDK v10
      const refreshDropbox = new Dropbox({
        clientId: this.config.clientId,
        clientSecret: process.env.DROPBOX_CLIENT_SECRET,
        refreshToken: this.currentTokenInfo.refreshToken,
      });
      
      const response = await refreshDropbox.auth.refreshAccessToken();
      
      // Debug: Log response structure
      console.log('Refresh token response:', JSON.stringify(response, null, 2));
      
      // Handle different response formats
      const tokenData = response?.result || response;
      if (!tokenData || !tokenData.access_token) {
        throw new Error(`Invalid token response format: ${JSON.stringify(response)}`);
      }
      
      const newTokenInfo: TokenInfo = {
        accessToken: tokenData.access_token,
        refreshToken: this.currentTokenInfo.refreshToken, // Refresh token typically doesn't change
        expiresAt: Date.now() + (tokenData.expires_in * 1000),
        tokenType: tokenData.token_type || 'Bearer',
      };

      await this.saveTokenInfo(newTokenInfo);
      
      return newTokenInfo;
    } catch (error) {
      // Provide more detailed error information for debugging
      if (error && typeof error === 'object' && 'response' in error) {
        const response = (error as any).response;
        throw new Error(`Failed to refresh access token: HTTP ${response?.status || 'unknown'} - ${JSON.stringify(response?.body || error)}`);
      }
      throw new Error(`Failed to refresh access token: ${error instanceof Error ? error.message : JSON.stringify(error)}`);
    }
  }

  /**
   * Get valid access token, refreshing if necessary
   */
  async getValidAccessToken(): Promise<string> {
    // If we don't have token info, try to load from storage
    if (!this.currentTokenInfo) {
      this.currentTokenInfo = await this.loadTokenInfo();
    }

    // If still no token info and we have a refresh token in config, use it
    if (!this.currentTokenInfo && this.config.refreshToken) {
      this.currentTokenInfo = {
        accessToken: '', // Will be refreshed immediately
        refreshToken: this.config.refreshToken,
        expiresAt: 0, // Expired, will trigger refresh
      };
    }

    if (!this.currentTokenInfo) {
      throw new Error('No token info available. Please run OAuth authentication first.');
    }

    // Check if token needs refresh
    if (this.isTokenExpired(this.currentTokenInfo)) {
      // If already refreshing, wait for that promise
      if (this.refreshPromise) {
        this.currentTokenInfo = await this.refreshPromise;
      } else {
        // Start refresh process
        this.refreshPromise = this.refreshAccessToken();
        try {
          this.currentTokenInfo = await this.refreshPromise;
        } finally {
          this.refreshPromise = null;
        }
      }
    }

    return this.currentTokenInfo.accessToken;
  }

  /**
   * Initialize TokenManager with existing refresh token
   */
  async initializeWithRefreshToken(refreshToken: string): Promise<void> {
    this.currentTokenInfo = {
      accessToken: '', // Will be refreshed immediately
      refreshToken,
      expiresAt: 0, // Expired, will trigger refresh
    };
    
    // Trigger initial refresh to get access token
    await this.getValidAccessToken();
  }

  /**
   * Force refresh access token regardless of expiration time
   * Useful when a 401 error indicates the token has been revoked
   */
  async forceRefreshAccessToken(): Promise<string> {
    // Load current token info if not available
    if (!this.currentTokenInfo) {
      this.currentTokenInfo = await this.loadTokenInfo();
    }

    // If still no token info and we have a refresh token in config, use it
    if (!this.currentTokenInfo && this.config.refreshToken) {
      this.currentTokenInfo = {
        accessToken: '', // Will be refreshed immediately
        refreshToken: this.config.refreshToken,
        expiresAt: 0, // Expired, will trigger refresh
      };
    }

    if (!this.currentTokenInfo) {
      throw new Error('No token info available. Please run OAuth authentication first.');
    }

    // Force refresh by clearing any existing refresh promise and starting new one
    this.refreshPromise = null;
    this.refreshPromise = this.refreshAccessToken();
    
    try {
      this.currentTokenInfo = await this.refreshPromise;
      return this.currentTokenInfo.accessToken;
    } finally {
      this.refreshPromise = null;
    }
  }

  /**
   * Check if authentication is properly set up
   */
  async isAuthenticated(): Promise<boolean> {
    try {
      const tokenInfo = this.currentTokenInfo || await this.loadTokenInfo();
      return !!(tokenInfo?.refreshToken);
    } catch {
      return false;
    }
  }
}