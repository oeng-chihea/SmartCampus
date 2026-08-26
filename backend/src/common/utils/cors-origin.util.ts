const DEFAULT_CORS_ORIGINS = [
  'http://localhost:4200',
  'http://127.0.0.1:4200',
];

/** Scheme + host + port only, no trailing slash or wrapping quotes. */
export function normalizeWebOrigin(raw: string | null | undefined): string | null {
  const trimmed = String(raw ?? '')
    .trim()
    .replace(/^['"]|['"]$/g, '');
  if (!trimmed) {
    return null;
  }
  try {
    return new URL(trimmed).origin;
  } catch {
    return trimmed.replace(/\/+$/, '') || null;
  }
}

/**
 * CORS allow-list from CORS_ORIGINS, plus PUBLIC_APP_URL when set.
 * Production browsers need an exact origin match (e.g. the Render Static Site).
 */
export function resolveCorsOrigins(
  corsOriginsRaw?: string,
  publicAppUrl?: string,
): string[] {
  const fromEnv = (corsOriginsRaw ?? '')
    .split(',')
    .map((value) => normalizeWebOrigin(value))
    .filter((value): value is string => value !== null);
  const publicOrigin = normalizeWebOrigin(publicAppUrl);
  const merged = [...fromEnv];
  if (publicOrigin && !merged.includes(publicOrigin)) {
    merged.push(publicOrigin);
  }
  return merged.length ? merged : [...DEFAULT_CORS_ORIGINS];
}

export function isAllowedCorsOrigin(
  origin: string | undefined,
  allowed: readonly string[],
): boolean {
  const normalized = normalizeWebOrigin(origin);
  if (!normalized) {
    return false;
  }
  return allowed.some((entry) => normalizeWebOrigin(entry) === normalized);
}
