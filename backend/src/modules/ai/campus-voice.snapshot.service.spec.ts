import { USER_ROLES } from '../../common/constants/roles.constant';
import {
  ATTENDANCE_LOCATION_STATUS,
  ATTENDANCE_STATUS,
} from '../../common/constants/status.constant';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { AttendanceService } from '../attendance/attendance.service';
import { DashboardService } from '../dashboard/dashboard.service';
import { LocationsService } from '../locations/locations.service';
import { SessionsService } from '../sessions/sessions.service';
import { StudentsService } from '../students/students.service';
import { CampusVoiceSnapshotService } from './campus-voice.snapshot.service';

const teacher: AuthenticatedUser = {
  userId: 'u-teacher-1',
  role: USER_ROLES.teacher,
};

const student: AuthenticatedUser = {
  userId: 'u-chihea',
  role: USER_ROLES.student,
};

describe('CampusVoiceSnapshotService', () => {
  const attendance = {
    findAdminRecords: jest.fn(),
    findMine: jest.fn(),
  };
  const locations = {
    findVisits: jest.fn(),
    findAll: jest.fn(),
  };
  const sessions = {
    findAll: jest.fn(),
    listOpenLive: jest.fn(),
  };
  const students = {
    findAll: jest.fn(),
    findByUserId: jest.fn(),
  };
  const dashboard = {
    getAdminDashboard: jest.fn(),
  };

  const service = new CampusVoiceSnapshotService(
    attendance as unknown as AttendanceService,
    locations as unknown as LocationsService,
    sessions as unknown as SessionsService,
    students as unknown as StudentsService,
    dashboard as unknown as DashboardService,
  );

  beforeEach(() => {
    attendance.findAdminRecords.mockReset();
    attendance.findMine.mockReset();
    locations.findVisits.mockReset();
    locations.findAll.mockReset();
    sessions.findAll.mockReset();
    sessions.listOpenLive.mockReset();
    students.findAll.mockReset();
    students.findByUserId.mockReset();
    dashboard.getAdminDashboard.mockReset();

    attendance.findAdminRecords.mockResolvedValue({
      records: [
        {
          student: 'Chihea',
          studentId: 'SC-1001',
          session: 'Morning class',
          sessionId: 'ses-1',
          location: 'Building A-Room 201',
          scannedLocation: 'KIT',
          recordedAt: '2026-08-20T02:00:00.000Z',
          status: ATTENDANCE_LOCATION_STATUS.inside,
          attendanceStatus: ATTENDANCE_STATUS.present,
          distanceMeters: 12,
        },
        {
          student: 'Dara',
          studentId: 'SC-1002',
          session: 'Morning class',
          sessionId: 'ses-1',
          location: 'Building A-Room 201',
          scannedLocation: 'Street 2011',
          recordedAt: '2026-08-20T02:01:00.000Z',
          status: ATTENDANCE_LOCATION_STATUS.outsideLocation,
          attendanceStatus: ATTENDANCE_STATUS.present,
          distanceMeters: 3046,
        },
        {
          student: 'Sophea',
          studentId: 'SC-1003',
          session: 'Morning class',
          sessionId: 'ses-1',
          location: 'Building A-Room 201',
          scannedLocation: null,
          recordedAt: '2026-08-20T04:00:00.000Z',
          status: null,
          attendanceStatus: ATTENDANCE_STATUS.absent,
          distanceMeters: null,
        },
      ],
      metrics: { present: 1, late: 0, absent: 1, outsideLocation: 1 },
      statusOptions: [],
    });
    locations.findVisits.mockResolvedValue({
      visits: [
        {
          student: 'Chihea',
          studentId: 'SC-1001',
          session: 'Morning class',
          locationName: 'Room 201',
          building: 'Building A',
          room: '201',
          scannedLocation: 'KIT',
          recordedAt: '2026-08-20T02:00:00.000Z',
          status: ATTENDANCE_LOCATION_STATUS.inside,
          distanceMeters: 12,
        },
        {
          student: 'Dara',
          studentId: 'SC-1002',
          session: 'Morning class',
          locationName: 'Room 201',
          building: 'Building A',
          room: '201',
          scannedLocation: 'Street 2011',
          recordedAt: '2026-08-20T02:01:00.000Z',
          status: ATTENDANCE_LOCATION_STATUS.outsideLocation,
          distanceMeters: 3046,
        },
      ],
    });
    locations.findAll.mockResolvedValue([
      {
        id: 'LOC-001',
        name: 'Room 201',
        building: 'Building A',
        room: '201',
        radiusMeters: 80,
        status: 'Active',
        sessionsUsing: 1,
      },
    ]);
    sessions.findAll.mockResolvedValue([
      {
        id: 'ses-1',
        title: 'Morning class',
        status: 'Open',
        locationName: 'Building A-Room 201',
        teacherName: 'Teacher Kim',
        openedAt: '2026-08-20T01:00:00.000Z',
        dueAt: '2026-08-20T04:00:00.000Z',
        closedAt: null,
      },
    ]);
    students.findAll.mockResolvedValue([
      {
        studentId: 'SC-1001',
        name: 'Chihea',
        email: 'chihea@smartcampus.edu',
        course: 'SE401',
        year: 'Year 1',
        loginEnabled: true,
        hasAccount: true,
        attendanceRate: 90,
        status: 'Active',
      },
    ]);
    dashboard.getAdminDashboard.mockResolvedValue({
      title: 'SmartCampus',
      subtitle: '',
      summaryCards: [
        {
          label: 'Registered students',
          value: '1',
          helper: 'Authorised student accounts',
          icon: 'students',
          tone: 'blue',
        },
        {
          label: 'Open sessions',
          value: '1',
          helper: 'Active scan codes for classes',
          icon: 'sessions',
          tone: 'violet',
        },
      ],
      monthlyTrend: [
        {
          month: 'Aug',
          presentRate: 80,
          present: 2,
          absent: 0,
          outsideLocation: 1,
        },
      ],
      trendYear: 2026,
      recentScans: [
        {
          id: 's1',
          student: 'Chihea',
          studentId: 'SC-1001',
          session: 'Morning class',
          location: 'Building A-Room 201',
          submittedAt: '2026-08-20T02:00:00.000Z',
          recordedAt: '2026-08-20T02:00:00.000Z',
          status: ATTENDANCE_LOCATION_STATUS.inside,
          distanceMeters: 12,
        },
      ],
    });
  });

  it('reads every record with no filters and reports present, absent, and inside', async () => {
    const snapshot = await service.readCampusRecords(teacher, {});

    expect(attendance.findAdminRecords).toHaveBeenCalledWith({}, teacher);
    expect(locations.findVisits).toHaveBeenCalledWith({}, teacher);
    expect(locations.findAll).toHaveBeenCalled();
    expect(dashboard.getAdminDashboard).toHaveBeenCalledWith(teacher);
    expect(snapshot.filtered).toBe(false);
    expect(snapshot.attendance).toMatchObject({
      total: 3,
      present: 2,
      absent: 1,
      inside: 1,
      outside: 1,
    });
    expect(snapshot.attendance.records[0]).toMatchObject({
      student: 'Chihea',
      location: 'Building A-Room 201',
      distanceMeters: 12,
      scannedLocation: 'KIT',
    });
    expect(snapshot.locations.visits[0]).toMatchObject({
      building: 'Building A',
      room: '201',
      distanceMeters: 12,
    });
    expect(snapshot.locations.zones[0]).toMatchObject({
      building: 'Building A',
      room: '201',
      radiusMeters: 80,
    });
    expect(snapshot.sessions.items[0]).toMatchObject({
      title: 'Morning class',
      dueAt: '2026-08-20T04:00:00.000Z',
      teacherName: 'Teacher Kim',
    });
    expect(snapshot.students.items[0]).toMatchObject({
      name: 'Chihea',
      email: 'chihea@smartcampus.edu',
      course: 'SE401',
      loginEnabled: true,
    });
    expect(snapshot.dashboard.cards[0].label).toBe('Registered students');
    expect(snapshot.spokenSummary).toContain('with no filter applied');
    expect(snapshot.spokenSummary).toContain('2 present');
    expect(snapshot.spokenSummary).toContain('Chihea');
    expect(snapshot.spokenSummary).toContain('12 meters');
    expect(snapshot.spokenSummary).toContain('80 meter radius');
  });

  it('applies attendance filters only when they are requested', async () => {
    attendance.findAdminRecords.mockResolvedValue({
      records: [
        {
          student: 'Chihea',
          studentId: 'SC-1001',
          session: 'Morning class',
          sessionId: 'ses-1',
          location: 'Building A-Room 201',
          scannedLocation: 'KIT',
          recordedAt: '2026-08-20T02:00:00.000Z',
          status: ATTENDANCE_LOCATION_STATUS.inside,
          attendanceStatus: ATTENDANCE_STATUS.present,
          distanceMeters: 12,
        },
      ],
      metrics: { present: 1, late: 0, absent: 0, outsideLocation: 0 },
      statusOptions: [],
    });

    const snapshot = await service.readCampusRecords(teacher, {
      attendance_status: 'Present',
    });

    expect(attendance.findAdminRecords).toHaveBeenCalledWith(
      { attendanceStatus: 'Present' },
      teacher,
    );
    expect(snapshot.filtered).toBe(true);
    expect(snapshot.attendance.total).toBe(1);
    expect(snapshot.spokenSummary).toContain('requested filter');
    expect(snapshot.spokenSummary).toContain('Chihea');
    expect(snapshot.spokenSummary).toContain('12 meters');
  });

  it('returns named record details when the teacher asks about one student', async () => {
    attendance.findAdminRecords.mockResolvedValue({
      records: [
        {
          student: 'Chihea',
          studentId: 'SC-1001',
          session: 'Morning class',
          sessionId: 'ses-1',
          location: 'Building A-Room 201',
          scannedLocation: 'KIT',
          recordedAt: '2026-08-20T02:00:00.000Z',
          status: ATTENDANCE_LOCATION_STATUS.inside,
          attendanceStatus: ATTENDANCE_STATUS.present,
          distanceMeters: 12,
        },
      ],
      metrics: { present: 1, late: 0, absent: 0, outsideLocation: 0 },
      statusOptions: [],
    });
    locations.findVisits.mockResolvedValue({
      visits: [
        {
          student: 'Chihea',
          studentId: 'SC-1001',
          session: 'Morning class',
          locationName: 'Room 201',
          building: 'Building A',
          room: '201',
          scannedLocation: 'KIT',
          recordedAt: '2026-08-20T02:00:00.000Z',
          status: ATTENDANCE_LOCATION_STATUS.inside,
          distanceMeters: 12,
        },
      ],
    });

    const snapshot = await service.readCampusRecords(teacher, {
      query: 'Chihea',
    });

    expect(attendance.findAdminRecords).toHaveBeenCalledWith(
      { search: 'Chihea' },
      teacher,
    );
    expect(locations.findVisits).toHaveBeenCalledWith(
      { search: 'Chihea' },
      teacher,
    );
    expect(snapshot.filtered).toBe(true);
    expect(snapshot.attendance.records).toHaveLength(1);
    expect(snapshot.spokenSummary).toContain('Chihea');
    expect(snapshot.spokenSummary).toContain('Building A-Room 201');
    expect(snapshot.spokenSummary).toContain('12 meters');
    expect(snapshot.spokenSummary).toContain('SE401');
    expect(snapshot.spokenSummary).toContain('login enabled');
  });

  it('reads only the signed-in student open classes and scans', async () => {
    attendance.findMine.mockResolvedValue([
      {
        student: 'Chihea',
        studentId: 'SC-1001',
        session: 'Morning class',
        sessionId: 'ses-1',
        location: 'Building A-Room 201',
        scannedLocation: 'KIT',
        recordedAt: '2026-08-20T02:00:00.000Z',
        status: ATTENDANCE_LOCATION_STATUS.inside,
        attendanceStatus: ATTENDANCE_STATUS.present,
        distanceMeters: 12,
      },
    ]);
    sessions.listOpenLive.mockResolvedValue([
      {
        id: 'ses-1',
        title: 'Morning class',
        locationId: 'LOC-001',
        locationName: 'Building A-Room 201',
        latitude: 11.54,
        longitude: 104.94,
        radiusMeters: 80,
        teacherName: 'Teacher Kim',
        dueAt: '2026-12-20T04:00:00.000Z',
        openedAt: '2026-08-20T01:00:00.000Z',
        qr: {
          sessionId: 'ses-1',
          token: 't',
          issuedAt: '',
          expiresAt: '',
          ttlSeconds: 300,
          payload: 'SMARTCAMPUS|ses-1|t',
        },
      },
      {
        id: 'ses-2',
        title: 'Afternoon lab',
        locationId: 'LOC-001',
        locationName: 'Building A-Room 201',
        latitude: 11.54,
        longitude: 104.94,
        radiusMeters: 80,
        teacherName: 'Teacher Kim',
        dueAt: '2026-12-20T08:00:00.000Z',
        openedAt: '2026-08-20T05:00:00.000Z',
        qr: {
          sessionId: 'ses-2',
          token: 't2',
          issuedAt: '',
          expiresAt: '',
          ttlSeconds: 300,
          payload: 'SMARTCAMPUS|ses-2|t2',
        },
      },
    ]);
    students.findByUserId.mockResolvedValue({
      studentId: 'SC-1001',
      name: 'Chihea',
      email: 'chihea@smartcampus.edu',
      course: 'SE401',
      year: 'Year 1',
      loginEnabled: true,
      hasAccount: true,
      userId: 'u-chihea',
      attendanceRate: 90,
      status: 'Active',
    });

    const snapshot = await service.readCampusRecords(student, {});

    expect(attendance.findMine).toHaveBeenCalledWith(student);
    expect(sessions.listOpenLive).toHaveBeenCalled();
    expect(students.findByUserId).toHaveBeenCalledWith('u-chihea');
    expect(attendance.findAdminRecords).not.toHaveBeenCalled();
    expect(dashboard.getAdminDashboard).not.toHaveBeenCalled();
    expect(students.findAll).not.toHaveBeenCalled();
    expect(locations.findVisits).not.toHaveBeenCalled();
    expect(snapshot.dashboard.cards).toEqual([]);
    expect(snapshot.sessions.items).toHaveLength(2);
    expect(snapshot.sessions.items[0]).toMatchObject({
      title: 'Morning class',
      locationName: 'Building A-Room 201',
      teacherName: 'Teacher Kim',
      recorded: true,
      duePassed: false,
    });
    expect(snapshot.sessions.items[1]).toMatchObject({
      title: 'Afternoon lab',
      recorded: false,
      duePassed: false,
    });
    expect(snapshot.locations.zones[0]).toMatchObject({
      radiusMeters: 80,
    });
    expect(snapshot.attendance.records).toHaveLength(1);
    expect(snapshot.students.items).toHaveLength(1);
    expect(snapshot.spokenSummary).toContain("this student's own live classes");
    expect(snapshot.spokenSummary).toContain('1 already recorded, 1 not yet recorded');
    expect(snapshot.spokenSummary).toContain('Already recorded:');
    expect(snapshot.spokenSummary).toContain('Not yet recorded:');
    expect(snapshot.spokenSummary).toContain('Morning class');
    expect(snapshot.spokenSummary).toContain('Afternoon lab');
    expect(snapshot.spokenSummary).toContain('80 meter radius');
    expect(snapshot.spokenSummary).toContain('Location permission is required');
    expect(snapshot.spokenSummary).not.toContain('Ask for a student name');
  });

  it('still marks a live class recorded when the session search does not match the scan row', async () => {
    attendance.findMine.mockResolvedValue([
      {
        student: 'Chihea',
        studentId: 'SC-1001',
        session: 'Morning class',
        sessionId: 'ses-1',
        location: 'Building A-Room 201',
        scannedLocation: 'KIT',
        recordedAt: '2026-08-20T02:00:00.000Z',
        status: ATTENDANCE_LOCATION_STATUS.inside,
        attendanceStatus: ATTENDANCE_STATUS.present,
        distanceMeters: 12,
      },
    ]);
    sessions.listOpenLive.mockResolvedValue([
      {
        id: 'ses-1',
        title: 'Morning class',
        locationId: 'LOC-001',
        locationName: 'Building A-Room 201',
        latitude: 11.54,
        longitude: 104.94,
        radiusMeters: 80,
        teacherName: 'Teacher Kim',
        dueAt: '2026-12-20T04:00:00.000Z',
        openedAt: '2026-08-20T01:00:00.000Z',
        qr: {
          sessionId: 'ses-1',
          token: 't',
          issuedAt: '',
          expiresAt: '',
          ttlSeconds: 300,
          payload: 'SMARTCAMPUS|ses-1|t',
        },
      },
    ]);
    students.findByUserId.mockResolvedValue({
      studentId: 'SC-1001',
      name: 'Chihea',
      email: 'chihea@smartcampus.edu',
      course: 'SE401',
      year: 'Year 1',
      loginEnabled: true,
      hasAccount: true,
      userId: 'u-chihea',
      attendanceRate: 90,
      status: 'Active',
    });

    const snapshot = await service.readCampusRecords(student, {
      query: 'Teacher Kim',
      scope: 'sessions',
    });

    expect(snapshot.attendance.records).toHaveLength(0);
    expect(snapshot.sessions.items[0]).toMatchObject({
      title: 'Morning class',
      recorded: true,
    });
    expect(snapshot.spokenSummary).toContain('already recorded');
  });
});
