import attendanceRecordsMock from '../../assets/mock-data/attendance-records.json';
import locationsMock from '../../assets/mock-data/locations.json';
import studentsMock from '../../assets/mock-data/students.json';
import { AttendanceRecord } from '../models/attendance.model';
import {
  CampusLocation,
  LocationDetail,
  LocationFilterState,
  LocationFilters,
  LocationManagement,
  LocationPersonPresence,
} from '../models/location.model';
import { Student } from '../models/student.model';
import { StatCard } from '../shared/components/stat-card/stat-card.model';

interface LocationsMockFile {
  title: string;
  subtitle: string;
  filters: LocationFilters;
  locations: CampusLocation[];
}

interface AttendanceRecordsFile {
  records: AttendanceRecord[];
}

interface StudentsMockFile {
  students: Student[];
}

const mock = locationsMock as LocationsMockFile;
const attendanceMock = attendanceRecordsMock as AttendanceRecordsFile;
const studentsFile = studentsMock as StudentsMockFile;

export class LocationService {
  getLocationManagement(): LocationManagement {
    const locations = mock.locations;

    return {
      title: mock.title,
      subtitle: mock.subtitle,
      metrics: this.buildMetrics(locations),
      filters: mock.filters,
      locations,
    };
  }

  filterLocations(locations: CampusLocation[], filters: LocationFilterState): CampusLocation[] {
    const search = filters.search.trim().toLowerCase();
    const building = filters.building;
    const status = filters.status;

    return locations.filter((location) => {
      const matchesSearch =
        !search ||
        location.name.toLowerCase().includes(search) ||
        location.id.toLowerCase().includes(search) ||
        location.room.toLowerCase().includes(search) ||
        location.building.toLowerCase().includes(search);

      const matchesBuilding =
        building === 'All buildings' || location.building === building;

      const matchesStatus = status === 'All statuses' || location.status === status;

      return matchesSearch && matchesBuilding && matchesStatus;
    });
  }

  /** Build detail view for a zone: zone profile + people located in that area. */
  getLocationDetail(location: CampusLocation): LocationDetail {
    const studentsById = new Map(
      studentsFile.students.map((student) => [student.studentId, student] as const),
    );

    const people: LocationPersonPresence[] = attendanceMock.records
      .filter((record) => record.location === location.name)
      .map((record) => this.toPersonPresence(record, studentsById.get(record.studentId) ?? null))
      .sort((a, b) => a.name.localeCompare(b.name));

    return { location, people };
  }

  private toPersonPresence(
    record: AttendanceRecord,
    student: Student | null,
  ): LocationPersonPresence {
    return {
      name: record.student,
      studentId: record.studentId,
      email: student?.email ?? null,
      course: student?.course ?? null,
      year: student?.year ?? null,
      session: record.session,
      status: record.status,
      submittedAt: record.submittedAt,
      distanceMeters: record.distanceMeters,
      locationArea: record.location,
    };
  }

  private buildMetrics(locations: CampusLocation[]): StatCard[] {
    const total = locations.length;
    const active = locations.filter((location) => location.status === 'Active').length;
    const inUse = locations.filter((location) => location.sessionsUsing > 0).length;

    return [
      {
        label: 'Total locations',
        value: String(total),
        helper: 'Approved campus geofence zones',
        icon: 'locations',
        tone: 'green',
      },
      {
        label: 'Active zones',
        value: String(active),
        helper: 'Ready for attendance checks',
        icon: 'attendance',
        tone: 'blue',
      },
      {
        label: 'In use',
        value: String(inUse),
        helper: 'Linked to one or more sessions',
        icon: 'sessions',
        tone: 'violet',
      },
    ];
  }
}
