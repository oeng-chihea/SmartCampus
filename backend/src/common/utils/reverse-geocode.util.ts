/** Address parts returned by Nominatim reverse geocode. */
export interface ReverseGeocodeAddress {
  amenity?: string;
  building?: string;
  university?: string;
  school?: string;
  shop?: string;
  tourism?: string;
  leisure?: string;
  office?: string;
  residential?: string;
  road?: string;
  pedestrian?: string;
  footway?: string;
  hamlet?: string;
  neighbourhood?: string;
  suburb?: string;
  quarter?: string;
  village?: string;
  city_district?: string;
  city?: string;
  town?: string;
  municipality?: string;
  state?: string;
  country?: string;
}

export interface ReverseGeocodeResult {
  name?: string;
  display_name?: string;
  addresstype?: string;
  category?: string;
  type?: string;
  lat?: string | number;
  lon?: string | number;
  address?: ReverseGeocodeAddress;
}

const CAMPUS_PLACE_KEYS: (keyof ReverseGeocodeAddress)[] = [
  'university',
  'school',
  'building',
  'residential',
];

const CAMPUS_TYPES = new Set(['university', 'school', 'college', 'building']);

const ROAD_KEYS: (keyof ReverseGeocodeAddress)[] = [
  'road',
  'pedestrian',
  'footway',
];

const CITY_KEYS: (keyof ReverseGeocodeAddress)[] = [
  'city',
  'state',
  'municipality',
  'town',
];

/** How close a Nominatim reverse POI must be before we trust its name. */
const NOMINATIM_POI_MAX_M = 40;

export interface NearbyNamedPlace {
  name: string;
  latitude: number;
  longitude: number;
  type?: string;
}

const USABLE_PLACE_TYPES = new Set([
  'building',
  'apartments',
  'apartment',
  'residential',
  'university',
  'school',
  'college',
  'hotel',
  'house',
  'dormitory',
  'yes',
]);

const SKIP_PLACE_TYPES = new Set([
  'hostel',
  'guest_house',
  'motel',
  'shop',
  'clothes',
  'cafe',
  'restaurant',
  'fast_food',
  'bar',
  'pharmacy',
  'fuel',
  'bank',
  'atm',
]);

/**
 * Compact human label from Nominatim.
 * `placeName` is the closest named building from the live nearby search;
 * `area` (lower zoom) supplies sangkat / city so a long boulevard does not
 * inherit the wrong district.
 */
export function buildScanLocationLabel(
  street: ReverseGeocodeResult | null | undefined,
  area?: ReverseGeocodeResult | null,
  placeName?: string | null,
): string | null {
  if (!street && !area && !placeName) {
    return null;
  }

  const streetAddress = street?.address ?? {};
  const areaAddress = area?.address ?? streetAddress;

  const parts = uniqueNonEmpty([
    trimText(placeName ?? undefined),
    campusPlaceName(street),
    firstValue(streetAddress, ROAD_KEYS),
    ...areaParts(areaAddress),
    firstValue(areaAddress, CITY_KEYS),
  ]);

  if (parts.length > 0) {
    return joinLabel(parts);
  }

  return shortenDisplayName(street?.display_name ?? area?.display_name);
}

function campusPlaceName(
  result: ReverseGeocodeResult | null | undefined,
): string | null {
  if (!result) {
    return null;
  }
  const address = result.address ?? {};
  const fromKeys = firstValue(address, CAMPUS_PLACE_KEYS);
  if (fromKeys) {
    return fromKeys;
  }

  const type = (result.addresstype ?? result.type ?? '').toLowerCase();
  if (CAMPUS_TYPES.has(type)) {
    return trimText(result.name);
  }

  const amenity = trimText(address.amenity);
  if (amenity && isCampusAmenity(amenity)) {
    return amenity;
  }
  return null;
}

function isCampusAmenity(value: string): boolean {
  return /\b(university|institute|school|college|campus|academy)\b/i.test(value);
}

/**
 * Named building / apartment next to the GPS pin. Skips hostels and shops
 * that Nominatim likes to snap to, and ignores house numbers like "23".
 */
export function usableNearbyPlaceName(
  result: ReverseGeocodeResult | null | undefined,
  latitude: number,
  longitude: number,
): string | null {
  if (!result) {
    return null;
  }

  const type = (result.addresstype ?? result.type ?? '').toLowerCase();
  if (SKIP_PLACE_TYPES.has(type)) {
    return null;
  }

  const address = result.address ?? {};
  const name =
    firstValue(address, ['building', 'residential', 'university', 'school']) ??
    (USABLE_PLACE_TYPES.has(type) ? trimText(result.name) : null);
  if (!name || isNumericHouseLabel(name)) {
    return null;
  }
  if (!isCloseEnough(result, latitude, longitude, NOMINATIM_POI_MAX_M)) {
    return null;
  }
  return name;
}

/**
 * Closest usable named place from a live Overpass / nearby search.
 * Hostels, shops, and house numbers are ignored so the label follows
 * the student's GPS, not a hardcoded building list.
 */
export function pickClosestNamedPlace(
  places: NearbyNamedPlace[],
  latitude: number,
  longitude: number,
  maxMeters: number,
): NearbyNamedPlace | null {
  let best: { place: NearbyNamedPlace; distance: number } | null = null;

  for (const place of places) {
    const type = (place.type ?? '').toLowerCase();
    if (SKIP_PLACE_TYPES.has(type) || type === 'highway') {
      continue;
    }
    if (isNumericHouseLabel(place.name) || !trimText(place.name)) {
      continue;
    }
    if (type && !USABLE_PLACE_TYPES.has(type) && type !== 'yes') {
      continue;
    }
    const distance = planarDistanceMeters(
      latitude,
      longitude,
      place.latitude,
      place.longitude,
    );
    if (distance > maxMeters) {
      continue;
    }
    if (!best || distance < best.distance) {
      best = { place, distance };
    }
  }

  return best?.place ?? null;
}

/** Maps an Overpass `out tags center` payload into named places. */
export function namedPlacesFromOverpass(payload: unknown): NearbyNamedPlace[] {
  const elements = (payload as { elements?: unknown } | null)?.elements;
  if (!Array.isArray(elements)) {
    return [];
  }

  const places: NearbyNamedPlace[] = [];
  for (const raw of elements) {
    const place = namedPlaceFromOverpassElement(raw);
    if (place) {
      places.push(place);
    }
  }
  return places;
}

function namedPlaceFromOverpassElement(raw: unknown): NearbyNamedPlace | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }
  const element = raw as {
    lat?: number;
    lon?: number;
    center?: { lat?: number; lon?: number };
    tags?: Record<string, string>;
  };
  const tags = element.tags ?? {};
  if (tags.highway && !tags.building) {
    return null;
  }
  if (tags.shop) {
    return null;
  }

  const name =
    trimText(tags['name:en']) ??
    trimText(tags.name) ??
    trimText(tags['addr:housename']);
  if (!name || isNumericHouseLabel(name) || isKhmerHeavy(name)) {
    return null;
  }

  const latitude = Number(element.lat ?? element.center?.lat);
  const longitude = Number(element.lon ?? element.center?.lon);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }

  const type = (
    tags.tourism ??
    tags.amenity ??
    (tags.building && tags.building !== 'yes' ? tags.building : 'building')
  ).toLowerCase();

  return { name, latitude, longitude, type };
}

function isNumericHouseLabel(value: string): boolean {
  return /^\d+[A-Za-z]?$/.test(value.trim());
}

function isCloseEnough(
  result: ReverseGeocodeResult,
  latitude: number,
  longitude: number,
  maxMeters: number,
): boolean {
  const placeLat = Number(result.lat);
  const placeLon = Number(result.lon);
  if (!Number.isFinite(placeLat) || !Number.isFinite(placeLon)) {
    return true;
  }
  return (
    planarDistanceMeters(latitude, longitude, placeLat, placeLon) <= maxMeters
  );
}

function planarDistanceMeters(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number,
): number {
  const north = (toLat - fromLat) * 111_320;
  const east =
    (toLng - fromLng) * 111_320 * Math.cos((fromLat * Math.PI) / 180);
  return Math.hypot(north, east);
}

function areaParts(address: ReverseGeocodeAddress): string[] {
  return uniqueNonEmpty([
    usableAreaName(address.hamlet),
    usableAreaName(address.suburb),
    usableAreaName(address.village),
    usableAreaName(address.neighbourhood),
    usableAreaName(address.quarter),
    usableAreaName(address.city_district),
  ]).slice(0, 2);
}

function usableAreaName(value: string | undefined): string | null {
  const trimmed = trimText(value);
  if (!trimmed || isKhmerHeavy(trimmed)) {
    return null;
  }
  return trimmed;
}

function isKhmerHeavy(value: string): boolean {
  const compact = value.replace(/\s+/g, '');
  if (!compact) {
    return false;
  }
  const khmer = compact.match(/\p{Script=Khmer}/gu)?.length ?? 0;
  return khmer > 0 && khmer >= compact.length / 2;
}

function firstValue(
  address: ReverseGeocodeAddress,
  keys: (keyof ReverseGeocodeAddress)[],
): string | null {
  for (const key of keys) {
    const value = trimText(address[key]);
    if (value) {
      return value;
    }
  }
  return null;
}

function uniqueNonEmpty(values: Array<string | null>): string[] {
  const seen = new Set<string>();
  const parts: string[] = [];
  for (const value of values) {
    if (!value) {
      continue;
    }
    const key = value.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    parts.push(value);
  }
  return parts;
}

function shortenDisplayName(displayName: string | undefined): string | null {
  const trimmed = trimText(displayName);
  if (!trimmed) {
    return null;
  }
  const pieces = trimmed
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 4);
  return joinLabel(pieces);
}

function joinLabel(parts: string[]): string {
  const label = parts.join(', ');
  if (label.length <= 160) {
    return label;
  }
  return `${label.slice(0, 157).trimEnd()}…`;
}

function trimText(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}
