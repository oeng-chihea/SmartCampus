import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';
import { resolveAppOrigin } from '../core/utils/qr-scan.util';

/**
 * Resolves the configured public origin for legacy scan-link integrations.
 * It is retained for compatibility; new QR images contain only raw payloads.
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
