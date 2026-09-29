import { describe, expect, it } from 'vitest';
import {
  buildDueAtFromLocalDateTime,
  buildDueAtFromLocalTime,
  defaultDueLocal,
  formatAttendanceDateTime,
  formatAttendanceDateTimeLabel,
  formatDate,
  formatRecentScanTime,
  formatSessionDue,
  formatSessionOpened,
  isSessionPastDue,
  toLocalDateInput,
  toLocalTimeInput,
} from './date.util';

describe('formatDate', () => {
  it('formats as ISO YYYY-MM-DD', () => {
    expect(formatDate(new Date(2026, 8, 23))).toBe('2026-09-23');
  });

  it('renders a dash when invalid', () => {
    expect(formatDate('invalid')).toBe('—');
  });
});

describe('formatSessionOpened', () => {
  it('formats as ISO YYYY-MM-DD with hyphenated time', () => {
    const date = new Date(2026, 7, 16, 23, 4, 0);
    expect(formatSessionOpened(date)).toBe('2026-08-16-11:04Pm');
  });

  it('pads single-digit month and day with leading zeros in ISO format', () => {
    const date = new Date(2026, 0, 8, 6, 32, 0);
    expect(formatSessionOpened(date)).toBe('2026-01-08-6:32Am');
  });

  it('returns an empty string for invalid values', () => {
    expect(formatSessionOpened('not-a-date')).toBe('');
  });
});

describe('formatAttendanceDateTime', () => {
  it('splits the same instant into a readable ISO date and clock', () => {
    const result = formatAttendanceDateTime(new Date(2026, 7, 16, 23, 5, 0));
    expect(result.title).toBe('2026-08-16');
    expect(result.subtitle).toBe('11:05Pm');
  });

  it('keeps morning hours on a 12-hour clock with leading zero in month/day', () => {
    const result = formatAttendanceDateTime(new Date(2026, 0, 8, 6, 32, 0));
    expect(result.title).toBe('2026-01-08');
    expect(result.subtitle).toBe('6:32Am');
  });

  it('falls back to an em dash when the value is invalid', () => {
    expect(formatAttendanceDateTime('not-a-date')).toEqual({ title: '—' });
  });
});

describe('formatAttendanceDateTimeLabel', () => {
  it('formats the date and clock in ISO format for detail dialogs', () => {
    const label = formatAttendanceDateTimeLabel(new Date(2026, 7, 16, 23, 5, 0));
    expect(label).toBe('2026-08-16-11:05Pm');
  });

  it('renders a dash when the value is invalid', () => {
    expect(formatAttendanceDateTimeLabel('not-a-date')).toBe('—');
  });
});

describe('formatRecentScanTime', () => {
  it('labels the same local day as Today', () => {
    const now = new Date(2026, 7, 20, 23, 45, 0);
    expect(formatRecentScanTime(new Date(2026, 7, 20, 23, 30, 0), now).replace(/\s/g, ' ')).toBe(
      'Today, 11:30 PM',
    );
  });

  it('uses a short date for a different day', () => {
    const now = new Date(2026, 7, 21, 9, 0, 0);
    expect(formatRecentScanTime(new Date(2026, 7, 20, 20, 12, 0), now).replace(/\s/g, ' ')).toBe(
      'Aug 20, 8:12 PM',
    );
  });
});

describe('formatSessionDue', () => {
  it('matches the opened stamp so a next-day due is readable', () => {
    const date = new Date(2026, 7, 17, 9, 30, 0);
    expect(formatSessionDue(date)).toBe('2026-08-17-9:30Am');
  });

  it('renders a dash when due is missing or invalid', () => {
    expect(formatSessionDue(null)).toBe('—');
    expect(formatSessionDue('')).toBe('—');
    expect(formatSessionDue('not-a-date')).toBe('—');
  });
});

describe('buildDueAtFromLocalDateTime', () => {
  it('builds a local instant from YYYY-MM-DD and HH:mm', () => {
    const iso = buildDueAtFromLocalDateTime('2026-08-17', '09:30');
    expect(iso).not.toBeNull();
    const parsed = new Date(iso!);
    expect(parsed.getFullYear()).toBe(2026);
    expect(parsed.getMonth()).toBe(7);
    expect(parsed.getDate()).toBe(17);
    expect(parsed.getHours()).toBe(9);
    expect(parsed.getMinutes()).toBe(30);
    expect(parsed.getSeconds()).toBe(0);
  });

  it('accepts HH:mm:ss', () => {
    const iso = buildDueAtFromLocalDateTime('2026-08-16', '23:04:15');
    expect(iso).not.toBeNull();
    const parsed = new Date(iso!);
    expect(parsed.getSeconds()).toBe(15);
  });

  it('rejects overflow dates and invalid times', () => {
    expect(buildDueAtFromLocalDateTime('2026-02-31', '09:00')).toBeNull();
    expect(buildDueAtFromLocalDateTime('2026-08-16', '24:00')).toBeNull();
    expect(buildDueAtFromLocalDateTime('2026-8-16', '09:00')).toBeNull();
    expect(buildDueAtFromLocalDateTime('', '09:00')).toBeNull();
    expect(buildDueAtFromLocalDateTime('2026-08-16', '')).toBeNull();
  });
});

describe('buildDueAtFromLocalTime', () => {
  it('uses the provided calendar day as today', () => {
    const now = new Date(2026, 7, 16, 8, 0, 0);
    const iso = buildDueAtFromLocalTime('11:40', now);
    expect(iso).not.toBeNull();
    const parsed = new Date(iso!);
    expect(parsed.getFullYear()).toBe(2026);
    expect(parsed.getMonth()).toBe(7);
    expect(parsed.getDate()).toBe(16);
    expect(parsed.getHours()).toBe(11);
    expect(parsed.getMinutes()).toBe(40);
  });
});

describe('defaultDueLocal', () => {
  it('rolls the date forward when lead minutes cross midnight', () => {
    const now = new Date(2026, 7, 16, 23, 50, 0);
    expect(defaultDueLocal(30, now)).toEqual({
      date: '2026-08-17',
      time: '00:20',
    });
  });

  it('stays on the same day when lead minutes stay before midnight', () => {
    const now = new Date(2026, 7, 16, 11, 10, 0);
    expect(defaultDueLocal(30, now)).toEqual({
      date: '2026-08-16',
      time: '11:40',
    });
  });
});

describe('local input helpers', () => {
  it('pads date and time for HTML inputs', () => {
    const now = new Date(2026, 7, 8, 7, 5, 0);
    expect(toLocalDateInput(now)).toBe('2026-08-08');
    expect(toLocalTimeInput(now)).toBe('07:05');
  });
});

describe('isSessionPastDue', () => {
  it('is true at or after the due instant', () => {
    const due = new Date(2026, 7, 16, 11, 40, 0);
    expect(isSessionPastDue(due, due)).toBe(true);
    expect(isSessionPastDue(due, new Date(due.getTime() + 1))).toBe(true);
    expect(isSessionPastDue(due, new Date(due.getTime() - 1))).toBe(false);
  });

  it('treats missing due as still open', () => {
    expect(isSessionPastDue(null)).toBe(false);
    expect(isSessionPastDue('')).toBe(false);
  });
});
