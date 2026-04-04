import type { AppConfig, DailyDigest, FeedPost, ProcessedPost } from '../types.js';
import { detectLanguage, looksLikeReply, looksLikeRetweet, normalizeForDedup } from './text.js';
import { GeminiClient } from './gemini.js';

export async function processPosts(
  posts: FeedPost[],
  config: AppConfig,
  gemini: GeminiClient
): Promise<ProcessedPost[]> {
  const seen = new Set<string>();

  type StagedPost = { post: FeedPost; language: 'ja' | 'en' | 'other'; needsTranslation: boolean };
  const staged: StagedPost[] = [];

  // Pass 1: filter, dedup, language detection
  for (const post of posts.sort((a, b) => +new Date(a.publishedAt) - +new Date(b.publishedAt))) {
    if (config.skipRetweets && looksLikeRetweet(post.content)) continue;
    if (config.skipReplies && looksLikeReply(post.content)) continue;

    const normalized = normalizeForDedup(post.content);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);

    const language = detectLanguage(post.content);
    staged.push({ post, language, needsTranslation: config.enableTranslation && language === 'en' });
  }

  // Pass 2: batch translate all English posts in one shot
  const englishTexts = staged.filter(s => s.needsTranslation).map(s => s.post.content);
  const translations = englishTexts.length > 0
    ? await gemini.translateBatch(englishTexts, config.translateBatchSize)
    : [];

  let transIdx = 0;
  return staged.map(({ post, language, needsTranslation }) => ({
    ...post,
    language,
    translatedText: needsTranslation ? translations[transIdx++] : post.content
  }));
}

export async function buildDigest(
  posts: ProcessedPost[],
  config: AppConfig,
  gemini: GeminiClient,
  day: string
): Promise<DailyDigest> {
  if (!config.enableDigest) {
    return {
      title: `Claude Code Daily Highlights - ${day}`,
      summary: 'Digest generation is disabled.',
      notableAccounts: Array.from(new Set(posts.map((post) => post.account))),
      highlights: []
    };
  }

  return gemini.buildDigest(posts, day, config.maxHighlights);
}
