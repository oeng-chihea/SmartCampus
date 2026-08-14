import { AttendanceStatus } from './attendance.model';
import { SelectOption } from '../shared/components/select-dropdown/select-dropdown.model';
import { StatCard } from '../shared/components/stat-card/stat-card.model';

export type LocationStatus = 'Active' | 'Inactive';

/** Approved campus zone used for attendance geofence checks. */
export interface CampusLocation {
  id: string;
  name: string;
  building: string;
  room: string;
  radiusMeters: number;
  latitude: number;
  longitude: number;
  status: LocationStatus;
  sessionsUsing: number;
}

/** UI-only option lists the Locations toolbar renders — never sent to the API. */
export interface LocationFilters {
  searchPlaceholder: string;
  buildingOptions: SelectOption[];
  statusOptions: SelectOption[];
}

/** Current filter form state applied to the visit log. */
export interface LocationFilterState {
  search: string;
  building: string;
  status: string;
}

/** POST /locations/visits body — omitted fields mean no restriction. */
export interface LocationVisitFilterRequest {
  search?: string;
  building?: string;
  status?: AttendanceStatus;
}

/** One student QR / Mark present visit at a campus zone. */
export interface LocationVisit {
  id: string;
  student: string;
  studentId: string;
  locationId: string;
  locationName: string;
  building: string;
  room: string;
  session: string;
  sessionId: string;
  status: AttendanceStatus;
  recordedAt: string;
  distanceMeters: number | null;
  /** Student device GPS at scan / mark-present. Null on older rows. */
  latitude: number | null;
  longitude: number | null;
  /** Reverse-geocoded place name of the student's scan point. */
  scannedLocation: string | null;
}

export interface LocationVisitMetrics {
  total: number;
  present: number;
  outsideLocation: number;
}

/** Real response of POST /locations/visits. */
export interface LocationVisitPage {
  visits: LocationVisit[];
  metrics: LocationVisitMetrics;
  buildingOptions: string[];
  statusOptions: AttendanceStatus[];
}

export interface LocationManagement {
  title: string;
  subtitle: string;
  metrics: StatCard[];
  filters: LocationFilters;
  locations: CampusLocation[];
}

