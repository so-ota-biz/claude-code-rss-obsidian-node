import path from 'node:path';
import type { AppConfig, DailyDigest } from '../types.js';
import type { StorageProvider } from './storage.js';
import type { GeminiClient } from './gemini.js';

export async function maybeGenerateThumbnail(
  config: AppConfig,
  gemini: GeminiClient,
  storage: StorageProvider,
  digest: DailyDigest,
  day: string,
  vaultRoot: string
): Promise<string | undefined> {
  if (!config.enableThumbnail) return undefined;

  const prompt = buildPrompt(config, digest);
  const imageBuffer = await gemini.generateImage(prompt);

  const storageAssetsDir = path.join(vaultRoot, config.assetsSubdir);
  const storageOutputPath = path.join(storageAssetsDir, `${day}.${config.thumbnailImageExt}`);
  await storage.ensureDir(storageAssetsDir);
  await storage.writeFile(storageOutputPath, imageBuffer);

  return path.join(config.assetsSubdir, `${day}.${config.thumbnailImageExt}`).replace(/\\/g, '/');
}

function buildPrompt(config: AppConfig, digest: DailyDigest): string {
  const topicLine = digest.highlights.map((item) => item.headline).join(' / ');
  return [
    'Create a thumbnail image for a daily developer digest about Claude Code.',
    `Style: ${config.thumbnailPromptStyle}`,
    `Themes: ${topicLine}`,
    'Avoid legible text in the image.',
    'Use a composition that feels like a modern technical editorial cover.'
  ].join('\n');
}
