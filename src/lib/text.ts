export function stripHtml(input: string): string {
  return input
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function detectLanguage(text: string): 'ja' | 'en' | 'other' {
  const japaneseChars = (text.match(/[ぁ-んァ-ン一-龯]/g) ?? []).length;
  const latinChars = (text.match(/[A-Za-z]/g) ?? []).length;

  if (japaneseChars >= 4) return 'ja';
  if (latinChars >= Math.max(10, japaneseChars * 2)) return 'en';
  return 'other';
}

export function looksLikeRetweet(text: string): boolean {
  return /^RT\s+@/i.test(text) || /(^|\s)via\s+@/i.test(text);
}

export function looksLikeReply(text: string): boolean {
  return /^@\w+/.test(text.trim());
}

export function normalizeForDedup(text: string): string {
  return text
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, '')
    .replace(/[@#]\w+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function truncate(text: string, maxLength = 600): string {
  return text.length <= maxLength ? text : `${text.slice(0, maxLength - 1)}…`;
}
