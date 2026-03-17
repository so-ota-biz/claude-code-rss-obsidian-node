import { Dropbox } from 'dropbox';
import type { StorageProvider } from './storage.js';

export class DropboxStorage implements StorageProvider {
  private dropbox: Dropbox;
  private basePath: string;

  constructor(accessToken: string, basePath = '/') {
    this.dropbox = new Dropbox({ accessToken });
    this.basePath = basePath.endsWith('/') ? basePath : `${basePath}/`;
  }

  private normalizePath(filePath: string): string {
    let normalized = filePath.replace(/\\/g, '/');
    
    // Dropboxローカルフォルダのパスが含まれている場合、それより後の部分のみ使用
    const dropboxPattern = /.*\/Dropbox\/(.+)$/;
    const match = normalized.match(dropboxPattern);
    if (match) {
      normalized = '/' + match[1];
      return normalized;
    }
    
    // 相対パスの場合（stateファイル等）、basePathと結合
    if (!normalized.startsWith('/')) {
      normalized = '/' + normalized;
    }
    
    const result = this.basePath === '/' 
      ? normalized
      : `${this.basePath.replace(/\/$/, '')}${normalized}`;
    
    return result;
  }

  async writeFile(filePath: string, content: string | Buffer): Promise<void> {
    try {
      const path = this.normalizePath(filePath);
      const fileContent = Buffer.isBuffer(content) ? content : Buffer.from(content, 'utf8');
      
      await this.dropbox.filesUpload({
        path,
        contents: fileContent,
        mode: { '.tag': 'overwrite' },
      });
    } catch (error) {
      throw new Error(`Failed to write file to Dropbox: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async readFile(filePath: string): Promise<string> {
    try {
      const path = this.normalizePath(filePath);
      const response = await this.dropbox.filesDownload({ path });
      
      if ('fileBinary' in response.result && response.result.fileBinary instanceof Buffer) {
        return response.result.fileBinary.toString('utf8');
      }
      
      throw new Error('Unexpected response format from Dropbox API');
    } catch (error) {
      throw new Error(`Failed to read file from Dropbox: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async ensureDir(dirPath: string): Promise<void> {
    // Dropboxは filesUpload 時に自動でディレクトリを作成するためスキップ
    return;
  }

  async exists(filePath: string): Promise<boolean> {
    try {
      const path = this.normalizePath(filePath);
      await this.dropbox.filesGetMetadata({ path });
      return true;
    } catch {
      return false;
    }
  }
}