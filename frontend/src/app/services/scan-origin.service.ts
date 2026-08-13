import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { API_ENDPOINTS } from '../core/constants/api-endpoints';
import { ScanOriginResponse } from '../models/scan-origin.model';

/**
 * Resolves the origin encoded into attendance QR images.
 * Prefers the machine's Wi-Fi / LAN address so phones do not open localhost.
 */
@Injectable({ providedIn: 'root' })
export class ScanOriginService {
  private readonly http = inject(HttpClient);
  private cached: string | null = null;
  private inflight: Promise<string> | null = null;

  async resolve(): Promise<string> {
    if (environment.appBaseUrl) {
      return environment.appBaseUrl.replace(/\/$/, '');
    }
    if (this.cached) {
      return this.cached;
    }
    if (this.inflight) {
      return this.inflight;
    }

    this.inflight = this.fetchOrigin()
      .then((origin) => {
        this.cached = origin;
        return origin;
      })
      .finally(() => {
        this.inflight = null;
      });

    return this.inflight;
  }

  private async fetchOrigin(): Promise<string> {
    try {
      const info = await firstValueFrom(
        this.http.get<ScanOriginResponse>(
          `${environment.apiBaseUrl}${API_ENDPOINTS.scanOrigin}`,
        ),
      );
      if (info.origin) {
        return info.origin.replace(/\/$/, '');
      }
    } catch {
      // Fall through to the current tab origin.
    }
    return typeof window !== 'undefined' ? window.location.origin : '';
  }
}
