import { Dropbox } from 'dropbox';
import type { StorageProvider } from './storage.js';
import type { TokenManager } from './token-manager.js';

export class DropboxStorage implements StorageProvider {
  private dropbox: Dropbox;
  private basePath: string;
  private tokenManager?: TokenManager;

  constructor(accessTokenOrTokenManager: string | TokenManager, basePath = '/') {
    this.basePath = basePath.endsWith('/') ? basePath : `${basePath}/`;
    
    if (typeof accessTokenOrTokenManager === 'string') {
      // Legacy mode: static access token
      this.dropbox = new Dropbox({ accessToken: accessTokenOrTokenManager });
    } else {
      // New mode: token manager with automatic refresh
      this.tokenManager = accessTokenOrTokenManager;
      this.dropbox = new Dropbox(); // Will set access token before each API call
    }
  }

  private async ensureValidAccessToken(): Promise<void> {
    if (this.tokenManager) {
      const accessToken = await this.tokenManager.getValidAccessToken();
      this.dropbox.setAccessToken(accessToken);
    }
  }

  private normalizePath(filePath: string): string {
    let normalized = filePath.replace(/\\/g, '/');
    
    // Dropboxローカルフォルダのパスが含まれている場合、それより後の部分のみ使用
    const dropboxPattern = /.*\/Dropbox\/(.+)$/;
    const match = normalized.match(dropboxPattern);
    if (match) {
      normalized = '/' + match[1];
      // マッチした場合もbasePathとの結合処理を継続する
    } else {
      // 相対パスの場合（stateファイル等）、先頭にスラッシュを追加
      if (!normalized.startsWith('/')) {
        normalized = '/' + normalized;
      }
    }
    
    const result = this.basePath === '/' 
      ? normalized
      : `${this.basePath.replace(/\/$/, '')}${normalized}`;
    
    return result;
  }

  async writeFile(filePath: string, content: string | Buffer): Promise<void> {
    await this.executeWithRetry(async () => {
      const path = this.normalizePath(filePath);
      const fileContent = Buffer.isBuffer(content) ? content : Buffer.from(content, 'utf8');
      
      await this.dropbox.filesUpload({
        path,
        contents: fileContent,
        mode: { '.tag': 'overwrite' },
      });
    }, 'write file to Dropbox');
  }

  async readFile(filePath: string): Promise<string> {
    return await this.executeWithRetry(async () => {
      const path = this.normalizePath(filePath);
      const response = await this.dropbox.filesDownload({ path });
      
      if ('fileBinary' in response.result && response.result.fileBinary instanceof Buffer) {
        return response.result.fileBinary.toString('utf8');
      }
      
      throw new Error('Unexpected response format from Dropbox API');
    }, 'read file from Dropbox');
  }

  async ensureDir(dirPath: string): Promise<void> {
    // Dropboxは filesUpload 時に自動でディレクトリを作成するためスキップ
    return;
  }

  async exists(filePath: string): Promise<boolean> {
    try {
      return await this.executeWithRetry(async () => {
        const path = this.normalizePath(filePath);
        await this.dropbox.filesGetMetadata({ path });
        return true;
      }, 'check file existence in Dropbox');
    } catch {
      return false;
    }
  }

  private async executeWithRetry<T>(
    operation: () => Promise<T>,
    operationName: string,
    maxRetries = 2
  ): Promise<T> {
    await this.ensureValidAccessToken();
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error: any) {
        const isUnauthorized = error?.status === 401 || 
                              error?.response?.status === 401 ||
                              (error?.message && error.message.includes('401'));
        
        if (isUnauthorized && attempt < maxRetries && this.tokenManager) {
          // Force refresh token on 401 error (token may be revoked) and retry
          try {
            const newToken = await this.tokenManager.forceRefreshAccessToken();
            this.dropbox.setAccessToken(newToken);
            continue;
          } catch (refreshError) {
            throw new Error(`Failed to ${operationName}: Token refresh failed - ${refreshError instanceof Error ? refreshError.message : 'Unknown error'}`);
          }
        }
        
        // If not unauthorized or out of retries, throw the error
        throw new Error(`Failed to ${operationName}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
    
    throw new Error(`Failed to ${operationName}: Maximum retries exceeded`);
  }
}