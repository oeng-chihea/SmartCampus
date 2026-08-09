import { Injectable, inject } from '@angular/core';
import { AttendanceFilterState } from '../../../../models/attendance.model';
import { AttendanceService } from '../../../../services/attendance.service';
import { SessionService } from '../../../../services/session.service';
import { SelectOption } from '../../../../shared/components/select-dropdown/select-dropdown.model';
import { AdminRecordsState } from './admin-records.state';

const ALL_SESSION: SelectOption = { value: 'all', label: 'All sessions' };

/**
 * Admin records page flow only — API calls + orchestration.
 * Reads/writes `AdminRecordsState`; does not own signals itself.
 */
@Injectable()
export class AdminRecordsFlow {
  private readonly state = inject(AdminRecordsState);
  private readonly attendanceService = inject(AttendanceService);
  private readonly sessionService = inject(SessionService);

  /** First load: real sessions for the filter dropdown + all scan records. */
  async load(): Promise<void> {
    this.state.beginLoad();
    try {
      const [sessions, page] = await Promise.all([
        this.sessionService.listSessions(),
        this.attendanceService.fetchAdminRecords(this.state.getFilters()),
      ]);
      this.state.setSessionOptions([
        ALL_SESSION,
        ...sessions.map((session) => ({
          value: session.id,
          label: session.title,
        })),
      ]);
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

  /** Server-side filter apply — records only (session options stay live). */
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
