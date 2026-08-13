import { networkInterfaces, type NetworkInterfaceInfo } from 'os';

const DEFAULT_FRONTEND_PORT = 4200;

const PREFERRED_IFACE = /^(en0|en1|wlan0|eth0|wi-?fi)/i;

/**
 * First private IPv4 on this machine (campus Wi‑Fi / LAN).
 * Prefers en0 / wlan, then 192.168.*, then any other RFC1918 address.
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
 * Phone-reachable origin for teacher QR deep links.
 * Uses the LAN IPv4 when Wi‑Fi is up; otherwise falls back to the browser origin.
 */
export function buildScanOrigin(
  lanAddress: string | null,
  requestOrigin?: string | null,
  frontendPort = Number(process.env.FRONTEND_PORT ?? DEFAULT_FRONTEND_PORT),
): string {
  const fromRequest = parseOrigin(requestOrigin);
  const port = fromRequest?.port || String(frontendPort);

  // Phones need HTTPS for Safari GPS. Always encode https on a LAN IP,
  // even if the teacher tab is still http://localhost:4200.
  if (lanAddress) {
    return `https://${lanAddress}:${port}`;
  }

  if (fromRequest && !isLoopbackHost(fromRequest.hostname)) {
    const hostPort = fromRequest.port || port;
    return `https://${fromRequest.hostname}:${hostPort}`;
  }

  return `http://localhost:${port}`;
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
