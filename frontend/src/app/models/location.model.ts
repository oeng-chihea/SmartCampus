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

export interface LocationFilters {
  searchPlaceholder: string;
  buildingOptions: string[];
  statusOptions: string[];
}

/** Current filter form state applied to the directory. */
export interface LocationFilterState {
  search: string;
  building: string;
  status: string;
}

export interface LocationManagement {
  title: string;
  subtitle: string;
  metrics: StatCard[];
  filters: LocationFilters;
  locations: CampusLocation[];
}

/** Person recorded inside (or against) a campus zone — used by location detail dialog. */
export interface LocationPersonPresence {
  name: string;
  studentId: string;
  email: string | null;
  course: string | null;
  year: string | null;
  session: string;
  status: string;
  submittedAt: string;
  distanceMeters: number | null;
  /** Area label for where they were located (zone name / building + room). */
  locationArea: string;
}

/** Full detail payload for the location detail dialog. */
export interface LocationDetail {
  location: CampusLocation;
  people: LocationPersonPresence[];
}
