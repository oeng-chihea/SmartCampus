import { Injectable } from '@nestjs/common';
import { buildScanOrigin, detectLanIPv4 } from './common/utils/lan.util';

export interface ScanOriginResponse {
  /** Origin encoded into teacher QR images (phone-reachable when Wi-Fi is up). */
  origin: string;
  lanAddress: string | null;
  connected: boolean;
}

@Injectable()
export class AppService {
  getHello(): string {
    return 'Hello World!';
  }

  /**
   * Wi-Fi / LAN origin for attendance QR deep links.
   * `requestOrigin` is the teacher browser Origin/Referer (used for the port).
   */
  getScanOrigin(requestOrigin?: string | null): ScanOriginResponse {
    const lanAddress = detectLanIPv4();
    return {
      origin: buildScanOrigin(lanAddress, requestOrigin),
      lanAddress,
      connected: Boolean(lanAddress),
    };
  }
}
