import { Injectable, Logger } from '@nestjs/common';
import {
  ReverseGeocodeResult,
  buildScanLocationLabel,
  usableNearbyPlaceName,
} from '../../common/utils/reverse-geocode.util';

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/reverse';
const LOOKUP_TIMEOUT_MS = 2_000;
const USER_AGENT = 'SmartCampusAttendance/1.0 (campus attendance geofence)';
/** Laptop / Wi-Fi fixes this coarse should not claim a specific street. */
const STREET_ACCURACY_LIMIT_M = 150;

/**
 * Turns a student GPS fix into a stored place name.
 * One Nominatim reverse call — submit must not wait on Overpass.
 */
@Injectable()
export class ReverseGeocodeService {
  private readonly logger = new Logger(ReverseGeocodeService.name);
  private readonly labelCache = new Map<string, string | null>();
  private readonly resultCache = new Map<string, ReverseGeocodeResult | null>();

  async lookup(
    latitude: number,
    longitude: number,
    accuracyMeters?: number,
  ): Promise<string | null> {
    const useStreet =
      accuracyMeters == null || accuracyMeters <= STREET_ACCURACY_LIMIT_M;
    const zoom = useStreet ? 16 : 14;
    const labelKey = `${latitude.toFixed(4)},${longitude.toFixed(4)},z${zoom}`;
    if (this.labelCache.has(labelKey)) {
      return this.labelCache.get(labelKey) ?? null;
    }

    try {
      const result = await this.cachedFetch(latitude, longitude, zoom);
      const placeName = usableNearbyPlaceName(result, latitude, longitude);
      const label = buildScanLocationLabel(result, result, placeName);
      this.labelCache.set(labelKey, label);
      return label;
    } catch (error) {
      this.logger.warn(
        `Reverse geocode failed for ${latitude},${longitude}: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );
      this.labelCache.set(labelKey, null);
      return null;
    }
  }

  private async cachedFetch(
    latitude: number,
    longitude: number,
    zoom: number,
  ): Promise<ReverseGeocodeResult | null> {
    const decimals = zoom <= 14 ? 3 : 4;
    const key = `${latitude.toFixed(decimals)},${longitude.toFixed(decimals)},z${zoom}`;
    if (this.resultCache.has(key)) {
      return this.resultCache.get(key) ?? null;
    }
    const result = await this.requestNominatim(latitude, longitude, zoom);
    this.resultCache.set(key, result);
    return result;
  }

  private async requestNominatim(
    latitude: number,
    longitude: number,
    zoom: number,
  ): Promise<ReverseGeocodeResult> {
    const url = new URL(NOMINATIM_URL);
    url.searchParams.set('lat', String(latitude));
    url.searchParams.set('lon', String(longitude));
    url.searchParams.set('format', 'jsonv2');
    url.searchParams.set('addressdetails', '1');
    url.searchParams.set('zoom', String(zoom));
    url.searchParams.set('layer', 'address');

    const response = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'Accept-Language': 'en',
        'User-Agent': USER_AGENT,
      },
      signal: AbortSignal.timeout(LOOKUP_TIMEOUT_MS),
    });

    if (response.status === 429) {
      throw new Error('Nominatim HTTP 429');
    }

    if (response.status === 400) {
      return this.requestNominatimWithoutLayer(latitude, longitude, zoom);
    }

    if (!response.ok) {
      throw new Error(`Nominatim HTTP ${response.status}`);
    }

    return (await response.json()) as ReverseGeocodeResult;
  }

  private async requestNominatimWithoutLayer(
    latitude: number,
    longitude: number,
    zoom: number,
  ): Promise<ReverseGeocodeResult> {
    const url = new URL(NOMINATIM_URL);
    url.searchParams.set('lat', String(latitude));
    url.searchParams.set('lon', String(longitude));
    url.searchParams.set('format', 'jsonv2');
    url.searchParams.set('addressdetails', '1');
    url.searchParams.set('zoom', String(zoom));

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
}
