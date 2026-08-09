import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
} from 'typeorm';

@Entity('sessions')
export class SessionEntity {
  @PrimaryColumn({ type: 'varchar', length: 64 })
  id!: string;

  @Column({ type: 'varchar', length: 200 })
  title!: string;

  @Column({ name: 'location_id', type: 'varchar', length: 32 })
  locationId!: string;

  @Column({ name: 'location_name', type: 'varchar', length: 160 })
  locationName!: string;

  @Column({ name: 'teacher_id', type: 'varchar', length: 64 })
  teacherId!: string;

  @Column({ name: 'teacher_name', type: 'varchar', length: 120 })
  teacherName!: string;

  /** Open | Closed */
  @Column({ type: 'varchar', length: 20 })
  status!: string;

  /**
   * When student mark-present / scan stops being accepted.
   * Session may stay Open until the teacher closes it manually.
   * Nullable for rows created before the due-time feature.
   */
  @Column({ name: 'due_at', type: 'datetime', nullable: true })
  dueAt!: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @Column({ name: 'opened_at', type: 'datetime' })
  openedAt!: Date;

  @Column({ name: 'closed_at', type: 'datetime', nullable: true })
  closedAt!: Date | null;

  @Column({ name: 'qr_token', type: 'varchar', length: 64, nullable: true })
  qrToken!: string | null;

  @Column({ name: 'qr_issued_at', type: 'datetime', nullable: true })
  qrIssuedAt!: Date | null;

  @Column({ name: 'qr_expires_at', type: 'datetime', nullable: true })
  qrExpiresAt!: Date | null;
}
