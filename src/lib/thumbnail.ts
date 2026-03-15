import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import type { AppConfig, DailyDigest } from '../types.js';
import { ensureDir } from './fs.js';

export async function maybeGenerateThumbnail(
  config: AppConfig,
  digest: DailyDigest,
  day: string,
  vaultRoot: string
): Promise<string | undefined> {
  if (!config.enableThumbnail || !config.thumbnailCommand) return undefined;

  const assetsDir = path.join(vaultRoot, config.assetsSubdir);
  await ensureDir(assetsDir);

  const promptFile = path.join(assetsDir, `${day}.thumbnail-prompt.txt`);
  const outputPath = path.join(assetsDir, `${day}.${config.thumbnailImageExt}`);
  const prompt = buildPrompt(config, digest);

  await writeFile(promptFile, prompt, 'utf8');

  await exec(config.thumbnailCommand, path.resolve(vaultRoot), { promptFile, outputPath });
  return path.relative(vaultRoot, outputPath).replace(/\\/g, '/');
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
