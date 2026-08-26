import { Injectable } from '@nestjs/common';
import { buildScanOrigin, isPublicScanHost } from './common/utils/lan.util';

export interface ScanOriginResponse {
  /** Public site origin encoded into teacher QR images. */
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
   * Public HTTPS origin for attendance QR deep links.
   * Uses PUBLIC_APP_URL when set, otherwise the teacher browser Origin.
   */
  getScanOrigin(requestOrigin?: string | null): ScanOriginResponse {
    const origin = buildScanOrigin(
      requestOrigin,
      process.env.PUBLIC_APP_URL ?? '',
    );
    let hostname = '';
    try {
      hostname = new URL(origin).hostname;
    } catch {
      hostname = '';
    }
    return {
      origin,
      lanAddress: null,
      connected: Boolean(hostname) && isPublicScanHost(hostname),
    };
  }
}
