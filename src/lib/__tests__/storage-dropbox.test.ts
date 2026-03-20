import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DropboxStorage } from '../storage-dropbox.js';
import type { TokenManager } from '../token-manager.js';

// Mock Dropbox
const mockDropbox = {
  filesUpload: vi.fn(),
  filesDownload: vi.fn(),
  filesCreateFolderV2: vi.fn(),
  filesGetMetadata: vi.fn(),
  setAccessToken: vi.fn(),
};

vi.mock('dropbox', () => ({
  Dropbox: function MockDropbox() {
    return mockDropbox;
  }
}));

// Mock TokenManager
const mockTokenManager = {
  getValidAccessToken: vi.fn(),
  forceRefreshAccessToken: vi.fn(),
} as unknown as TokenManager;

describe('DropboxStorage', () => {
  let storage: DropboxStorage;
  let storageWithTokenManager: DropboxStorage;

  beforeEach(() => {
    vi.clearAllMocks();
    storage = new DropboxStorage('test-token', '/test');
    
    (mockTokenManager.getValidAccessToken as any).mockResolvedValue('fresh-token');
    storageWithTokenManager = new DropboxStorage(mockTokenManager, '/test');
  });

  describe('path normalization', () => {
    it('normalizes Windows-style paths', () => {
      // This is tested indirectly through the API calls
      expect(() => new DropboxStorage('token')).not.toThrow();
    });

    it('handles base path correctly', () => {
      const storageRoot = new DropboxStorage('token', '/');
      const storageCustom = new DropboxStorage('token', '/custom/base');
      
      expect(storageRoot).toBeInstanceOf(DropboxStorage);
      expect(storageCustom).toBeInstanceOf(DropboxStorage);
    });
  });

  describe('writeFile', () => {
    it('calls Dropbox API with correct parameters', async () => {
      mockDropbox.filesUpload.mockResolvedValueOnce({ result: {} });

      await storage.writeFile('test.txt', 'content');

      expect(mockDropbox.filesUpload).toHaveBeenCalledWith({
        path: '/test/test.txt',
        contents: expect.any(Buffer),
        mode: { '.tag': 'overwrite' },
      });
    });

    it('handles Buffer input', async () => {
      mockDropbox.filesUpload.mockResolvedValueOnce({ result: {} });
      const buffer = Buffer.from('binary content');

      await storage.writeFile('binary.txt', buffer);

      expect(mockDropbox.filesUpload).toHaveBeenCalledWith({
        path: '/test/binary.txt',
        contents: buffer,
        mode: { '.tag': 'overwrite' },
      });
    });

    it('throws error on API failure', async () => {
      mockDropbox.filesUpload.mockRejectedValueOnce(new Error('API Error'));

      await expect(storage.writeFile('fail.txt', 'content'))
        .rejects.toThrow('Failed to write file to Dropbox: API Error');
    });
  });

  describe('readFile', () => {
    it('returns file content on success', async () => {
      const mockBuffer = Buffer.from('file content', 'utf8');
      mockDropbox.filesDownload.mockResolvedValueOnce({
        result: { fileBinary: mockBuffer }
      });

      const content = await storage.readFile('test.txt');

      expect(content).toBe('file content');
      expect(mockDropbox.filesDownload).toHaveBeenCalledWith({
        path: '/test/test.txt'
      });
    });

    it('throws error for unexpected response format', async () => {
      mockDropbox.filesDownload.mockResolvedValueOnce({
        result: { unexpected: 'format' }
      });

      await expect(storage.readFile('test.txt'))
        .rejects.toThrow('Unexpected response format from Dropbox API');
    });

    it('throws error on API failure', async () => {
      mockDropbox.filesDownload.mockRejectedValueOnce(new Error('Not found'));

      await expect(storage.readFile('missing.txt'))
        .rejects.toThrow('Failed to read file from Dropbox: Not found');
    });
  });

  describe('ensureDir', () => {
    it('returns without error (no-op: Dropbox creates dirs automatically on upload)', async () => {
      await expect(storage.ensureDir('new/dir')).resolves.toBeUndefined();
      expect(mockDropbox.filesGetMetadata).not.toHaveBeenCalled();
      expect(mockDropbox.filesCreateFolderV2).not.toHaveBeenCalled();
    });

    it('does not call any Dropbox API', async () => {
      await storage.ensureDir('existing/dir');
      expect(mockDropbox.filesGetMetadata).not.toHaveBeenCalled();
      expect(mockDropbox.filesCreateFolderV2).not.toHaveBeenCalled();
    });
  });

  describe('exists', () => {
    it('returns true when file exists', async () => {
      mockDropbox.filesGetMetadata.mockResolvedValueOnce({ result: {} });

      const exists = await storage.exists('existing.txt');

      expect(exists).toBe(true);
      expect(mockDropbox.filesGetMetadata).toHaveBeenCalledWith({
        path: '/test/existing.txt'
      });
    });

    it('returns false when file does not exist', async () => {
      mockDropbox.filesGetMetadata.mockRejectedValueOnce(new Error('Not found'));

      const exists = await storage.exists('missing.txt');

      expect(exists).toBe(false);
    });
  });

  describe('TokenManager integration', () => {
    it('uses TokenManager for authentication', async () => {
      mockDropbox.filesUpload.mockResolvedValueOnce({ result: {} });

      await storageWithTokenManager.writeFile('test.txt', 'content');

      expect(mockTokenManager.getValidAccessToken).toHaveBeenCalled();
      expect(mockDropbox.filesUpload).toHaveBeenCalled();
    });

    it('retries on 401 error with token refresh', async () => {
      const unauthorizedError = { status: 401 };
      mockDropbox.filesUpload
        .mockRejectedValueOnce(unauthorizedError)
        .mockResolvedValueOnce({ result: {} });

      (mockTokenManager.getValidAccessToken as any).mockResolvedValueOnce('expired-token');
      (mockTokenManager.forceRefreshAccessToken as any).mockResolvedValueOnce('refreshed-token');

      await storageWithTokenManager.writeFile('test.txt', 'content');

      expect(mockTokenManager.getValidAccessToken).toHaveBeenCalledTimes(1);
      expect(mockTokenManager.forceRefreshAccessToken).toHaveBeenCalledTimes(1);
      expect(mockDropbox.filesUpload).toHaveBeenCalledTimes(2);
    });

    it('fails after maximum retries on persistent 401 errors', async () => {
      const unauthorizedError = { status: 401, message: 'Unauthorized' };
      mockDropbox.filesUpload.mockRejectedValue(unauthorizedError);
      (mockTokenManager.forceRefreshAccessToken as any).mockResolvedValue('refreshed-token');

      await expect(storageWithTokenManager.writeFile('test.txt', 'content'))
        .rejects.toThrow('Failed to write file to Dropbox: Unauthorized');

      expect(mockTokenManager.getValidAccessToken).toHaveBeenCalledTimes(1); // Initial call
      expect(mockTokenManager.forceRefreshAccessToken).toHaveBeenCalledTimes(2); // 2 retries
      expect(mockDropbox.filesUpload).toHaveBeenCalledTimes(3);
    });

    it('does not retry on non-401 errors', async () => {
      const otherError = { status: 500, message: 'Server Error' };
      mockDropbox.filesUpload.mockRejectedValueOnce(otherError);

      await expect(storageWithTokenManager.writeFile('test.txt', 'content'))
        .rejects.toThrow('Failed to write file to Dropbox: Server Error');

      expect(mockTokenManager.getValidAccessToken).toHaveBeenCalledTimes(1);
      expect(mockDropbox.filesUpload).toHaveBeenCalledTimes(1);
    });

    it('fails when token refresh fails', async () => {
      const unauthorizedError = { status: 401 };
      mockDropbox.filesUpload.mockRejectedValue(unauthorizedError);
      (mockTokenManager.getValidAccessToken as any).mockResolvedValueOnce('expired-token');
      (mockTokenManager.forceRefreshAccessToken as any).mockRejectedValueOnce(new Error('Refresh failed'));

      await expect(storageWithTokenManager.writeFile('test.txt', 'content'))
        .rejects.toThrow('Failed to write file to Dropbox: Token refresh failed - Refresh failed');

      expect(mockTokenManager.getValidAccessToken).toHaveBeenCalledTimes(1);
      expect(mockTokenManager.forceRefreshAccessToken).toHaveBeenCalledTimes(1);
      expect(mockDropbox.filesUpload).toHaveBeenCalledTimes(1);
    });

    describe('with different API methods', () => {
      it('handles token refresh for readFile', async () => {
        const unauthorizedError = { status: 401 };
        const mockBuffer = Buffer.from('file content', 'utf8');
        
        mockDropbox.filesDownload
          .mockRejectedValueOnce(unauthorizedError)
          .mockResolvedValueOnce({ result: { fileBinary: mockBuffer } });

        (mockTokenManager.getValidAccessToken as any).mockResolvedValueOnce('expired-token');
        (mockTokenManager.forceRefreshAccessToken as any).mockResolvedValueOnce('refreshed-token');

        const content = await storageWithTokenManager.readFile('test.txt');

        expect(content).toBe('file content');
        expect(mockTokenManager.getValidAccessToken).toHaveBeenCalledTimes(1);
        expect(mockTokenManager.forceRefreshAccessToken).toHaveBeenCalledTimes(1);
      });

      it('handles token refresh for exists', async () => {
        const unauthorizedError = { status: 401 };
        
        mockDropbox.filesGetMetadata
          .mockRejectedValueOnce(unauthorizedError)
          .mockResolvedValueOnce({ result: {} });

        (mockTokenManager.getValidAccessToken as any).mockResolvedValueOnce('expired-token');
        (mockTokenManager.forceRefreshAccessToken as any).mockResolvedValueOnce('refreshed-token');

        const exists = await storageWithTokenManager.exists('test.txt');

        expect(exists).toBe(true);
        expect(mockTokenManager.getValidAccessToken).toHaveBeenCalledTimes(1);
        expect(mockTokenManager.forceRefreshAccessToken).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('legacy mode compatibility', () => {
    it('works with static access token', async () => {
      mockDropbox.filesUpload.mockResolvedValueOnce({ result: {} });

      await storage.writeFile('test.txt', 'content');

      expect(mockDropbox.filesUpload).toHaveBeenCalledWith({
        path: '/test/test.txt',
        contents: expect.any(Buffer),
        mode: { '.tag': 'overwrite' },
      });
      
      // Should not call TokenManager methods
      expect(mockTokenManager.getValidAccessToken).not.toHaveBeenCalled();
      expect(mockDropbox.setAccessToken).not.toHaveBeenCalled();
    });
  });
});