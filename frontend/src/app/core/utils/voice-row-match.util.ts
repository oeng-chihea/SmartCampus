export interface VoiceRowMatch<T> {
  kind: 'none' | 'one' | 'many';
  rows: T[];
}

function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function matchVisibleRows<T>(options: {
  rows: T[];
  getId: (row: T) => string;
  getLabels: (row: T) => string[];
  rowId?: string;
  query?: string;
  position?: number;
  lastPosition?: boolean;
}): VoiceRowMatch<T> {
  const rows = options.rows;
  if (!rows.length) {
    return { kind: 'none', rows: [] };
  }

  const rowId = String(options.rowId ?? '').trim();
  if (rowId) {
    const exact = rows.filter((row) => options.getId(row) === rowId);
    if (exact.length === 1) {
      return { kind: 'one', rows: exact };
    }
    if (exact.length > 1) {
      return { kind: 'many', rows: exact };
    }
  }

  if (options.lastPosition) {
    return { kind: 'one', rows: [rows[rows.length - 1]] };
  }

  const position = Number(options.position);
  if (Number.isFinite(position) && position >= 1) {
    const row = rows[position - 1];
    return row ? { kind: 'one', rows: [row] } : { kind: 'none', rows: [] };
  }

  const query = normalize(String(options.query ?? ''));
  if (!query) {
    return { kind: 'none', rows: [] };
  }

  const matched = rows.filter((row) =>
    options
      .getLabels(row)
      .some((label) => normalize(label).includes(query) || query.includes(normalize(label))),
  );

  if (matched.length === 1) {
    return { kind: 'one', rows: matched };
  }
  if (matched.length > 1) {
    return { kind: 'many', rows: matched.slice(0, 8) };
  }
  return { kind: 'none', rows: [] };
}

export function describeMatches<T>(
  rows: T[],
  labelOf: (row: T) => string,
): string {
  return rows
    .map((row, index) => `${index + 1}: ${labelOf(row)}`)
    .join('; ');
}

export function isAffirmativeDecision(value: string | boolean | undefined): boolean | null {
  if (typeof value === 'boolean') {
    return value;
  }
  const raw = normalize(String(value ?? ''));
  if (!raw) {
    return null;
  }
  if (
    /^(yes|yeah|yep|ok|okay|confirm|confirmed|do it|go ahead|proceed|continue|sure|try again|retry)$/.test(
      raw,
    )
  ) {
    return true;
  }
  if (/^(no|nope|cancel|stop|never mind|dont|don't)$/.test(raw)) {
    return false;
  }
  return null;
}
