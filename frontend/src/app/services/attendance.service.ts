import attendanceRecordsMock from '../../assets/mock-data/attendance-records.json';
import {
  AdminAttendancePage,
  AttendanceFilterState,
  AttendanceRecord,
  AttendanceStatus,
} from '../models/attendance.model';
import { StatCard } from '../shared/components/stat-card/stat-card.model';

interface AttendanceRecordsFile {
  records: AttendanceRecord[];
}

const mock = attendanceRecordsMock as AttendanceRecordsFile;

const DEFAULT_FILTERS: AttendanceFilterState = {
  search: '',
  session: 'All sessions',
  status: 'All statuses',
  date: 'All dates',
};

export class AttendanceService {
  getAdminAttendancePage(): AdminAttendancePage {
    const records = mock.records;
    return {
      title: 'Attendance records',
      subtitle:
        'Review student scans with identity, exact timestamps, location checks, and attendance status.',
      metrics: this.buildMetrics(records),
      filters: {
        searchPlaceholder: 'Search student name or ID',
        sessionOptions: ['All sessions', ...unique(records.map((row) => row.session))],
        statusOptions: ['All statuses', 'Present', 'Late', 'Absent', 'Outside Location'],
        dateOptions: ['All dates', 'Today', 'Yesterday', 'This week'],
      },
      records,
    };
  }

  filterRecords(
    records: AttendanceRecord[],
    filters: Partial<AttendanceFilterState> = {},
  ): AttendanceRecord[] {
    const state = { ...DEFAULT_FILTERS, ...filters };
    const query = state.search.trim().toLowerCase();

    return records.filter((row) => {
      const matchesSearch =
        !query ||
        row.student.toLowerCase().includes(query) ||
        row.studentId.toLowerCase().includes(query);

      const matchesSession =
        state.session === 'All sessions' || row.session === state.session;

      const matchesStatus =
        state.status === 'All statuses' || row.status === state.status;

      const matchesDate = this.matchesDateFilter(row, state.date);

      return matchesSearch && matchesSession && matchesStatus && matchesDate;
    });
  }

  private buildMetrics(records: AttendanceRecord[]): StatCard[] {
    const count = (status: AttendanceStatus) =>
      records.filter((row) => row.status === status).length;

    return [
      {
        label: 'Present',
        value: String(count('Present')),
        helper: 'Valid scans inside zone',
        icon: 'present',
        tone: 'green',
      },
      {
        label: 'Late',
        value: String(count('Late')),
        helper: 'After late threshold',
        icon: 'late',
        tone: 'amber',
      },
      {
        label: 'Absent',
        value: String(count('Absent')),
        helper: 'No successful check-in',
        icon: 'attendance',
        tone: 'violet',
      },
      {
        label: 'Outside location',
        value: String(count('Outside Location')),
        helper: 'Failed geofence check',
        icon: 'locations',
        tone: 'blue',
      },
    ];
  }

  private matchesDateFilter(row: AttendanceRecord, date: string): boolean {
    if (date === 'All dates') {
      return true;
    }
    if (date === 'Today') {
      return row.submittedAt.toLowerCase().startsWith('today');
    }
    if (date === 'Yesterday') {
      return row.submittedAt.toLowerCase().startsWith('yesterday');
    }
    if (date === 'This week') {
      return (
        row.submittedAt.toLowerCase().startsWith('today') ||
        row.submittedAt.toLowerCase().startsWith('yesterday') ||
        row.submittedAt.toLowerCase().includes('mon')
      );
    }
    return true;
  }
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}
