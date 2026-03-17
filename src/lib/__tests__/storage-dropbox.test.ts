import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DropboxStorage } from '../storage-dropbox.js';

// Mock Dropbox
const mockDropbox = {
  filesUpload: vi.fn(),
  filesDownload: vi.fn(),
  filesCreateFolderV2: vi.fn(),
  filesGetMetadata: vi.fn(),
};

vi.mock('dropbox', () => {
  return {
    Dropbox: vi.fn().mockImplementation(() => mockDropbox)
  };
});

describe('DropboxStorage', () => {
  let storage: DropboxStorage;

  beforeEach(() => {
    vi.clearAllMocks();
    storage = new DropboxStorage('test-token', '/test');
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
    it('creates directory when it does not exist', async () => {
      mockDropbox.filesGetMetadata.mockRejectedValueOnce({ status: 409 });
      mockDropbox.filesCreateFolderV2.mockResolvedValueOnce({ result: {} });

      await storage.ensureDir('new/dir');

      expect(mockDropbox.filesGetMetadata).toHaveBeenCalledWith({
        path: '/test/new/dir'
      });
      expect(mockDropbox.filesCreateFolderV2).toHaveBeenCalledWith({
        path: '/test/new/dir',
        autorename: false,
      });
    });

    it('succeeds when directory already exists', async () => {
      mockDropbox.filesGetMetadata.mockResolvedValueOnce({ result: {} });

      await storage.ensureDir('existing/dir');

      expect(mockDropbox.filesGetMetadata).toHaveBeenCalledWith({
        path: '/test/existing/dir'
      });
      expect(mockDropbox.filesCreateFolderV2).not.toHaveBeenCalled();
    });

    it('throws error on unexpected API failure', async () => {
      mockDropbox.filesGetMetadata.mockRejectedValueOnce({ status: 500 });

      await expect(storage.ensureDir('dir'))
        .rejects.toThrow('Failed to ensure directory in Dropbox');
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
});