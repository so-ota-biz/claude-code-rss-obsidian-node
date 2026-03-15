import 'dotenv/config';
import { z } from 'zod';
import type { AppConfig } from '../types.js';

const schema = z.object({
  GEMINI_API_KEY: z.string().min(1),
  RSSHUB_BASE_URL: z.string().url(),
  RSSHUB_ROUTE_TEMPLATE: z.string().default('/twitter/user/:account'),
  OBSIDIAN_VAULT_PATH: z.string().min(1),
  TARGET_ACCOUNTS: z.string().min(1),
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
  REQUEST_TIMEOUT_MS: z.coerce.number().int().positive().default(30_000)
});

const bool = (value: string) => ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());

export function loadConfig(): AppConfig {
  const env = schema.parse(process.env);
  return {
    geminiApiKey: env.GEMINI_API_KEY,
    rsshubBaseUrl: env.RSSHUB_BASE_URL.replace(/\/$/, ''),
    rsshubRouteTemplate: env.RSSHUB_ROUTE_TEMPLATE,
    obsidianVaultPath: env.OBSIDIAN_VAULT_PATH,
    targetAccounts: env.TARGET_ACCOUNTS.split(',').map((value) => value.trim()).filter(Boolean),
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
    requestTimeoutMs: env.REQUEST_TIMEOUT_MS
  };
}
