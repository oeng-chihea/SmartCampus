import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { API_ENDPOINTS } from '../core/constants/api-endpoints';
import { unreachableApiMessage } from '../core/utils/http-error.util';
import {
  downloadBlob,
  filenameFromContentDisposition,
} from '../core/utils/download.util';
import {
  CampusLocation,
  LocationFilterState,
  LocationVisitFilterRequest,
  LocationVisitPage,
} from '../models/location.model';
import { AuthService } from './auth.service';

const DEFAULT_FILTERS: LocationFilterState = {
  search: '',
  building: 'All buildings',
  status: 'All statuses',
};

/**
 * Live Nest campus zones (session picker / geofence) and the Locations
 * page student visit log.
 */
@Injectable({ providedIn: 'root' })
export class LocationService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);

  /** Full zone catalog — used by Sessions create, not the Locations page. */
  listLocations(): Promise<CampusLocation[]> {
    return firstValueFrom(
      this.http.get<CampusLocation[]>(this.url(API_ENDPOINTS.locations), {
        headers: this.authHeaders(),
      }),
    );
  }

  /**
   * Student visits recorded when a student scans a QR or marks present.
   * Search / building / status are applied on the server.
   */
  queryVisits(
    filters: Partial<LocationFilterState> = {},
  ): Promise<LocationVisitPage> {
    const state = { ...DEFAULT_FILTERS, ...filters };
    return firstValueFrom(
      this.http.post<LocationVisitPage>(
        this.url(API_ENDPOINTS.locationVisits),
        this.toFilterRequest(state),
        { headers: this.authHeaders() },
      ),
    );
  }

  /** Download the current visit filters as an .xlsx from POST /locations/visits/excel. */
  async exportVisitsExcel(
    filters: Partial<LocationFilterState> = {},
  ): Promise<void> {
    const state = { ...DEFAULT_FILTERS, ...filters };
    const response = await firstValueFrom(
      this.http.post(this.url(API_ENDPOINTS.locationVisitsExcel), this.toFilterRequest(state), {
        headers: this.authHeaders(),
        responseType: 'blob',
        observe: 'response',
      }),
    );
    if (!response.body) {
      throw new Error('The Excel export was empty.');
    }
    downloadBlob(
      response.body,
      filenameFromContentDisposition(
        response.headers.get('Content-Disposition'),
        'location-visits.xlsx',
      ),
    );
  }

  mapError(error: unknown, fallback: string): string {
    if (error instanceof HttpErrorResponse) {
      if (error.status === 0) {
        return unreachableApiMessage();
      }
      if (error.status === 401) {
        return 'Session expired. Sign out and sign in again.';
      }
      const body = error.error as { message?: string | string[] } | null;
      if (typeof body?.message === 'string') {
        return body.message;
      }
      if (Array.isArray(body?.message)) {
        return body.message.join(', ');
      }
    }
    return fallback;
  }

  /** Drop UI “All …” / empty values so the payload only carries real filters. */
  private toFilterRequest(
    state: LocationFilterState,
  ): LocationVisitFilterRequest {
    const request: LocationVisitFilterRequest = {};

    if (state.search.trim()) {
      request.search = state.search.trim();
    }
    if (state.building !== 'All buildings') {
      request.building = state.building;
    }
    if (state.status !== 'All statuses') {
      request.status = state.status as LocationVisitFilterRequest['status'];
    }

    return request;
  }

  private url(path: string): string {
    return `${environment.apiBaseUrl}${path}`;
  }

  private authHeaders(): HttpHeaders {
    const token = this.auth.getAccessToken();
    if (!token) {
      return new HttpHeaders();
    }
    return new HttpHeaders({ Authorization: `Bearer ${token}` });
  }
}
