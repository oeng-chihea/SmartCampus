import { AttendanceRecord } from '../../models/attendance.model';
import { LocationVisit } from '../../models/location.model';
import { formatCampusLocationLabel, formatDistanceMeters } from './format.util';
import { CampusVoiceAttendanceSummary } from '../../models/voice-live.model';

export const VOICE_RECORD_DETAIL_HINT =
  'You can also read every live record in detail: names, buildings, rooms, distances, dues, and login access.';

export function summarizeAttendanceRecords(
  records: AttendanceRecord[],
): CampusVoiceAttendanceSummary {
  return {
    total: records.length,
    present: records.filter((row) => row.attendanceStatus === 'Present').length,
    absent: records.filter((row) => row.attendanceStatus === 'Absent').length,
    inside: records.filter((row) => row.status === 'Present').length,
    outside: records.filter((row) => row.status === 'Outside Location').length,
  };
}

export function formatAttendanceVoiceSummary(
  summary: CampusVoiceAttendanceSummary,
  source: 'visible' | 'all' = 'visible',
): string {
  const lead =
    source === 'all'
      ? 'Every attendance record'
      : `${summary.total} attendance records visible`;
  return `${lead}: ${summary.present} present, ${summary.absent} absent, ${summary.inside} inside the location, ${summary.outside} outside the location.`;
}

export function formatLocationVoiceSummary(visits: LocationVisit[]): string {
  const inside = visits.filter((row) => row.status === 'Present').length;
  const outside = visits.filter((row) => row.status === 'Outside Location').length;
  return `${visits.length} location visits visible: ${inside} inside, ${outside} outside.`;
}

export function formatAttendanceRecordVoiceDetail(row: AttendanceRecord): string {
  const distance = formatDistanceMeters(row.distanceMeters);
  const place = row.scannedLocation?.trim() || 'unspecified place';
  return [
    row.student,
    row.studentId,
    row.session,
    row.location,
    row.attendanceStatus,
    row.status,
    distance === '—' ? 'no distance' : distance,
    `scanned at ${place}`,
  ].join(', ');
}

export function formatLocationVisitVoiceDetail(row: LocationVisit): string {
  const distance = formatDistanceMeters(row.distanceMeters);
  const place = formatCampusLocationLabel(row.building, row.room);
  return [
    row.student,
    row.studentId,
    row.session,
    place,
    row.building,
    row.status,
    distance === '—' ? 'no distance' : distance,
    row.scannedLocation ? `scanned at ${row.scannedLocation}` : '',
  ]
    .filter(Boolean)
    .join(', ');
}
