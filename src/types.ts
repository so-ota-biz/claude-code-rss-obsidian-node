export type FeedPost = {
  account: string;
  title: string;
  link: string;
  id: string;
  publishedAt: string;
  content: string;
  contentSnippet?: string;
  author?: string;
  categories?: string[];
};

export type ProcessedPost = FeedPost & {
  translatedText: string;
  language: 'ja' | 'en' | 'other';
  filteredReason?: string;
};

export type Highlight = {
  headline: string;
  whyItMatters: string;
  points: string[];
  sources: string[];
};

export type DailyDigest = {
  title: string;
  summary: string;
  highlights: Highlight[];
  notableAccounts: string[];
};

export type AppConfig = {
  geminiApiKey: string;
  rsshubBaseUrl: string;
  rsshubRouteTemplate: string;
  obsidianVaultPath: string;
  targetAccounts: string[];
  timezone: string;
  outputSubdir: string;
  rawSubdir: string;
  assetsSubdir: string;
  stateDir: string;
  maxPostsPerAccount: number;
  onlyIncludeOriginalPosts: boolean;
  skipRetweets: boolean;
  skipReplies: boolean;
  enableTranslation: boolean;
  enableDigest: boolean;
  enableThumbnail: boolean;
  maxHighlights: number;
  thumbnailCommand?: string;
  thumbnailImageExt: string;
  modelText: string;
  thumbnailPromptStyle: string;
  requestTimeoutMs: number;
};

export type State = {
  lastRunDate?: string;
  seenIds?: string[];
};
