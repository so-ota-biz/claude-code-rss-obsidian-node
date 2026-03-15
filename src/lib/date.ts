export function getTargetDateRange(timezone: string, now = new Date()): { day: string; startIso: string; endIso: string } {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });

  const parts = formatter.formatToParts(now);
  const year = Number(parts.find((part) => part.type === 'year')?.value);
  const month = Number(parts.find((part) => part.type === 'month')?.value);
  const day = Number(parts.find((part) => part.type === 'day')?.value);

  const utcMidnight = new Date(Date.UTC(year, month - 1, day));
  const yesterday = new Date(utcMidnight.getTime() - 24 * 60 * 60 * 1000);

  const y = yesterday.getUTCFullYear();
  const m = String(yesterday.getUTCMonth() + 1).padStart(2, '0');
  const d = String(yesterday.getUTCDate()).padStart(2, '0');
  const dayLabel = `${y}-${m}-${d}`;

  // Converts local day bounds in timezone to UTC by sampling offsets around the target dates.
  const startIso = zonedLocalToUtcIso(`${dayLabel}T00:00:00`, timezone);
  const endIso = zonedLocalToUtcIso(nextDay(dayLabel) + 'T00:00:00', timezone);

  return { day: dayLabel, startIso, endIso };
}

function nextDay(day: string): string {
  const dt = new Date(`${day}T00:00:00Z`);
  dt.setUTCDate(dt.getUTCDate() + 1);
  return dt.toISOString().slice(0, 10);
}

function zonedLocalToUtcIso(localIso: string, timezone: string): string {
  const [datePart, timePart] = localIso.split('T');
  const [year, month, day] = datePart.split('-').map(Number);
  const [hour, minute, second] = timePart.split(':').map(Number);
  const approxUtc = new Date(Date.UTC(year, month - 1, day, hour, minute, second));

  const offsetMinutes = getOffsetMinutes(approxUtc, timezone);
  return new Date(approxUtc.getTime() - offsetMinutes * 60 * 1000).toISOString();
}

function getOffsetMinutes(date: Date, timezone: string): number {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });

  const parts = Object.fromEntries(
    formatter.formatToParts(date).filter((part) => part.type !== 'literal').map((part) => [part.type, part.value])
  );

  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second)
  );

  return Math.round((asUtc - date.getTime()) / 60000);
}

export function isWithinRange(isoString: string, startIso: string, endIso: string): boolean {
  const value = new Date(isoString).getTime();
  return value >= new Date(startIso).getTime() && value < new Date(endIso).getTime();
}
