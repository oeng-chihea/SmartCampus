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
  address?: ReverseGeocodeAddress;
}

const PLACE_KEYS: (keyof ReverseGeocodeAddress)[] = [
  'amenity',
  'university',
  'school',
  'building',
  'tourism',
  'leisure',
  'office',
  'shop',
  'residential',
];

const ROAD_KEYS: (keyof ReverseGeocodeAddress)[] = [
  'road',
  'pedestrian',
  'footway',
];

const AREA_KEYS: (keyof ReverseGeocodeAddress)[] = [
  'neighbourhood',
  'suburb',
  'quarter',
  'village',
  'city_district',
];

const CITY_KEYS: (keyof ReverseGeocodeAddress)[] = [
  'city',
  'state',
  'municipality',
  'town',
];

/**
 * Compact human label from a Nominatim reverse result.
 * Prefers place + road + area + city so teachers see where the student stood,
 * not the full 8-part display_name.
 */
export function buildScanLocationLabel(
  result: ReverseGeocodeResult | null | undefined,
): string | null {
  if (!result) {
    return null;
  }

  const address = result.address ?? {};
  const parts = uniqueNonEmpty([
    firstValue(address, PLACE_KEYS) ?? trimText(result.name),
    firstValue(address, ROAD_KEYS),
    ...collectValues(address, AREA_KEYS, 2),
    firstValue(address, CITY_KEYS),
  ]);

  if (parts.length > 0) {
    return joinLabel(parts);
  }

  return shortenDisplayName(result.display_name);
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

function collectValues(
  address: ReverseGeocodeAddress,
  keys: (keyof ReverseGeocodeAddress)[],
  limit: number,
): string[] {
  const values: string[] = [];
  for (const key of keys) {
    const value = trimText(address[key]);
    if (value) {
      values.push(value);
    }
    if (values.length >= limit) {
      break;
    }
  }
  return values;
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
