import { Column, Entity, Index, PrimaryColumn, Unique } from 'typeorm';
import {
  AttendanceLocationStatus,
  AttendanceStatus,
} from '../../common/constants/status.constant';

@Entity('attendance_records')
@Unique('UQ_attendance_student_session', ['studentId', 'sessionId'])
@Index('IDX_attendance_user', ['userId'])
@Index('IDX_attendance_recorded_at', ['recordedAt'])
@Index('IDX_attendance_session_student', ['sessionId', 'studentId'])
export class AttendanceRecordEntity {
  @PrimaryColumn({ type: 'varchar', length: 64 })
  id!: string;

  @Column({ name: 'user_id', type: 'varchar', length: 64 })
  userId!: string;

  @Column({ type: 'varchar', length: 120 })
  student!: string;

  @Column({ name: 'student_id', type: 'varchar', length: 32 })
  studentId!: string;

  @Column({ name: 'session_id', type: 'varchar', length: 64 })
  sessionId!: string;

  @Column({ type: 'varchar', length: 200 })
  session!: string;

  @Column({ type: 'varchar', length: 160 })
  location!: string;

  @Column({ name: 'recorded_at', type: 'datetime' })
  recordedAt!: Date;

  /** Inside | Outside Location. Null when no attendance check-in occurred. */
  @Column({ type: 'varchar', length: 32, nullable: true })
  status!: AttendanceLocationStatus | null;

  /** Present | Absent. Nullable for rows created before the status split. */
  @Column({
    name: 'attendance_status',
    type: 'varchar',
    length: 16,
    nullable: true,
  })
  attendanceStatus!: AttendanceStatus | null;

  @Column({ name: 'distance_meters', type: 'double', nullable: true })
  distanceMeters!: number | null;

  /** Device GPS at submit time. Null on rows saved before this column existed. */
  @Column({ type: 'double', nullable: true })
  latitude!: number | null;

  @Column({ type: 'double', nullable: true })
  longitude!: number | null;

  /** Human place name from reverse geocode of the device GPS. */
  @Column({
    name: 'scanned_location',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  scannedLocation!: string | null;

  /** Browser-reported GPS accuracy in meters. Null on older rows. */
  @Column({ name: 'accuracy_meters', type: 'double', nullable: true })
  accuracyMeters!: number | null;
}
