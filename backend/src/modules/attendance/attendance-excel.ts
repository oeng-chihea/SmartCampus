import {
  ExcelFile,
  addDataSheet,
  addSummarySheet,
  createWorkbook,
  excelDateFromIso,
  fileDateStamp,
  workbookToBuffer,
} from '../../common/utils/excel.util';
import { formatCampusLocationLabel } from '../../common/utils/format.util';
import { AdminAttendanceFilterDto } from './dto/admin-attendance-filter.dto';
import { AdminAttendanceResponseDto } from './dto/admin-attendance-response.dto';

function describeFilters(
  filters: AdminAttendanceFilterDto,
): Array<[string, string]> {
  const locationStatus =
    filters.status === 'inside'
      ? 'Inside'
      : filters.status === 'outside'
        ? 'Outside'
        : 'All statuses';
  const date =
    filters.date === 'today'
      ? 'Today'
      : filters.date === 'yesterday'
        ? 'Yesterday'
        : filters.date === 'week'
          ? 'This week'
          : 'All dates';

  return [
    ['Search', filters.search?.trim() || 'All'],
    ['Session', filters.sessionId || 'All sessions'],
    ['Location status', locationStatus],
    ['Attendance status', filters.attendanceStatus || 'All attendance statuses'],
    ['Date', date],
  ];
}

export async function buildAttendanceExcel(
  page: AdminAttendanceResponseDto,
  filters: AdminAttendanceFilterDto,
  now: Date = new Date(),
): Promise<ExcelFile> {
  const workbook = createWorkbook();
  const filename = `attendance-records-${fileDateStamp(now)}.xlsx`;

  addDataSheet(
    workbook,
    'Attendance records',
    [
      { header: 'Student', key: 'student', width: 22 },
      { header: 'Student ID', key: 'studentId', width: 14 },
      { header: 'Session', key: 'session', width: 24 },
      { header: 'Location', key: 'location', width: 22 },
      { header: 'Scanned at', key: 'scannedAt', width: 52, wrap: true },
      { header: 'Latitude', key: 'latitude', width: 14, numFmt: '0.000000' },
      { header: 'Longitude', key: 'longitude', width: 14, numFmt: '0.000000' },
      {
        header: 'Time',
        key: 'time',
        width: 22,
        numFmt: 'mmm d, yyyy h:mm AM/PM',
      },
      { header: 'Distance (m)', key: 'distance', width: 14, numFmt: '0' },
      { header: 'Status', key: 'status', width: 18 },
      { header: 'Attendance status', key: 'attendanceStatus', width: 20 },
    ],
    page.records.map((row) => ({
      student: row.student,
      studentId: row.studentId,
      session: row.session,
      location: formatCampusLocationLabel(row.location),
      scannedAt: row.scannedLocation?.trim() ?? '',
      latitude: row.latitude,
      longitude: row.longitude,
      time: excelDateFromIso(row.recordedAt),
      distance: row.distanceMeters,
      status: row.status,
      attendanceStatus: row.attendanceStatus,
    })),
  );

  addSummarySheet(workbook, [
    {
      title: 'Export',
      rows: [
        ['Generated at', now.toISOString()],
        ['Exported rows', page.records.length],
        ['File', filename],
      ],
    },
    {
      title: 'Filters',
      rows: describeFilters(filters),
    },
    {
      title: 'Counts (matching this export)',
      rows: [
        ['Present', page.metrics.present],
        ['Outside Location', page.metrics.outsideLocation],
        ['Absent', page.metrics.absent],
      ],
    },
  ]);

  return {
    buffer: await workbookToBuffer(workbook),
    filename,
  };
}
