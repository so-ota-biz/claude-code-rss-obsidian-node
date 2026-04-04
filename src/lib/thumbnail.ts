import { writeFile, readFile, mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import type { AppConfig, DailyDigest } from '../types.js';
import type { StorageProvider } from './storage.js';

export async function maybeGenerateThumbnail(
  config: AppConfig,
  storage: StorageProvider,
  digest: DailyDigest,
  day: string,
  vaultRoot: string
): Promise<string | undefined> {
  if (!config.enableThumbnail || !config.thumbnailCommand) return undefined;

  const tempDir = await mkdtemp(path.join(tmpdir(), 'rss-thumb-'));
  try {
    const tempPromptFile = path.join(tempDir, `${day}.thumbnail-prompt.txt`);
    const tempOutputPath = path.join(tempDir, `${day}.${config.thumbnailImageExt}`);
    const prompt = buildPrompt(config, digest);

    // Write prompt to local temp file so the CLI can always read it
    await writeFile(tempPromptFile, prompt, 'utf8');

    // Run the external CLI with local temp paths
    await exec(config.thumbnailCommand, path.resolve(vaultRoot), {
      promptFile: tempPromptFile,
      outputPath: tempOutputPath
    });

    // Read the generated image and upload via storage (local vault or Dropbox)
    const imageBuffer = await readFile(tempOutputPath);
    const storageAssetsDir = path.join(vaultRoot, config.assetsSubdir);
    const storageOutputPath = path.join(storageAssetsDir, `${day}.${config.thumbnailImageExt}`);
    await storage.ensureDir(storageAssetsDir);
    await storage.writeFile(storageOutputPath, imageBuffer);

    return path.join(config.assetsSubdir, `${day}.${config.thumbnailImageExt}`).replace(/\\/g, '/');
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
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

function exec(commandTemplate: string, cwd: string, vars: Record<string, string>): Promise<void> {
  const parts = commandTemplate.trim().split(/\s+/).map((token) =>
    Object.entries(vars).reduce((t, [k, v]) => t.replace(`{${k}}`, v), token)
  );
  const [cmd, ...args] = parts;
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { cwd, shell: false, stdio: 'inherit' });
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Thumbnail command failed with exit code ${code ?? 'unknown'}`));
    });
    child.on('error', reject);
  });
}
