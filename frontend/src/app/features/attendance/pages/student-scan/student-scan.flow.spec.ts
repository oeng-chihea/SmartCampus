import '@angular/compiler';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Injector, runInInjectionContext } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from '../../../../services/auth.service';
import { DeviceCoordinates } from '../../../../core/utils/geolocation.util';
import { StudentAttendanceService } from '../../../../services/student-attendance.service';
import { AttendanceRecord } from '../../../../models/attendance.model';
import { OpenLiveSessionCard } from '../../../../models/session.model';
import { StudentScanPageState } from './student-scan.state';
import { locationBlockedMessage, StudentScanPageFlow } from './student-scan.flow';

const flowSource = readFileSync(join(__dirname, 'student-scan.flow.ts'), 'utf8');

const { qrToDataUrlMock } = vi.hoisted(() => ({
  qrToDataUrlMock: vi.fn(),
}));

vi.mock('qrcode', () => ({
  toDataURL: qrToDataUrlMock,
}));

/**
 * Angular's unit-test runner cannot `vi.mock` relative modules, so GPS is faked at the
 * browser boundary instead: the real geolocation util runs against this stub.
 */
const geolocation = {
  getCurrentPosition: vi.fn(),
  watchPosition: vi.fn(),
  clearWatch: vi.fn(),
};

/** Next `getCurrentPosition` call succeeds with a fix at the given coordinates. */
function gpsReturns(coords: { latitude: number; longitude: number; accuracyMeters: number }): void {
  geolocation.getCurrentPosition.mockImplementation((success: PositionCallback) =>
    success({
      coords: {
        latitude: coords.latitude,
        longitude: coords.longitude,
        accuracy: coords.accuracyMeters,
      },
      timestamp: Date.now(),
    } as GeolocationPosition),
  );
}

/** Next `getCurrentPosition` call fails; code 1 is the browser's "permission denied". */
function gpsFails(code: 1 | 2 | 3): void {
  geolocation.getCurrentPosition.mockImplementation(
    (_success: PositionCallback, error?: PositionErrorCallback) =>
      error?.({ code } as GeolocationPositionError),
  );
}

function session(): OpenLiveSessionCard {
  return {
    id: 'sess-fresh-location',
    title: 'AI training',
    locationId: 'LOC-001',
    locationName: 'Building A, Room 201',
    latitude: 11.5479313,
    longitude: 104.9405941,
    radiusMeters: 200,
    teacherName: 'Teacher',
    dueAt: new Date(Date.now() + 60_000).toISOString(),
    openedAt: new Date().toISOString(),
    qr: {
      sessionId: 'sess-fresh-location',
      token: 'token-123456',
      issuedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      ttlSeconds: 60,
      payload: 'SMARTCAMPUS|sess-fresh-location|token-123456',
    },
    qrDataUrl: 'data:image/png;base64,raw-qr',
  };
}

function record(): AttendanceRecord {
  return {
    id: 'att-fresh-location',
    student: 'Kim',
    studentId: '2004',
    sessionId: 'sess-fresh-location',
    session: 'AI training',
    location: 'Building A, Room 201',
    recordedAt: new Date().toISOString(),
    submittedAt: new Date().toISOString(),
    status: 'Outside Location',
    attendanceStatus: 'Present',
    distanceMeters: 2_834,
    latitude: 11.528,
    longitude: 104.923,
    scannedLocation: 'Street 430',
    accuracyMeters: 12,
  };
}

function flowWith(
  state: StudentScanPageState,
  attendance: Partial<StudentAttendanceService>,
): StudentScanPageFlow {
  const injector = Injector.create({
    providers: [
      { provide: StudentScanPageState, useValue: state },
      { provide: StudentAttendanceService, useValue: attendance },
      { provide: AuthService, useValue: {} },
      {
        provide: ActivatedRoute,
        useValue: { snapshot: { queryParamMap: { get: () => null } } },
      },
      { provide: Router, useValue: {} },
    ],
  });
  return runInInjectionContext(injector, () => new StudentScanPageFlow());
}

describe('StudentScanPageFlow GPS submission', () => {
  afterEach(() => {
    qrToDataUrlMock.mockReset();
    geolocation.getCurrentPosition.mockReset();
    geolocation.watchPosition.mockReset();
    geolocation.clearWatch.mockReset();
    Reflect.deleteProperty(globalThis.navigator, 'geolocation');
  });

  beforeEach(() => {
    qrToDataUrlMock.mockResolvedValue('data:image/png;base64,raw-qr');
    geolocation.watchPosition.mockReturnValue(1);
    Object.defineProperty(globalThis.navigator, 'geolocation', {
      configurable: true,
      value: geolocation,
    });
  });

  it('renders and reuses a QR image for the raw attendance payload', async () => {
    const liveSession = session();
    const state = new StudentScanPageState();
    const listOpenSessions = vi.fn().mockResolvedValue([liveSession]);
    const listMine = vi.fn().mockResolvedValue([]);
    const flow = flowWith(state, { listOpenSessions, listMine });

    await flow.reload();
    await flow.reload();

    expect(listOpenSessions).toHaveBeenCalledTimes(2);
    expect(state.openSessions()[0]).toEqual(liveSession);
    expect(qrToDataUrlMock).toHaveBeenCalledTimes(1);
    expect(qrToDataUrlMock).toHaveBeenCalledWith(
      liveSession.qr.payload,
      expect.objectContaining({ width: 220 }),
    );
    flow.destroy();
  });

  it('pauses background polling while the page is hidden and refreshes on return', async () => {
    vi.useFakeTimers();
    const visibility = { value: 'hidden' as DocumentVisibilityState };
    const addEventListener = vi.fn();
    const removeEventListener = vi.fn();
    vi.stubGlobal('document', {
      get visibilityState() {
        return visibility.value;
      },
      addEventListener,
      removeEventListener,
    });

    const state = new StudentScanPageState();
    const listOpenSessions = vi.fn().mockResolvedValue([]);
    const listMine = vi.fn().mockResolvedValue([]);
    const flow = flowWith(state, { listOpenSessions, listMine });

    try {
      await flow.init();
      expect(listOpenSessions).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(12_000);
      expect(listOpenSessions).toHaveBeenCalledTimes(1);

      visibility.value = 'visible';
      const visibilityHandler = addEventListener.mock.calls[0]?.[1] as (() => void) | undefined;
      visibilityHandler?.();
      await Promise.resolve();
      expect(listOpenSessions).toHaveBeenCalledTimes(2);
    } finally {
      flow.destroy();
      vi.unstubAllGlobals();
      vi.useRealTimers();
    }

    expect(removeEventListener).toHaveBeenCalledTimes(1);
  });

  it('does not submit attendance during page initialization', async () => {
    const state = new StudentScanPageState();
    const submit = vi.fn().mockResolvedValue(record());
    const attendance = {
      listOpenSessions: vi.fn().mockResolvedValue([]),
      listMine: vi.fn().mockResolvedValue([]),
      submit,
      isConflict: vi.fn().mockReturnValue(false),
      isQrRejected: vi.fn().mockReturnValue(false),
      mapError: vi.fn().mockReturnValue('Could not mark attendance.'),
    };
    const flow = flowWith(state, attendance);

    gpsReturns({ latitude: 11.52797, longitude: 104.922978, accuracyMeters: 10 });

    try {
      await flow.init();
    } finally {
      flow.destroy();
    }

    expect(submit).not.toHaveBeenCalled();
  });

  it('keeps payload-link handling without creating new deep-link URLs', () => {
    expect(flowSource).toContain('trySubmitDeepLinkPayload');
    expect(flowSource).toContain('submitRawPayload');
    expect(flowSource).toContain("queryParamMap.get('payload')");
    expect(flowSource).not.toContain('buildAttendanceScanUrl');
  });

  it('does not generate Camera deep-link URLs while retaining QR rendering', () => {
    expect(flowSource).not.toContain('buildAttendanceScanUrl');
    expect(flowSource).toContain("from 'qrcode'");
    expect(flowSource).toContain('QRCode.toDataURL(payload');
  });

  it('uses a fresh GPS fix instead of the older preview fix when marking present', async () => {
    const state = new StudentScanPageState();
    const stale: DeviceCoordinates = {
      latitude: 11.528835,
      longitude: 104.923372,
      accuracyMeters: 79,
      timestampMs: Date.now() - 31_000,
    };
    const fresh: DeviceCoordinates = {
      latitude: 11.52797,
      longitude: 104.922978,
      accuracyMeters: 10,
    };
    const submit = vi.fn().mockResolvedValue(record());
    const attendance = { submit };
    const liveSession = session();

    state.setDeviceFix(stale);
    state.setOpenSessions([liveSession]);
    gpsReturns({ ...fresh, accuracyMeters: 10 });

    await flowWith(state, attendance).markPresent(liveSession, { reload: false });

    expect(geolocation.getCurrentPosition).toHaveBeenCalledTimes(1);
    expect(geolocation.getCurrentPosition).toHaveBeenCalledWith(
      expect.any(Function),
      expect.any(Function),
      expect.objectContaining({ timeout: 15_000 }),
    );
    expect(submit).toHaveBeenCalledWith({
      payload: liveSession.qr.payload,
      latitude: fresh.latitude,
      longitude: fresh.longitude,
      accuracyMeters: fresh.accuracyMeters,
    });
    expect(state.deviceFix()).toMatchObject(fresh);
  });

  it('uses a recent live GPS fix without opening a second location request', async () => {
    const recent: DeviceCoordinates = {
      latitude: 11.52797,
      longitude: 104.922978,
      accuracyMeters: 10,
      timestampMs: Date.now() - 5_000,
    };
    const submit = vi.fn().mockResolvedValue(record());
    const attendance = { submit };
    const liveSession = session();

    const state = new StudentScanPageState();
    state.setDeviceFix(recent);
    state.setOpenSessions([liveSession]);

    await flowWith(state, attendance).markPresent(liveSession, { reload: false });

    expect(geolocation.getCurrentPosition).not.toHaveBeenCalled();
    expect(submit).toHaveBeenCalledWith({
      payload: liveSession.qr.payload,
      latitude: recent.latitude,
      longitude: recent.longitude,
      accuracyMeters: recent.accuracyMeters,
    });
  });

  it('uses browser-neutral guidance for every location failure reason', () => {
    expect(locationBlockedMessage('timeout')).toBe(
      'Your location took too long to load. Keep Location Services on, wait a moment, then try again.',
    );
    expect(locationBlockedMessage('unavailable')).toBe(
      'Your browser could not determine your position. Keep Location Services and Wi-Fi on, then try again.',
    );
    expect(locationBlockedMessage('insecure')).not.toContain('Safari');
    expect(locationBlockedMessage('unsupported')).not.toContain('Safari');
    expect(locationBlockedMessage('denied')).not.toContain('Safari');
  });

  it('submits valid scanned QR payload from in-app camera with GPS verification', async () => {
    const state = new StudentScanPageState();
    const live = session();
    const recent: DeviceCoordinates = {
      latitude: 11.52797,
      longitude: 104.922978,
      accuracyMeters: 10,
      timestampMs: Date.now() - 2_000,
    };
    const submit = vi.fn().mockResolvedValue(record());
    const attendance = {
      submit,
      listOpenSessions: vi.fn().mockResolvedValue([live]),
      listMine: vi.fn().mockResolvedValue([]),
      isConflict: vi.fn().mockReturnValue(false),
      isQrRejected: vi.fn().mockReturnValue(false),
      mapError: vi.fn().mockReturnValue('Error'),
    };
    const flow = flowWith(state, attendance);
    state.setDeviceFix(recent);
    state.setOpenSessions([live]);

    const ok = await flow.submitScannedQr(live.qr.payload);

    expect(ok).toBe(true);
    expect(submit).toHaveBeenCalledWith({
      payload: live.qr.payload,
      latitude: recent.latitude,
      longitude: recent.longitude,
      accuracyMeters: recent.accuracyMeters,
    });
    expect(state.success()).toContain('You’re marked Present');
  });

  it('rejects invalid QR payload scanned from camera and surfaces error', async () => {
    const state = new StudentScanPageState();
    const submit = vi.fn();
    const attendance = { submit };
    const flow = flowWith(state, attendance);

    const ok = await flow.submitScannedQr('https://some-random-site.com');

    expect(ok).toBe(false);
    expect(submit).not.toHaveBeenCalled();
    expect(state.error()).toContain('That QR is not a valid Smart Campus attendance code');
  });

  it('processScannedQr returns success result with session title and marked as present status', async () => {
    const state = new StudentScanPageState();
    const live = session();
    const recent: DeviceCoordinates = {
      latitude: 11.52797,
      longitude: 104.922978,
      accuracyMeters: 10,
      timestampMs: Date.now() - 2_000,
    };
    const submit = vi.fn().mockResolvedValue(record());
    const attendance = {
      submit,
      listOpenSessions: vi.fn().mockResolvedValue([live]),
      listMine: vi.fn().mockResolvedValue([]),
      isConflict: vi.fn().mockReturnValue(false),
      isQrRejected: vi.fn().mockReturnValue(false),
      mapError: vi.fn().mockReturnValue('Error'),
    };
    const flow = flowWith(state, attendance);
    state.setDeviceFix(recent);
    state.setOpenSessions([live]);

    const result = await flow.processScannedQr(live.qr.payload);

    expect(result.status).toBe('success');
    if (result.status === 'success') {
      expect(result.sessionTitle).toBe('AI training');
      expect(result.attendanceStatus).toBe('Present');
    }
  });

  it('processScannedQr returns location-blocked when device geolocation fails', async () => {
    const state = new StudentScanPageState();
    const live = session();
    gpsFails(1);
    const submit = vi.fn();
    const attendance = { submit };
    const flow = flowWith(state, attendance);
    state.setOpenSessions([live]);

    const result = await flow.processScannedQr(live.qr.payload);

    expect(result.status).toBe('location-blocked');
    if (result.status === 'location-blocked') {
      expect(result.reason).toBe('denied');
      expect(result.sessionTitle).toBe('AI training');
      expect(result.message).toContain('Location access is required');
    }
  });

  it('does not replace a rejected scanned token with the current session token', async () => {
    const state = new StudentScanPageState();
    const live = session();
    const recent: DeviceCoordinates = {
      latitude: 11.52797,
      longitude: 104.922978,
      accuracyMeters: 10,
      timestampMs: Date.now() - 2_000,
    };
    const forgedPayload = 'SMARTCAMPUS|sess-fresh-location|forged-token';
    const rejected = new Error('QR code is invalid or expired.');
    const submit = vi.fn().mockRejectedValue(rejected);
    const attendance = {
      submit,
      listOpenSessions: vi.fn().mockResolvedValue([live]),
      listMine: vi.fn().mockResolvedValue([]),
      isConflict: vi.fn().mockReturnValue(false),
      isQrRejected: vi.fn().mockReturnValue(true),
      mapError: vi.fn().mockReturnValue('QR code is invalid or expired.'),
    };
    const flow = flowWith(state, attendance);
    state.setDeviceFix(recent);
    state.setOpenSessions([live]);

    const result = await flow.processScannedQr(forgedPayload);

    expect(result).toEqual({
      status: 'error',
      message: 'QR code is invalid or expired.',
    });
    expect(submit).toHaveBeenCalledTimes(1);
    expect(submit).toHaveBeenCalledWith({
      payload: forgedPayload,
      latitude: recent.latitude,
      longitude: recent.longitude,
      accuracyMeters: recent.accuracyMeters,
    });
  });
});
