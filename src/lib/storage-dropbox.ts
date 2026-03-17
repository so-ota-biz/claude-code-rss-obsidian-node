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
    const normalized = filePath.replace(/\\/g, '/');
    const withBase = this.basePath === '/' 
      ? normalized
      : `${this.basePath.replace(/\/$/, '')}/${normalized}`;
    return withBase.startsWith('/') ? withBase : `/${withBase}`;
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
    try {
      const path = this.normalizePath(dirPath);
      
      try {
        await this.dropbox.filesGetMetadata({ path });
      } catch (error: any) {
        if (error?.status === 409) {
          await this.dropbox.filesCreateFolderV2({
            path,
            autorename: false,
          });
        } else {
          throw error;
        }
      }
    } catch (error) {
      throw new Error(`Failed to ensure directory in Dropbox: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
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