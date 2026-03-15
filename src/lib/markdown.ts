import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { DailyDigest, ProcessedPost } from '../types.js';
import { ensureDir, resolveVaultPath } from './fs.js';

export async function writeDigestMarkdown(params: {
  vaultRoot: string;
  outputSubdir: string;
  day: string;
  digest: DailyDigest;
  thumbnailRelativePath?: string;
}): Promise<string> {
  const { vaultRoot, outputSubdir, day, digest, thumbnailRelativePath } = params;
  const dir = path.join(vaultRoot, outputSubdir);
  await ensureDir(dir);

  const body = [
    '---',
    `title: ${escapeYaml(digest.title)}`,
    `date: ${day}`,
    'tags:',
    '  - claude-code',
    '  - x-digest',
    '  - ai-dev',
    ...(thumbnailRelativePath ? [`thumbnail: ${thumbnailRelativePath}`] : []),
    '---',
    '',
    ...(thumbnailRelativePath ? [`![[${thumbnailRelativePath}]]`, ''] : []),
    `# ${digest.title}`,
    '',
    '## 今日の総括',
    digest.summary,
    '',
    '## ハイライト',
    '',
    ...digest.highlights.flatMap((item, index) => [
      `### ${index + 1}. ${item.headline}`,
      '',
      `- なぜ重要か: ${item.whyItMatters}`,
      ...item.points.map((point) => `- ${point}`),
      '- ソース:',
      ...item.sources.map((source) => `  - ${source}`),
      ''
    ]),
    '## 注目アカウント',
    ...digest.notableAccounts.map((account) => `- @${account}`),
    ''
  ].join('\n');

  const filePath = resolveVaultPath(vaultRoot, outputSubdir, `${day}.md`);
  await writeFile(filePath, body, 'utf8');
  return filePath;
}

export async function writeRawMarkdown(params: {
  vaultRoot: string;
  rawSubdir: string;
  day: string;
  posts: ProcessedPost[];
}): Promise<string> {
  const { vaultRoot, rawSubdir, day, posts } = params;
  const dir = path.join(vaultRoot, rawSubdir);
  await ensureDir(dir);

  const lines = [
    '---',
    `title: Claude Code Raw Feed ${day}`,
    `date: ${day}`,
    'tags:',
    '  - claude-code',
    '  - x-raw',
    '---',
    '',
    `# Claude Code Raw Feed ${day}`,
    ''
  ];

  for (const post of posts) {
    lines.push(`## @${post.account}`);
    lines.push('');
    lines.push(`- 投稿日時: ${post.publishedAt}`);
    lines.push(`- URL: ${post.link}`);
    lines.push(`- 言語: ${post.language}`);
    lines.push('');
    lines.push('### 原文');
    lines.push(post.content);
    lines.push('');
    lines.push('### 日本語');
    lines.push(post.translatedText);
    lines.push('');
  }

  const filePath = resolveVaultPath(vaultRoot, rawSubdir, `${day}.md`);
  await writeFile(filePath, lines.join('\n'), 'utf8');
  return filePath;
}

function escapeYaml(input: string): string {
  return JSON.stringify(input);
}
