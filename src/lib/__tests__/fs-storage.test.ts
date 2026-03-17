import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readState, writeState } from '../fs.js';
import type { StorageProvider } from '../storage.js';
import type { State } from '../../types.js';

// Mock storage provider
const mockStorage = (): StorageProvider => ({
  writeFile: vi.fn(),
  readFile: vi.fn(),
  ensureDir: vi.fn(),
  exists: vi.fn(),
});

describe('fs with storage provider', () => {
  let storage: StorageProvider;

  beforeEach(() => {
    storage = mockStorage();
  });

  describe('readState', () => {
    it('returns empty object when file does not exist', async () => {
      vi.mocked(storage.readFile).mockRejectedValueOnce(new Error('File not found'));

      const result = await readState(storage, 'test-state');
      
      expect(result).toEqual({});
      expect(storage.readFile).toHaveBeenCalledWith('test-state/state.json');
    });

    it('parses and returns state from valid JSON', async () => {
      const state: State = { lastRunDate: '2026-03-17', seenIds: ['id1', 'id2'] };
      vi.mocked(storage.readFile).mockResolvedValueOnce(JSON.stringify(state));

      const result = await readState(storage, 'test-state');
      
      expect(result).toEqual(state);
      expect(storage.readFile).toHaveBeenCalledWith('test-state/state.json');
    });

    it('returns empty object when file contains invalid JSON', async () => {
      vi.mocked(storage.readFile).mockResolvedValueOnce('invalid json');

      const result = await readState(storage, 'test-state');
      
      expect(result).toEqual({});
    });
  });

  describe('writeState', () => {
    it('ensures directory and writes state file', async () => {
      const state: State = { lastRunDate: '2026-03-17', seenIds: ['id1'] };
      
      await writeState(storage, 'test-state', state);
      
      expect(storage.ensureDir).toHaveBeenCalledWith('test-state');
      expect(storage.writeFile).toHaveBeenCalledWith(
        'test-state/state.json',
        JSON.stringify(state, null, 2)
      );
    });

    it('handles empty state object', async () => {
      const state: State = {};
      
      await writeState(storage, 'state-dir', state);
      
      expect(storage.ensureDir).toHaveBeenCalledWith('state-dir');
      expect(storage.writeFile).toHaveBeenCalledWith(
        'state-dir/state.json',
        JSON.stringify(state, null, 2)
      );
    });
  });
});