import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadConfig } from '../config.js';

const REQUIRED_ENV = {
  GEMINI_API_KEY: 'test-api-key',
  RSSHUB_BASE_URL: 'http://localhost:1200',
  OBSIDIAN_VAULT_PATH: '/tmp/vault',
  TARGET_ACCOUNTS: 'anthropicai,claudeai'
};

let savedEnv: Record<string, string | undefined> = {};

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

beforeEach(() => {
  savedEnv = {};
  // Remove dotenv-loaded vars to avoid test pollution
  for (const key of Object.keys(REQUIRED_ENV)) {
    savedEnv[key] = process.env[key];
    delete process.env[key];
  }
});

afterEach(() => {
  for (const [key, value] of Object.entries(savedEnv)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
});

describe('loadConfig', () => {
  it('returns AppConfig when all required env vars are set', () => {
    setEnv(REQUIRED_ENV);
    const config = loadConfig();
    expect(config.geminiApiKey).toBe('test-api-key');
    expect(config.rsshubBaseUrl).toBe('http://localhost:1200');
    expect(config.obsidianVaultPath).toBe('/tmp/vault');
    expect(config.targetAccounts).toEqual(['anthropicai', 'claudeai']);
  });

  it('splits TARGET_ACCOUNTS by comma and trims whitespace', () => {
    setEnv({ ...REQUIRED_ENV, TARGET_ACCOUNTS: ' user1 , user2 , user3 ' });
    const config = loadConfig();
    expect(config.targetAccounts).toEqual(['user1', 'user2', 'user3']);
  });

  it('removes trailing slash from RSSHUB_BASE_URL', () => {
    setEnv({ ...REQUIRED_ENV, RSSHUB_BASE_URL: 'http://localhost:1200/' });
    const config = loadConfig();
    expect(config.rsshubBaseUrl).toBe('http://localhost:1200');
  });

  it('applies default values', () => {
    setEnv(REQUIRED_ENV);
    const config = loadConfig();
    expect(config.timezone).toBe('Asia/Tokyo');
    expect(config.modelText).toBe('gemini-2.5-flash-lite');
    expect(config.maxPostsPerAccount).toBe(20);
    expect(config.maxHighlights).toBe(5);
    expect(config.requestTimeoutMs).toBe(30000);
    expect(config.thumbnailImageExt).toBe('png');
  });

  it('parses boolean env vars: "true" → true', () => {
    setEnv({ ...REQUIRED_ENV, ENABLE_TRANSLATION: 'true', SKIP_RETWEETS: 'true' });
    const config = loadConfig();
    expect(config.enableTranslation).toBe(true);
    expect(config.skipRetweets).toBe(true);
  });

  it('parses boolean env vars: "1" → true', () => {
    setEnv({ ...REQUIRED_ENV, ENABLE_DIGEST: '1' });
    const config = loadConfig();
    expect(config.enableDigest).toBe(true);
  });

  it('parses boolean env vars: "false" → false', () => {
    setEnv({ ...REQUIRED_ENV, ENABLE_THUMBNAIL: 'false' });
    const config = loadConfig();
    expect(config.enableThumbnail).toBe(false);
  });

  it('parses boolean env vars: "0" → false', () => {
    setEnv({ ...REQUIRED_ENV, SKIP_REPLIES: '0' });
    const config = loadConfig();
    expect(config.skipReplies).toBe(false);
  });

  it('removes leading dot from THUMBNAIL_IMAGE_EXT', () => {
    setEnv({ ...REQUIRED_ENV, THUMBNAIL_IMAGE_EXT: '.webp' });
    const config = loadConfig();
    expect(config.thumbnailImageExt).toBe('webp');
  });

  it('throws when GEMINI_API_KEY is empty', () => {
    setEnv({ ...REQUIRED_ENV, GEMINI_API_KEY: '' });
    expect(() => loadConfig()).toThrow();
  });

  it('throws when RSSHUB_BASE_URL is not a valid URL', () => {
    setEnv({ ...REQUIRED_ENV, RSSHUB_BASE_URL: 'not-a-url' });
    expect(() => loadConfig()).toThrow();
  });

  it('throws when GEMINI_API_KEY is missing', () => {
    setEnv({ ...REQUIRED_ENV, GEMINI_API_KEY: undefined });
    expect(() => loadConfig()).toThrow();
  });
});
