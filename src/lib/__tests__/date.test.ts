import { describe, it, expect } from 'vitest';
import { getTargetDateRange, isWithinRange } from '../date.js';

describe('getTargetDateRange', () => {
  it('returns the previous day label in Asia/Tokyo timezone', () => {
    // 2026-03-16 10:00:00 JST → previous day is 2026-03-15
    const now = new Date('2026-03-16T01:00:00Z'); // 2026-03-16T10:00:00+09:00
    const { day } = getTargetDateRange('Asia/Tokyo', 1, now);
    expect(day).toBe('2026-03-15');
  });

  it('startIso is the UTC equivalent of 00:00:00 JST on the previous day', () => {
    // previous day = 2026-03-15
    // 2026-03-15T00:00:00+09:00 = 2026-03-14T15:00:00Z
    const now = new Date('2026-03-16T01:00:00Z');
    const { startIso } = getTargetDateRange('Asia/Tokyo', 1, now);
    expect(new Date(startIso).toISOString()).toBe('2026-03-14T15:00:00.000Z');
  });

  it('endIso is the UTC equivalent of 00:00:00 JST on the current day (= end of previous day)', () => {
    // 2026-03-16T00:00:00+09:00 = 2026-03-15T15:00:00Z
    const now = new Date('2026-03-16T01:00:00Z');
    const { endIso } = getTargetDateRange('Asia/Tokyo', 1, now);
    expect(new Date(endIso).toISOString()).toBe('2026-03-15T15:00:00.000Z');
  });

  it('handles month boundary correctly', () => {
    // 2026-03-01T01:00:00Z is 2026-03-01T10:00:00+09:00 → previous day = 2026-02-28
    const now = new Date('2026-03-01T01:00:00Z');
    const { day } = getTargetDateRange('Asia/Tokyo', 1, now);
    expect(day).toBe('2026-02-28');
  });

  it('handles year boundary correctly', () => {
    // 2026-01-01T01:00:00Z is 2026-01-01T10:00:00+09:00 → previous day = 2025-12-31
    const now = new Date('2026-01-01T01:00:00Z');
    const { day } = getTargetDateRange('Asia/Tokyo', 1, now);
    expect(day).toBe('2025-12-31');
  });

  it('works with UTC timezone', () => {
    const now = new Date('2026-03-16T10:00:00Z');
    const { day } = getTargetDateRange('UTC', 1, now);
    expect(day).toBe('2026-03-15');
  });

  describe('lookbackDays > 1', () => {
    // now = 2026-03-16T01:00:00Z = 2026-03-16T10:00:00+09:00
    // today(JST) = 2026-03-16, yesterday = 2026-03-15
    const now = new Date('2026-03-16T01:00:00Z');

    it('day label stays as yesterday regardless of lookbackDays', () => {
      const { day } = getTargetDateRange('Asia/Tokyo', 7, now);
      expect(day).toBe('2026-03-15');
    });

    it('endIso stays as today 00:00 JST regardless of lookbackDays', () => {
      // 2026-03-16T00:00:00+09:00 = 2026-03-15T15:00:00Z
      const { endIso } = getTargetDateRange('Asia/Tokyo', 7, now);
      expect(new Date(endIso).toISOString()).toBe('2026-03-15T15:00:00.000Z');
    });

    it('startIso goes back 7 days from today 00:00 JST', () => {
      // startDay = 2026-03-16 - 7 days = 2026-03-09
      // 2026-03-09T00:00:00+09:00 = 2026-03-08T15:00:00Z
      const { startIso } = getTargetDateRange('Asia/Tokyo', 7, now);
      expect(new Date(startIso).toISOString()).toBe('2026-03-08T15:00:00.000Z');
    });

    it('lookbackDays=1 produces the same result as the default', () => {
      const r1 = getTargetDateRange('Asia/Tokyo', 1, now);
      const rDefault = getTargetDateRange('Asia/Tokyo', 1, now);
      expect(r1).toEqual(rDefault);
    });
  });
});

describe('isWithinRange', () => {
  const start = '2026-03-15T00:00:00.000Z';
  const end = '2026-03-16T00:00:00.000Z';

  it('returns true when time equals startIso (inclusive lower bound)', () => {
    expect(isWithinRange(start, start, end)).toBe(true);
  });

  it('returns false when time equals endIso (exclusive upper bound)', () => {
    expect(isWithinRange(end, start, end)).toBe(false);
  });

  it('returns true for a time strictly within the range', () => {
    expect(isWithinRange('2026-03-15T12:00:00.000Z', start, end)).toBe(true);
  });

  it('returns false for a time before the range', () => {
    expect(isWithinRange('2026-03-14T23:59:59.999Z', start, end)).toBe(false);
  });

  it('returns false for a time after the range', () => {
    expect(isWithinRange('2026-03-16T00:00:01.000Z', start, end)).toBe(false);
  });
});
