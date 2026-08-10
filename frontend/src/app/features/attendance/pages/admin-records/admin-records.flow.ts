import { Injectable, inject } from '@angular/core';
import { AttendanceFilterState } from '../../../../models/attendance.model';
import { AttendanceService } from '../../../../services/attendance.service';
import { AdminRecordsState } from './admin-records.state';

/**
 * Admin records page flow only — API calls + orchestration.
 * Reads/writes `AdminRecordsState`; does not own signals itself.
 *
 * Session options are no longer preloaded: the session picker modal loads
 * paginated pages (limit 10) on demand via SessionService.
 */
@Injectable()
export class AdminRecordsFlow {
  private readonly state = inject(AdminRecordsState);
  private readonly attendanceService = inject(AttendanceService);

  /** First load: attendance scan records + metrics only. */
  async load(): Promise<void> {
    this.state.beginLoad();
    try {
      const page = await this.attendanceService.fetchAdminRecords(
        this.state.getFilters(),
      );
      this.state.applyResponse(page);
    } catch (error) {
      this.state.setPageError(
        this.attendanceService.mapError(
          error,
          'Failed to load attendance records from the API.',
        ),
      );
    } finally {
      this.state.endLoad();
    }
  }

  /** Server-side filter apply. */
  async applyFilters(filters: AttendanceFilterState): Promise<void> {
    this.state.setFilters(filters);
    await this.fetchRecords();
  }

  private async fetchRecords(): Promise<void> {
    this.state.beginLoad();
    try {
      const page = await this.attendanceService.fetchAdminRecords(
        this.state.getFilters(),
      );
      this.state.applyResponse(page);
    } catch (error) {
      this.state.setPageError(
        this.attendanceService.mapError(
          error,
          'Could not filter attendance records. Try again.',
        ),
      );
    } finally {
      this.state.endLoad();
    }
  }
}
