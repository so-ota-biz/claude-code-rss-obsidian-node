import path from 'node:path';
import { loadConfig } from './lib/config.js';
import { getTargetDateRange } from './lib/date.js';
import { readState, writeState } from './lib/fs.js';
import { GeminiClient } from './lib/gemini.js';
import { writeDigestMarkdown, writeRawMarkdown } from './lib/markdown.js';
import { processPosts, buildDigest } from './lib/pipeline.js';
import { fetchPostsForAccount } from './lib/rss.js';
import { maybeGenerateThumbnail } from './lib/thumbnail.js';
import { createStorageProvider } from './lib/storage-factory.js';
import type { FeedPost } from './types.js';

async function main(): Promise<void> {
  const config = loadConfig();
  const storage = createStorageProvider(config);
  const range = getTargetDateRange(config.timezone, config.lookbackDays);
  const stateDir = config.storageType === 'dropbox' 
    ? config.stateDir  // Dropboxの場合は相対パスのまま使用
    : path.resolve(config.stateDir);  // ローカルの場合は絶対パスに変換
  const state = await readState(storage, stateDir);
  const gemini = new GeminiClient(config.geminiApiKey, config.modelText, config.requestTimeoutMs);

  console.log(`[info] Target day: ${range.day} (${range.startIso} .. ${range.endIso})`);
  console.log(`[info] Storage type: ${config.storageType}`);

  const allPosts: FeedPost[] = [];
  for (const account of config.targetAccounts) {
    console.log(`[info] Fetching RSS for @${account}`);
    const posts = await fetchPostsForAccount(config, account, range);
    console.log(`[info]  -> ${posts.length} posts`);
    allPosts.push(...posts);
  }

  const processed = await processPosts(allPosts, config, gemini);
  console.log(`[info] Accepted posts after filtering: ${processed.length}`);

  const digest = await buildDigest(processed, config, gemini, range.day);
  const thumbnailRelativePath = await maybeGenerateThumbnail(config, storage, digest, range.day, config.obsidianVaultPath)
    .catch((error) => {
      console.warn(`[warn] Thumbnail generation skipped: ${(error as Error).message}`);
      return undefined;
    });

  const digestPath = await writeDigestMarkdown({
    storage,
    vaultRoot: config.obsidianVaultPath,
    outputSubdir: config.outputSubdir,
    day: range.day,
    digest,
    thumbnailRelativePath
  });

  const rawPath = await writeRawMarkdown({
    storage,
    vaultRoot: config.obsidianVaultPath,
    rawSubdir: config.rawSubdir,
    day: range.day,
    posts: processed
  });

  await writeState(storage, stateDir, {
    ...state,
    lastRunDate: range.day,
    seenIds: processed.map((post) => post.id).slice(-500)
  });

  console.log(`[done] Digest written to ${digestPath}`);
  console.log(`[done] Raw feed written to ${rawPath}`);
  if (thumbnailRelativePath) console.log(`[done] Thumbnail: ${thumbnailRelativePath}`);
}

main().catch((error) => {
  console.error('[fatal]', error);
  process.exitCode = 1;
});
