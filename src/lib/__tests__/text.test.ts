import { describe, it, expect } from 'vitest';
import {
  stripHtml,
  detectLanguage,
  looksLikeRetweet,
  looksLikeReply,
  normalizeForDedup,
  truncate
} from '../text.js';

describe('stripHtml', () => {
  it('converts <br> and <br/> to newlines', () => {
    expect(stripHtml('line1<br>line2<br/>line3')).toBe('line1\nline2\nline3');
  });

  it('removes HTML tags', () => {
    expect(stripHtml('<div><span>hello</span></div>')).toBe('hello');
  });

  it('decodes HTML entities', () => {
    expect(stripHtml('a &amp; b &lt;c&gt; &#39;d&#39; &quot;e&quot;')).toBe("a & b <c> 'd' \"e\"");
  });

  it('decodes &nbsp; to space', () => {
    expect(stripHtml('a\u00a0b')).toBe('a b');
  });

  it('normalizes multiple spaces to one', () => {
    expect(stripHtml('a   b')).toBe('a b');
  });

  it('collapses 3+ consecutive newlines to 2', () => {
    expect(stripHtml('a\n\n\n\nb')).toBe('a\n\nb');
  });

  it('trims leading and trailing whitespace', () => {
    expect(stripHtml('  hello  ')).toBe('hello');
  });

  it('returns empty string for empty input', () => {
    expect(stripHtml('')).toBe('');
  });
});

describe('detectLanguage', () => {
  it('returns "ja" when Japanese characters >= 4', () => {
    expect(detectLanguage('これは日本語です')).toBe('ja');
  });

  it('returns "en" for English text with sufficient latin chars', () => {
    expect(detectLanguage('This is a test sentence with enough latin characters')).toBe('en');
  });

  it('returns "other" for short ambiguous text', () => {
    expect(detectLanguage('abc')).toBe('other');
  });

  it('returns "other" for empty string', () => {
    expect(detectLanguage('')).toBe('other');
  });

  it('returns "ja" for mixed text dominated by Japanese', () => {
    expect(detectLanguage('Claude Codeの新機能が発表されました')).toBe('ja');
  });
});

describe('looksLikeRetweet', () => {
  it('returns true for RT @user prefix', () => {
    expect(looksLikeRetweet('RT @anthropic: Hello world')).toBe(true);
  });

  it('returns true for via @user pattern', () => {
    expect(looksLikeRetweet('Great post via @anthropic')).toBe(true);
  });

  it('returns false for normal posts', () => {
    expect(looksLikeRetweet('Hello world')).toBe(false);
  });

  it('returns false for posts mentioning RT in the middle', () => {
    expect(looksLikeRetweet('This is not an RT post')).toBe(false);
  });
});

describe('looksLikeReply', () => {
  it('returns true for @user at the start', () => {
    expect(looksLikeReply('@anthropic thanks for the update!')).toBe(true);
  });

  it('returns false when @mention is in the middle', () => {
    expect(looksLikeReply('Check out @anthropic for more')).toBe(false);
  });

  it('returns true even with leading whitespace trimmed', () => {
    expect(looksLikeReply('  @anthropic hello')).toBe(true);
  });

  it('returns false for normal post', () => {
    expect(looksLikeReply('Hello world')).toBe(false);
  });
});

describe('normalizeForDedup', () => {
  it('removes URLs', () => {
    expect(normalizeForDedup('Check https://example.com/path out')).toBe('check out');
  });

  it('removes @mentions', () => {
    expect(normalizeForDedup('Hello @user how are you')).toBe('hello how are you');
  });

  it('removes #hashtags', () => {
    expect(normalizeForDedup('Hello #world')).toBe('hello');
  });

  it('lowercases the text', () => {
    expect(normalizeForDedup('Hello World')).toBe('hello world');
  });

  it('normalizes multiple spaces', () => {
    expect(normalizeForDedup('a   b')).toBe('a b');
  });

  it('trims the result', () => {
    expect(normalizeForDedup('  hello  ')).toBe('hello');
  });
});

describe('truncate', () => {
  it('returns text as-is when within maxLength', () => {
    expect(truncate('hello', 10)).toBe('hello');
  });

  it('truncates and appends ellipsis when over maxLength', () => {
    const result = truncate('abcdefgh', 5);
    expect(result).toBe('abcd…');
    expect(result.length).toBe(5);
  });

  it('uses default maxLength of 600', () => {
    const text = 'a'.repeat(601);
    const result = truncate(text);
    expect(result.length).toBe(600);
    expect(result.endsWith('…')).toBe(true);
  });

  it('returns text unchanged when equal to maxLength', () => {
    const text = 'a'.repeat(600);
    expect(truncate(text)).toBe(text);
  });
});
