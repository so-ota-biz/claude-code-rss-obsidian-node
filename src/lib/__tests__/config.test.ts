import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { loadConfig } from '../config.js';
import { writeFileSync, unlinkSync, mkdirSync, rmSync, existsSync } from 'fs';
import { join } from 'path';

const REQUIRED_ENV_WITH_ACCOUNTS = {
  GEMINI_API_KEY: 'test-api-key',
  RSSHUB_BASE_URL: 'http://localhost:1200',
  OBSIDIAN_VAULT_PATH: '/tmp/vault',
  TARGET_ACCOUNTS: 'anthropicai,claudeai'
};

const REQUIRED_ENV_WITHOUT_ACCOUNTS = {
  GEMINI_API_KEY: 'test-api-key',
  RSSHUB_BASE_URL: 'http://localhost:1200',
  OBSIDIAN_VAULT_PATH: '/tmp/vault'
};

let savedEnv: Record<string, string | undefined> = {};
const TEST_CONFIG_DIR = join(process.cwd(), 'config');
const TEST_CONFIG_FILE = join(TEST_CONFIG_DIR, 'accounts.yml');

function setEnv(vars: Record<string, string | undefined>) {
  for (const [key, value] of Object.entries(vars)) {
    savedEnv[key] = process.env[key];
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

function createTestConfigFile(content: string) {
  if (!existsSync(TEST_CONFIG_DIR)) {
    mkdirSync(TEST_CONFIG_DIR, { recursive: true });
  }
  writeFileSync(TEST_CONFIG_FILE, content, 'utf-8');
}

function removeTestConfigFile() {
  if (existsSync(TEST_CONFIG_FILE)) {
    unlinkSync(TEST_CONFIG_FILE);
  }
}

beforeEach(() => {
  savedEnv = {};
  // Remove dotenv-loaded vars to avoid test pollution
  const allEnvKeys = [
    ...Object.keys(REQUIRED_ENV_WITH_ACCOUNTS), 
    ...Object.keys(REQUIRED_ENV_WITHOUT_ACCOUNTS),
    'STORAGE_TYPE', 'DROPBOX_ACCESS_TOKEN', 'DROPBOX_CLIENT_ID', 'DROPBOX_CLIENT_SECRET',
    'DROPBOX_REFRESH_TOKEN', 'DROPBOX_TOKEN_STORAGE_PATH', 'DROPBOX_BASE_PATH'
  ];
  for (const key of allEnvKeys) {
    savedEnv[key] = process.env[key];
    delete process.env[key];
  }
  // Remove any existing test config file
  removeTestConfigFile();
});

afterEach(() => {
  for (const [key, value] of Object.entries(savedEnv)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
  // Clean up test config file
  removeTestConfigFile();
});

describe('loadConfig', () => {
  describe('Environment variable configuration', () => {
    it('returns AppConfig when all required env vars are set', () => {
      setEnv(REQUIRED_ENV_WITH_ACCOUNTS);
      const config = loadConfig();
      expect(config.geminiApiKey).toBe('test-api-key');
      expect(config.rsshubBaseUrl).toBe('http://localhost:1200');
      expect(config.obsidianVaultPath).toBe('/tmp/vault');
      expect(config.targetAccounts).toEqual(['anthropicai', 'claudeai']);
    });

    it('splits TARGET_ACCOUNTS by comma and trims whitespace', () => {
      setEnv({ ...REQUIRED_ENV_WITH_ACCOUNTS, TARGET_ACCOUNTS: ' user1 , user2 , user3 ' });
      const config = loadConfig();
      expect(config.targetAccounts).toEqual(['user1', 'user2', 'user3']);
    });
  });

  describe('YAML configuration file', () => {
    it('loads accounts from YAML file when TARGET_ACCOUNTS is not set', () => {
      createTestConfigFile(`
accounts:
  - name: "user1"
    description: "User 1"
    category: "Test"
  - name: "user2"
    description: "User 2"
    category: "Test"
`);
      setEnv(REQUIRED_ENV_WITHOUT_ACCOUNTS);
      const config = loadConfig();
      expect(config.targetAccounts).toEqual(['user1', 'user2']);
    });

    it('prioritizes TARGET_ACCOUNTS environment variable over YAML file', () => {
      createTestConfigFile(`
accounts:
  - name: "yaml_user1"
  - name: "yaml_user2"
`);
      setEnv({ ...REQUIRED_ENV_WITHOUT_ACCOUNTS, TARGET_ACCOUNTS: 'env_user1,env_user2' });
      const config = loadConfig();
      expect(config.targetAccounts).toEqual(['env_user1', 'env_user2']);
    });

    it('filters out accounts with empty names from YAML', () => {
      createTestConfigFile(`
accounts:
  - name: "valid_user"
  - name: ""
  - name: "  "
  - name: "another_valid"
`);
      setEnv(REQUIRED_ENV_WITHOUT_ACCOUNTS);
      const config = loadConfig();
      expect(config.targetAccounts).toEqual(['valid_user', 'another_valid']);
    });

    it('throws error when YAML file has invalid structure', () => {
      createTestConfigFile(`
not_accounts:
  - name: "user1"
`);
      setEnv(REQUIRED_ENV_WITHOUT_ACCOUNTS);
      expect(() => loadConfig()).toThrow('Invalid config format: accounts must be an array');
    });

    it('throws error when neither TARGET_ACCOUNTS nor YAML file is available', () => {
      setEnv(REQUIRED_ENV_WITHOUT_ACCOUNTS);
      expect(() => loadConfig()).toThrow('No target accounts configured');
    });

    it('throws error when YAML file contains invalid YAML syntax', () => {
      createTestConfigFile(`
accounts:
  - name: "user1
    invalid yaml syntax
`);
      setEnv(REQUIRED_ENV_WITHOUT_ACCOUNTS);
      expect(() => loadConfig()).toThrow(/Failed to load accounts configuration/);
    });
  });

  describe('Other configuration options', () => {
    it('removes trailing slash from RSSHUB_BASE_URL', () => {
      setEnv({ ...REQUIRED_ENV_WITH_ACCOUNTS, RSSHUB_BASE_URL: 'http://localhost:1200/' });
      const config = loadConfig();
      expect(config.rsshubBaseUrl).toBe('http://localhost:1200');
    });

    it('applies default values including storage settings', () => {
      setEnv(REQUIRED_ENV_WITH_ACCOUNTS);
      const config = loadConfig();
      expect(config.timezone).toBe('Asia/Tokyo');
      expect(config.modelText).toBe('gemini-2.5-flash-lite');
      expect(config.maxPostsPerAccount).toBe(20);
      expect(config.maxHighlights).toBe(5);
      expect(config.requestTimeoutMs).toBe(30000);
      expect(config.thumbnailImageExt).toBe('png');
      expect(config.storageType).toBe('local');
      expect(config.dropboxBasePath).toBe('/');
    });

    it('parses boolean env vars: "true" → true', () => {
      setEnv({ ...REQUIRED_ENV_WITH_ACCOUNTS, ENABLE_TRANSLATION: 'true', SKIP_RETWEETS: 'true' });
      const config = loadConfig();
      expect(config.enableTranslation).toBe(true);
      expect(config.skipRetweets).toBe(true);
    });

    it('parses boolean env vars: "1" → true', () => {
      setEnv({ ...REQUIRED_ENV_WITH_ACCOUNTS, ENABLE_DIGEST: '1' });
      const config = loadConfig();
      expect(config.enableDigest).toBe(true);
    });

    it('parses boolean env vars: "false" → false', () => {
      setEnv({ ...REQUIRED_ENV_WITH_ACCOUNTS, ENABLE_THUMBNAIL: 'false' });
      const config = loadConfig();
      expect(config.enableThumbnail).toBe(false);
    });

    it('parses boolean env vars: "0" → false', () => {
      setEnv({ ...REQUIRED_ENV_WITH_ACCOUNTS, SKIP_REPLIES: '0' });
      const config = loadConfig();
      expect(config.skipReplies).toBe(false);
    });

    it('removes leading dot from THUMBNAIL_IMAGE_EXT', () => {
      setEnv({ ...REQUIRED_ENV_WITH_ACCOUNTS, THUMBNAIL_IMAGE_EXT: '.webp' });
      const config = loadConfig();
      expect(config.thumbnailImageExt).toBe('webp');
    });

    it('configures dropbox storage when STORAGE_TYPE is dropbox', () => {
      setEnv({ 
        ...REQUIRED_ENV_WITH_ACCOUNTS, 
        STORAGE_TYPE: 'dropbox',
        DROPBOX_ACCESS_TOKEN: 'test-token',
        DROPBOX_BASE_PATH: '/custom/path'
      });
      const config = loadConfig();
      expect(config.storageType).toBe('dropbox');
      expect(config.dropboxAccessToken).toBe('test-token');
      expect(config.dropboxBasePath).toBe('/custom/path');
    });

    it('configures dropbox OAuth when CLIENT_ID and REFRESH_TOKEN are provided', () => {
      setEnv({
        ...REQUIRED_ENV_WITH_ACCOUNTS,
        STORAGE_TYPE: 'dropbox',
        DROPBOX_CLIENT_ID: 'test-client-id',
        DROPBOX_CLIENT_SECRET: 'test-client-secret',
        DROPBOX_REFRESH_TOKEN: 'test-refresh-token',
        DROPBOX_TOKEN_STORAGE_PATH: '/custom/tokens.json'
      });
      const config = loadConfig();
      expect(config.storageType).toBe('dropbox');
      expect(config.dropboxClientId).toBe('test-client-id');
      expect(config.dropboxClientSecret).toBe('test-client-secret');
      expect(config.dropboxRefreshToken).toBe('test-refresh-token');
      expect(config.dropboxTokenStoragePath).toBe('/custom/tokens.json');
    });

    it('uses default token storage path when not specified', () => {
      setEnv({
        ...REQUIRED_ENV_WITH_ACCOUNTS,
        STORAGE_TYPE: 'dropbox',
        DROPBOX_CLIENT_ID: 'test-client-id',
        DROPBOX_CLIENT_SECRET: 'test-client-secret',
        DROPBOX_REFRESH_TOKEN: 'test-refresh-token'
      });
      const config = loadConfig();
      expect(config.dropboxTokenStoragePath).toBe('.state/dropbox-tokens.json');
    });

    it('allows OAuth config without REFRESH_TOKEN for first-time setup', () => {
      setEnv({
        ...REQUIRED_ENV_WITH_ACCOUNTS,
        STORAGE_TYPE: 'dropbox',
        DROPBOX_CLIENT_ID: 'test-client-id',
        DROPBOX_CLIENT_SECRET: 'test-client-secret',
        DROPBOX_TOKEN_STORAGE_PATH: '/custom/tokens.json'
      });
      const config = loadConfig();
      expect(config.storageType).toBe('dropbox');
      expect(config.dropboxClientId).toBe('test-client-id');
      expect(config.dropboxClientSecret).toBe('test-client-secret');
      expect(config.dropboxRefreshToken).toBeUndefined();
    });

    it('allows OAuth config with CLIENT_ID and CLIENT_SECRET only (uses default token storage path)', () => {
      setEnv({
        ...REQUIRED_ENV_WITH_ACCOUNTS,
        STORAGE_TYPE: 'dropbox',
        DROPBOX_CLIENT_ID: 'test-client-id',
        DROPBOX_CLIENT_SECRET: 'test-client-secret'
      });
      expect(() => loadConfig()).not.toThrow();
      const config = loadConfig();
      expect(config.storageType).toBe('dropbox');
      expect(config.dropboxClientId).toBe('test-client-id');
      expect(config.dropboxClientSecret).toBe('test-client-secret');
      expect(config.dropboxRefreshToken).toBeUndefined();
      expect(config.dropboxTokenStoragePath).toBe('.state/dropbox-tokens.json');
    });

    it('warns when both access token and OAuth config are provided', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      setEnv({
        ...REQUIRED_ENV_WITH_ACCOUNTS,
        STORAGE_TYPE: 'dropbox',
        DROPBOX_ACCESS_TOKEN: 'legacy-token',
        DROPBOX_CLIENT_ID: 'test-client-id',
        DROPBOX_CLIENT_SECRET: 'test-client-secret',
        DROPBOX_REFRESH_TOKEN: 'test-refresh-token'
      });
      
      const config = loadConfig();
      expect(config.storageType).toBe('dropbox');
      expect(consoleSpy).toHaveBeenCalledWith(
        '[warning] Both DROPBOX_ACCESS_TOKEN and OAuth configuration provided. OAuth configuration will take precedence.'
      );
      
      consoleSpy.mockRestore();
    });

    it('throws error when STORAGE_TYPE is dropbox but no authentication is provided', () => {
      setEnv({ 
        ...REQUIRED_ENV_WITH_ACCOUNTS, 
        STORAGE_TYPE: 'dropbox'
      });
      expect(() => loadConfig()).toThrow(
        'Dropbox configuration error: Either DROPBOX_ACCESS_TOKEN (legacy) or DROPBOX_CLIENT_ID + DROPBOX_CLIENT_SECRET (OAuth 2.0) is required when STORAGE_TYPE is "dropbox"'
      );
    });

    it('accepts CLIENT_ID with token storage path but no refresh token', () => {
      setEnv({
        ...REQUIRED_ENV_WITH_ACCOUNTS,
        STORAGE_TYPE: 'dropbox',
        DROPBOX_CLIENT_ID: 'test-client-id',
        DROPBOX_CLIENT_SECRET: 'test-client-secret',
        DROPBOX_TOKEN_STORAGE_PATH: '/custom/tokens.json'
      });

      expect(() => loadConfig()).not.toThrow();
      const config = loadConfig();
      expect(config.dropboxClientId).toBe('test-client-id');
      expect(config.dropboxClientSecret).toBe('test-client-secret');
      expect(config.dropboxTokenStoragePath).toBe('/custom/tokens.json');
    });
  });

  describe('Error cases', () => {
    it('throws when GEMINI_API_KEY is empty', () => {
      setEnv({ ...REQUIRED_ENV_WITH_ACCOUNTS, GEMINI_API_KEY: '' });
      expect(() => loadConfig()).toThrow();
    });

    it('throws when RSSHUB_BASE_URL is not a valid URL', () => {
      setEnv({ ...REQUIRED_ENV_WITH_ACCOUNTS, RSSHUB_BASE_URL: 'not-a-url' });
      expect(() => loadConfig()).toThrow();
    });

    it('throws when GEMINI_API_KEY is missing', () => {
      setEnv({ ...REQUIRED_ENV_WITH_ACCOUNTS, GEMINI_API_KEY: undefined });
      expect(() => loadConfig()).toThrow();
    });
  });
});