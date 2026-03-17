import Parser from 'rss-parser';
import type { AppConfig, FeedPost } from '../types.js';
import { isWithinRange } from './date.js';
import { stripHtml } from './text.js';

const parser = new Parser({
  customFields: {
    item: [
      ['content:encoded', 'contentEncoded'],
      ['dc:creator', 'dcCreator']
    ]
  }
});

type RssItem = Parser.Item & {
  id?: string;
  contentEncoded?: string;
  dcCreator?: string;
};

export async function fetchPostsForAccount(
  config: AppConfig,
  account: string,
  range: { startIso: string; endIso: string }
): Promise<FeedPost[]> {
  const route = config.rsshubRouteTemplate.replace(':account', encodeURIComponent(account));
  const url = `${config.rsshubBaseUrl}${route}`;
  
  try {
    const feed = await parser.parseURL(url);

    return (feed.items as RssItem[])
      .map((item) => ({
        account,
        title: item.title?.trim() || '',
        link: item.link?.trim() || '',
        id: item.guid || item.id || item.link || `${account}-${item.isoDate ?? item.pubDate ?? Math.random()}`,
        publishedAt: item.isoDate || item.pubDate || new Date().toISOString(),
        content: stripHtml(item.contentEncoded || item.content || item.contentSnippet || item.title || ''),
        contentSnippet: item.contentSnippet,
        author: item.creator || item.dcCreator,
        categories: item.categories
      }))
      .filter((item) => Boolean(item.content) && Boolean(item.link))
      .filter((item) => isWithinRange(item.publishedAt, range.startIso, range.endIso))
      .slice(0, config.maxPostsPerAccount);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    if (errorMessage.includes('503') || errorMessage.includes('Status code 503')) {
      console.error(`[error] Account @${account}: RSS feed unavailable (503 Service Unavailable)`);
      console.error(`[error] This is likely due to Twitter API configuration not being set up in RSSHub.`);
      console.error(`[error] Please check docs/troubleshooting.md for Twitter API setup instructions.`);
    } else if (errorMessage.includes('404') || errorMessage.includes('Status code 404')) {
      console.error(`[error] Account @${account}: Account not found (404)`);
    } else if (errorMessage.includes('429') || errorMessage.includes('Status code 429')) {
      console.error(`[error] Account @${account}: Rate limit exceeded (429)`);
      console.error(`[error] Please wait and try again later.`);
    } else {
      console.error(`[error] Account @${account}: Failed to fetch RSS feed - ${errorMessage}`);
    }
    
    console.info(`[info] Continuing with other accounts...`);
    return [];
  }
}
