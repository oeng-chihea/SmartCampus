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
import { LocationVisitFilterDto } from './dto/location-visit-filter.dto';
import { LocationVisitPageResponseDto } from './dto/location-visit-response.dto';

function describeFilters(
  filters: LocationVisitFilterDto,
): Array<[string, string]> {
  return [
    ['Search', filters.search?.trim() || 'All'],
    ['Building', filters.building?.trim() || 'All buildings'],
    ['Status', filters.status || 'All statuses'],
  ];
}

export async function buildLocationVisitsExcel(
  page: LocationVisitPageResponseDto,
  filters: LocationVisitFilterDto,
  now: Date = new Date(),
): Promise<ExcelFile> {
  const workbook = createWorkbook();
  const filename = `location-visits-${fileDateStamp(now)}.xlsx`;

  addDataSheet(
    workbook,
    'Location visits',
    [
      { header: 'Student', key: 'student', width: 22 },
      { header: 'Student ID', key: 'studentId', width: 14 },
      { header: 'Session', key: 'session', width: 24 },
      { header: 'Location', key: 'location', width: 22 },
      { header: 'Building', key: 'building', width: 16 },
      { header: 'Room', key: 'room', width: 12 },
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
    ],
    page.visits.map((row) => ({
      student: row.student,
      studentId: row.studentId,
      session: row.session,
      location: formatCampusLocationLabel(row.building, row.room),
      building: row.building,
      room: row.room,
      scannedAt: row.scannedLocation?.trim() ?? '',
      latitude: row.latitude,
      longitude: row.longitude,
      time: excelDateFromIso(row.recordedAt),
      distance: row.distanceMeters,
      status: row.status,
    })),
  );

  addSummarySheet(workbook, [
    {
      title: 'Export',
      rows: [
        ['Generated at', now.toISOString()],
        ['Exported rows', page.visits.length],
        ['File', filename],
      ],
    },
    {
      title: 'Filters',
      rows: describeFilters(filters),
    },
    {
      title: 'Visit totals (all visits)',
      rows: [
        ['Total visits', page.metrics.total],
        ['Present', page.metrics.present],
        ['Outside Location', page.metrics.outsideLocation],
      ],
    },
  ]);

  return {
    buffer: await workbookToBuffer(workbook),
    filename,
  };
}
