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
  lookbackDays: number;
  onlyIncludeOriginalPosts: boolean;
  skipRetweets: boolean;
  skipReplies: boolean;
  enableTranslation: boolean;
  enableDigest: boolean;
  enableThumbnail: boolean;
  maxHighlights: number;
  thumbnailImageExt: string;
  modelText: string;
  modelImage: string;
  thumbnailPromptStyle: string;
  requestTimeoutMs: number;
  translateBatchSize: number;
  storageType: 'local' | 'dropbox';
  dropboxAccessToken?: string;
  dropboxClientId?: string;
  dropboxClientSecret?: string;
  dropboxRefreshToken?: string;
  dropboxTokenStoragePath?: string;
  dropboxBasePath?: string;
};

export type AccountConfig = {
  name: string;
  description?: string;
  category?: string;
};

export type AccountsConfig = {
  accounts: AccountConfig[];
};

export type State = {
  lastRunDate?: string;
  seenIds?: string[];
};
