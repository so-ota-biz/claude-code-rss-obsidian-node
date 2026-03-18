import 'dotenv/config';
import { z } from 'zod';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { parse as parseYaml } from 'yaml';
import type { AppConfig, AccountsConfig } from '../types.js';

const schema = z.object({
  GEMINI_API_KEY: z.string().min(1),
  RSSHUB_BASE_URL: z.string().url(),
  RSSHUB_ROUTE_TEMPLATE: z.string().default('/twitter/user/:account'),
  OBSIDIAN_VAULT_PATH: z.string().min(1),
  TARGET_ACCOUNTS: z.string().optional(), // オプションに変更（設定ファイルとの共存のため）
  TIMEZONE: z.string().default('Asia/Tokyo'),
  OUTPUT_SUBDIR: z.string().default('AI Digest/Claude Code'),
  RAW_SUBDIR: z.string().default('AI Digest/Claude Code/raw'),
  ASSETS_SUBDIR: z.string().default('AI Digest/Claude Code/assets'),
  STATE_DIR: z.string().default('.state'),
  MAX_POSTS_PER_ACCOUNT: z.coerce.number().int().positive().default(20),
  ONLY_INCLUDE_ORIGINAL_POSTS: z.string().default('true'),
  SKIP_RETWEETS: z.string().default('true'),
  SKIP_REPLIES: z.string().default('true'),
  ENABLE_TRANSLATION: z.string().default('true'),
  ENABLE_DIGEST: z.string().default('true'),
  ENABLE_THUMBNAIL: z.string().default('true'),
  MAX_HIGHLIGHTS: z.coerce.number().int().positive().default(5),
  THUMBNAIL_COMMAND: z.string().optional(),
  THUMBNAIL_IMAGE_EXT: z.string().default('png'),
  MODEL_TEXT: z.string().default('gemini-2.5-flash-lite'),
  THUMBNAIL_PROMPT_STYLE: z.string().default('clean, modern, editorial, dark, subtle terminal motif, no text'),
  REQUEST_TIMEOUT_MS: z.coerce.number().int().positive().default(30_000),
  STORAGE_TYPE: z.enum(['local', 'dropbox']).default('local'),
  DROPBOX_ACCESS_TOKEN: z.string().optional(),
  DROPBOX_CLIENT_ID: z.string().optional(),
  DROPBOX_REFRESH_TOKEN: z.string().optional(),
  DROPBOX_TOKEN_STORAGE_PATH: z.string().default('.state/dropbox-tokens.json'),
  DROPBOX_BASE_PATH: z.string().default('/')
});

const bool = (value: string) => ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());

// YAML設定ファイルを読み込む関数
function loadAccountsFromYaml(): string[] {
  const configPath = join(process.cwd(), 'config', 'accounts.yml');
  
  if (!existsSync(configPath)) {
    return [];
  }

  try {
    const yamlContent = readFileSync(configPath, 'utf-8');
    const config: AccountsConfig = parseYaml(yamlContent);
    
    // バリデーション
    if (!config.accounts || !Array.isArray(config.accounts)) {
      throw new Error('Invalid config format: accounts must be an array');
    }
    
    return config.accounts
      .filter(account => account.name && account.name.trim())
      .map(account => account.name.trim());
  } catch (error) {
    console.error('[error] Failed to load accounts.yml:', error);
    throw new Error(`Failed to load accounts configuration: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// アカウント一覧を取得する関数（環境変数優先、設定ファイルフォールバック）
function loadTargetAccounts(envValue?: string): string[] {
  // 環境変数が設定されている場合は優先
  if (envValue && envValue.trim()) {
    return envValue.split(',').map((value) => value.trim()).filter(Boolean);
  }
  
  // 設定ファイルからロード
  const accountsFromFile = loadAccountsFromYaml();
  if (accountsFromFile.length > 0) {
    return accountsFromFile;
  }
  
  // どちらも設定されていない場合はエラー
  throw new Error('No target accounts configured. Please set TARGET_ACCOUNTS environment variable or create config/accounts.yml');
}

export function loadConfig(): AppConfig {
  const env = schema.parse(process.env);
  
  // Dropbox設定のバリデーション
  if (env.STORAGE_TYPE === 'dropbox') {
    const hasAccessToken = !!env.DROPBOX_ACCESS_TOKEN;
    const hasExplicitTokenStoragePath = !!process.env.DROPBOX_TOKEN_STORAGE_PATH;
    const hasCompleteOAuthConfig = !!(env.DROPBOX_CLIENT_ID && (env.DROPBOX_REFRESH_TOKEN || hasExplicitTokenStoragePath));
    
    if (!hasAccessToken && !hasCompleteOAuthConfig) {
      throw new Error(
        'Dropbox configuration error: Either DROPBOX_ACCESS_TOKEN (legacy) or DROPBOX_CLIENT_ID + DROPBOX_REFRESH_TOKEN (OAuth 2.0) is required when STORAGE_TYPE is "dropbox"'
      );
    }
    
    if (hasAccessToken && hasCompleteOAuthConfig) {
      console.warn('[warning] Both DROPBOX_ACCESS_TOKEN and OAuth configuration provided. OAuth configuration will take precedence.');
    }
  }
  
  return {
    geminiApiKey: env.GEMINI_API_KEY,
    rsshubBaseUrl: env.RSSHUB_BASE_URL.replace(/\/$/, ''),
    rsshubRouteTemplate: env.RSSHUB_ROUTE_TEMPLATE,
    obsidianVaultPath: env.OBSIDIAN_VAULT_PATH,
    targetAccounts: loadTargetAccounts(env.TARGET_ACCOUNTS),
    timezone: env.TIMEZONE,
    outputSubdir: env.OUTPUT_SUBDIR,
    rawSubdir: env.RAW_SUBDIR,
    assetsSubdir: env.ASSETS_SUBDIR,
    stateDir: env.STATE_DIR,
    maxPostsPerAccount: env.MAX_POSTS_PER_ACCOUNT,
    onlyIncludeOriginalPosts: bool(env.ONLY_INCLUDE_ORIGINAL_POSTS),
    skipRetweets: bool(env.SKIP_RETWEETS),
    skipReplies: bool(env.SKIP_REPLIES),
    enableTranslation: bool(env.ENABLE_TRANSLATION),
    enableDigest: bool(env.ENABLE_DIGEST),
    enableThumbnail: bool(env.ENABLE_THUMBNAIL),
    maxHighlights: env.MAX_HIGHLIGHTS,
    thumbnailCommand: env.THUMBNAIL_COMMAND,
    thumbnailImageExt: env.THUMBNAIL_IMAGE_EXT.replace(/^\./, ''),
    modelText: env.MODEL_TEXT,
    thumbnailPromptStyle: env.THUMBNAIL_PROMPT_STYLE,
    requestTimeoutMs: env.REQUEST_TIMEOUT_MS,
    storageType: env.STORAGE_TYPE,
    dropboxAccessToken: env.DROPBOX_ACCESS_TOKEN,
    dropboxClientId: env.DROPBOX_CLIENT_ID,
    dropboxRefreshToken: env.DROPBOX_REFRESH_TOKEN,
    dropboxTokenStoragePath: env.DROPBOX_TOKEN_STORAGE_PATH,
    dropboxBasePath: env.DROPBOX_BASE_PATH
  };
}
