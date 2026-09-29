export function formatDate(value: string | Date): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '—';
  }
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Compact record stamp used across Sessions, Attendance, Locations,
 * and student history: `2026-08-16-11:04Pm`
 * (ISO YYYY-MM-DD date; hyphen between date and time; Pm/Am suffix)
 */
export function formatSessionOpened(value: string | Date): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return formatCompactDateTime(date);
}

/**
 * Attendance history Time cell — same instant as `formatSessionOpened`,
 * split for display: `2026-08-16` / `11:05Pm`.
 */
export function formatAttendanceDateTime(value: string | Date): {
  title: string;
  subtitle?: string;
} {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return { title: '—' };
  }
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return {
    title: `${year}-${month}-${day}`,
    subtitle: formatClockTime(date),
  };
}

/** One-line detail label in ISO format: `2026-08-16-11:05Pm`. */
export function formatAttendanceDateTimeLabel(value: string | Date): string {
  const label = formatSessionOpened(value);
  return label || '—';
}

/** Dashboard recent-scan stamp: `Today, 11:30 PM` or `Aug 20, 8:12 PM`. */
export function formatRecentScanTime(
  value: string | Date,
  now: Date = new Date(),
): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '—';
  }
  const clock = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
    .format(date)
    .replace(/\s/g, ' ');
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
  if (sameDay) {
    return `Today, ${clock}`;
  }
  const day = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
  }).format(date);
  return `${day}, ${clock}`;
}

/**
 * Session due for tables / QR panel / student cards: same stamp as Opened.
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
  return formatCompactDateTime(date);
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
 * Build an ISO dueAt from a local calendar date (`YYYY-MM-DD`) and
 * HTML `type="time"` value (`HH:mm` or `HH:mm:ss`).
 * Returns null when either part is invalid (including overflow dates like Feb 31).
 */
export function buildDueAtFromLocalDateTime(
  dueDate: string,
  dueTime: string,
): string | null {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dueDate.trim());
  const timeMatch = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(dueTime.trim());
  if (!dateMatch || !timeMatch) {
    return null;
  }

  const year = Number(dateMatch[1]);
  const month = Number(dateMatch[2]);
  const day = Number(dateMatch[3]);
  const hours = Number(timeMatch[1]);
  const minutes = Number(timeMatch[2]);
  const seconds = timeMatch[3] ? Number(timeMatch[3]) : 0;
  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day) ||
    !Number.isInteger(hours) ||
    !Number.isInteger(minutes) ||
    !Number.isInteger(seconds) ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31 ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59 ||
    seconds < 0 ||
    seconds > 59
  ) {
    return null;
  }

  const due = new Date(year, month - 1, day, hours, minutes, seconds, 0);
  if (
    due.getFullYear() !== year ||
    due.getMonth() !== month - 1 ||
    due.getDate() !== day
  ) {
    return null;
  }
  return due.toISOString();
}

/**
 * Build an ISO dueAt from local **today** + HTML `type="time"` value.
 * Prefer `buildDueAtFromLocalDateTime` when the teacher picked a calendar day.
 */
export function buildDueAtFromLocalTime(dueTime: string, now: Date = new Date()): string | null {
  return buildDueAtFromLocalDateTime(toLocalDateInput(now), dueTime);
}

/** HTML `type="date"` value (`YYYY-MM-DD`) in the local calendar. */
export function toLocalDateInput(now: Date = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** HTML `type="time"` value (`HH:mm`) in the local clock. */
export function toLocalTimeInput(now: Date = new Date()): string {
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

/** Default due date + time: now + leadMinutes (may roll into the next local day). */
export function defaultDueLocal(
  leadMinutes = 30,
  now: Date = new Date(),
): { date: string; time: string } {
  const due = new Date(now.getTime() + leadMinutes * 60 * 1000);
  return { date: toLocalDateInput(due), time: toLocalTimeInput(due) };
}

/** Default HTML time value: now + leadMinutes. */
export function defaultDueTimeLocal(leadMinutes = 30, now: Date = new Date()): string {
  return defaultDueLocal(leadMinutes, now).time;
}

function formatCompactDateTime(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}-${formatClockTime(date)}`;
}

function formatClockTime(date: Date): string {
  const hours24 = date.getHours();
  const hour12 = hours24 % 12 || 12;
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const meridiem = hours24 >= 12 ? 'Pm' : 'Am';
  return `${hour12}:${minutes}${meridiem}`;
}
