import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';
import { resolveAppOrigin } from '../core/utils/qr-scan.util';

/**
 * Origin encoded into attendance QR images.
 * Uses the public site URL (configured appBaseUrl, otherwise this tab's URL).
 * Does not look up the laptop's campus Wi-Fi IP.
 */
@Injectable({ providedIn: 'root' })
export class ScanOriginService {
  async resolve(): Promise<string> {
    return resolveAppOrigin(
      environment.appBaseUrl,
      typeof window !== 'undefined' ? window.location.origin : '',
    );
  }
}
