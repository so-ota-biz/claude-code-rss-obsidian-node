import type { AppConfig, DailyDigest, FeedPost, ProcessedPost } from '../types.js';
import { detectLanguage, looksLikeReply, looksLikeRetweet, normalizeForDedup } from './text.js';
import { GeminiClient } from './gemini.js';

export async function processPosts(
  posts: FeedPost[],
  config: AppConfig,
  gemini: GeminiClient
): Promise<ProcessedPost[]> {
  const seen = new Set<string>();
  const accepted: ProcessedPost[] = [];

  for (const post of posts.sort((a, b) => +new Date(a.publishedAt) - +new Date(b.publishedAt))) {
    if (config.skipRetweets && looksLikeRetweet(post.content)) continue;
    if (config.skipReplies && looksLikeReply(post.content)) continue;

    const normalized = normalizeForDedup(post.content);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);

    const language = detectLanguage(post.content);
    const translatedText = config.enableTranslation && language === 'en'
      ? await gemini.translate(post.content)
      : post.content;

    accepted.push({
      ...post,
      translatedText,
      language
    });
  }

  return accepted;
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
