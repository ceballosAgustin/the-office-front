/**
 * Centralized date/time formatting utility for The Office BA.
 * Formats UTC ISO-8601 timestamps (java.time.Instant with 'Z') into
 * Argentina time (America/Argentina/Buenos_Aires) using Intl.DateTimeFormat.
 */

export const ARGENTINA_LOCALE = 'es-AR';
export const ARGENTINA_TIME_ZONE = 'America/Argentina/Buenos_Aires';

const argentinaDateTimeFormatter = new Intl.DateTimeFormat(ARGENTINA_LOCALE, {
  timeZone: ARGENTINA_TIME_ZONE,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

const argentinaDateOnlyFormatter = new Intl.DateTimeFormat(ARGENTINA_LOCALE, {
  timeZone: ARGENTINA_TIME_ZONE,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

function parseTimestampSafely(value: unknown): Date | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }
    const parsed = new Date(trimmed);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      return null;
    }
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  return null;
}

/**
 * Formats an ISO-8601 UTC timestamp (e.g. "2026-11-07T00:55:56.158816Z")
 * into Argentina local date and 24-hour time with seconds: "DD/MM/YYYY HH:mm:ss".
 * Returns "—" safely if the input is null, undefined, empty, or invalid.
 */
export function formatArgentinaDateTime(
  createdAt?: string | Date | number | null
): string {
  const date = parseTimestampSafely(createdAt);
  if (!date) {
    return '—';
  }

  try {
    return argentinaDateTimeFormatter
      .format(date)
      .replace(/,\s*/g, ' ')
      .trim();
  } catch {
    return '—';
  }
}

/**
 * Formats an ISO-8601 UTC timestamp into Argentina local date only: "DD/MM/YYYY".
 * Uses the same centralized locale and timeZone configuration.
 */
export function formatArgentinaDate(
  createdAt?: string | Date | number | null
): string {
  const date = parseTimestampSafely(createdAt);
  if (!date) {
    return '—';
  }

  try {
    return argentinaDateOnlyFormatter.format(date).trim();
  } catch {
    return '—';
  }
}

