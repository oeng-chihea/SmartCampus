import { Injectable, Logger } from '@nestjs/common';
import {
  ReverseGeocodeResult,
  buildScanLocationLabel,
} from '../../common/utils/reverse-geocode.util';

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/reverse';
const LOOKUP_TIMEOUT_MS = 5_000;
const USER_AGENT = 'SmartCampusAttendance/1.0 (campus attendance geofence)';

/**
 * Turns a student GPS fix into a stored place name at submit time.
 * Failures are swallowed so a Nominatim outage never blocks attendance.
 */
@Injectable()
export class ReverseGeocodeService {
  private readonly logger = new Logger(ReverseGeocodeService.name);
  private readonly cache = new Map<string, string | null>();

  async lookup(
    latitude: number,
    longitude: number,
  ): Promise<string | null> {
    const cacheKey = this.cacheKey(latitude, longitude);
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey) ?? null;
    }

    try {
      const result = await this.fetchNominatim(latitude, longitude);
      const label = buildScanLocationLabel(result);
      this.cache.set(cacheKey, label);
      return label;
    } catch (error) {
      this.logger.warn(
        `Reverse geocode failed for ${latitude},${longitude}: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );
      this.cache.set(cacheKey, null);
      return null;
    }
  }

  private async fetchNominatim(
    latitude: number,
    longitude: number,
  ): Promise<ReverseGeocodeResult> {
    const url = new URL(NOMINATIM_URL);
    url.searchParams.set('lat', String(latitude));
    url.searchParams.set('lon', String(longitude));
    url.searchParams.set('format', 'jsonv2');
    url.searchParams.set('addressdetails', '1');
    url.searchParams.set('zoom', '18');

    const response = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'Accept-Language': 'en',
        'User-Agent': USER_AGENT,
      },
      signal: AbortSignal.timeout(LOOKUP_TIMEOUT_MS),
    });

    if (!response.ok) {
      throw new Error(`Nominatim HTTP ${response.status}`);
    }

    return (await response.json()) as ReverseGeocodeResult;
  }
q
  /** ~1 m grid so nearby retries reuse the same lookup. */
  private cacheKey(latitude: number, longitude: number): string {
    return `${latitude.toFixed(5)},${longitude.toFixed(5)}`;
  }
}
