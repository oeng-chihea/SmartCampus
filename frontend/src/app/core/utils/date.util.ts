export function formatDate(value: string | Date, locale = 'en-US'): string {
  return new Intl.DateTimeFormat(locale).format(new Date(value));
}

/**
 * Sessions table "Opened" cell: `8-8-26/6:32Pm`
 * (no leading zeros; compact date + time with Pm/Am suffix)
 */
export function formatSessionOpened(value: string | Date): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const month = date.getMonth() + 1;
  const day = date.getDate();
  const year = String(date.getFullYear()).slice(-2);

  return `${month}-${day}-${year}/${formatClockTime(date)}`;
}

/**
 * Session due time for tables / student cards: `7:30Pm`
 * Empty / invalid values render as an em dash.
 */
export function formatSessionDue(value: string | Date | null | undefined): string {
  if (value == null || value === '') {
    return '—';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '—';
  }
  return formatClockTime(date);
}

/**
 * True when dueAt is a valid instant at or before `now`.
 * Missing / invalid dueAt → false (treat as still open for marking).
 */
export function isSessionPastDue(
  dueAt: string | Date | null | undefined,
  now: Date | number = Date.now(),
): boolean {
  if (dueAt == null || dueAt === '') {
    return false;
  }
  const dueMs = new Date(dueAt).getTime();
  if (Number.isNaN(dueMs)) {
    return false;
  }
  const nowMs = typeof now === 'number' ? now : now.getTime();
  return dueMs <= nowMs;
}

/**
 * Build an ISO dueAt from local **today** + HTML `type="time"` value (`HH:mm` or `HH:mm:ss`).
 * Returns null when the time string is invalid.
 */
export function buildDueAtFromLocalTime(dueTime: string, now: Date = new Date()): string | null {
  const match = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(dueTime.trim());
  if (!match) {
    return null;
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const seconds = match[3] ? Number(match[3]) : 0;
  if (
    !Number.isInteger(hours) ||
    !Number.isInteger(minutes) ||
    !Number.isInteger(seconds) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59 ||
    seconds < 0 ||
    seconds > 59
  ) {
    return null;
  }

  const due = new Date(now);
  due.setHours(hours, minutes, seconds, 0);
  return due.toISOString();
}

/** Default HTML time value: now + leadMinutes, clamped to same local day. */
export function defaultDueTimeLocal(leadMinutes = 30, now: Date = new Date()): string {
  const due = new Date(now.getTime() + leadMinutes * 60 * 1000);
  const hours = String(due.getHours()).padStart(2, '0');
  const minutes = String(due.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

function formatClockTime(date: Date): string {
  const hours24 = date.getHours();
  const hour12 = hours24 % 12 || 12;
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const meridiem = hours24 >= 12 ? 'Pm' : 'Am';
  return `${hour12}:${minutes}${meridiem}`;
}
