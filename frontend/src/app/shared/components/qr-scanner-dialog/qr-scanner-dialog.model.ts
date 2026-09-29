import { GeolocationFailureReason } from '../../../core/utils/geolocation.util';
import { AttendanceRecord } from '../../../models/attendance.model';

export type QrScannerViewState =
  | 'scanning'
  | 'submitting'
  | 'success'
  | 'location-blocked'
  | 'error';

export type ScanSubmitResult =
  | {
      status: 'success';
      sessionTitle: string;
      attendanceStatus: string;
      record?: AttendanceRecord | null;
      message?: string;
    }
  | {
      status: 'location-blocked';
      sessionTitle: string;
      reason: GeolocationFailureReason;
      message: string;
    }
  | {
      status: 'due-blocked';
      sessionTitle: string;
      dueAt?: string | null;
      message: string;
    }
  | {
      status: 'invalid-qr';
      message: string;
    }
  | {
      status: 'error';
      message: string;
    };
