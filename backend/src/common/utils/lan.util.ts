import { networkInterfaces, type NetworkInterfaceInfo } from 'os';

const PREFERRED_IFACE = /^(en0|en1|wlan0|eth0|wi-?fi)/i;

/**
 * First private IPv4 on this machine (campus Wi‑Fi / LAN).
 * Kept for diagnostics; teacher QR no longer encodes this address.
 */
export function detectLanIPv4(
  interfaces: NodeJS.Dict<NetworkInterfaceInfo[]> = networkInterfaces(),
): string | null {
  const candidates: { name: string; address: string }[] = [];

  for (const [name, addrs] of Object.entries(interfaces)) {
    for (const addr of addrs ?? []) {
      if (addr.internal || !isIPv4(addr.family)) {
        continue;
      }
      if (!isPrivateIPv4(addr.address)) {
        continue;
      }
      candidates.push({ name, address: addr.address });
    }
  }

  const preferred = candidates.find((row) => PREFERRED_IFACE.test(row.name));
  if (preferred) {
    return preferred.address;
  }

  const homeLan = candidates.find((row) => row.address.startsWith('192.168.'));
  return homeLan?.address ?? candidates[0]?.address ?? null;
}

/**
 * Origin encoded into teacher QR deep links.
 * Prefers PUBLIC_APP_URL, then the teacher browser URL.
 * Does not substitute the API server's LAN / Wi-Fi IP.
 */
export function buildScanOrigin(
  requestOrigin?: string | null,
  publicAppUrl?: string | null,
): string {
  const configured = originFromUrl(publicAppUrl, true);
  if (configured) {
    return configured;
  }
  const fromRequest = originFromUrl(requestOrigin, false);
  if (fromRequest) {
    return fromRequest;
  }
  return 'http://localhost:4200';
}

export function isPublicScanHost(hostname: string): boolean {
  return !isLoopbackHost(hostname) && !isPrivateIPv4(hostname);
}

export function isPrivateIPv4(address: string): boolean {
  if (address.startsWith('169.254.')) {
    return false;
  }
  if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(address)) {
    return true;
  }
  if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(address)) {
    return true;
  }
  const match = /^172\.(\d{1,3})\.\d{1,3}\.\d{1,3}$/.exec(address);
  if (!match) {
    return false;
  }
  const second = Number(match[1]);
  return second >= 16 && second <= 31;
}

function originFromUrl(
  raw?: string | null,
  requirePublicHost = false,
): string | null {
  const parsed = parseOrigin(raw);
  if (!parsed) {
    return null;
  }
  if (requirePublicHost && !isPublicScanHost(parsed.hostname)) {
    return null;
  }
  if (isLoopbackHost(parsed.hostname)) {
    return parsed.origin;
  }
  if (isPrivateIPv4(parsed.hostname)) {
    return null;
  }
  return parsed.protocol === 'https:'
    ? parsed.origin
    : `https://${parsed.host}`;
}

function isIPv4(family: string | number): boolean {
  return family === 'IPv4' || family === 4;
}

function isLoopbackHost(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
}

function parseOrigin(raw?: string | null): URL | null {
  if (!raw?.trim()) {
    return null;
  }
  try {
    return new URL(raw);
  } catch {
    return null;
  }
}
