import {
  Column,
  Entity,
  Index,
  PrimaryColumn,
  Unique,
} from 'typeorm';

@Entity('attendance_records')
@Unique('UQ_attendance_student_session', ['studentId', 'sessionId'])
@Index('IDX_attendance_user', ['userId'])
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

  /** Present | Late | Absent | Outside Location */
  @Column({ type: 'varchar', length: 32 })
  status!: string;

  @Column({ name: 'distance_meters', type: 'double', nullable: true })
  distanceMeters!: number | null;
}
