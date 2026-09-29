import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

@Entity('students')
@Index('IDX_students_name', ['name'])
@Index('IDX_students_email', ['email'])
@Index('IDX_students_status', ['status'])
@Index('IDX_students_course_status', ['course', 'status'])
export class StudentEntity {
  @PrimaryColumn({ name: 'student_id', type: 'varchar', length: 32 })
  studentId!: string;

  @Column({ type: 'varchar', length: 120 })
  name!: string;

  @Column({ type: 'varchar', length: 180 })
  email!: string;

  @Column({ type: 'varchar', length: 40 })
  course!: string;

  @Column({ type: 'varchar', length: 40 })
  year!: string;

  @Column({ name: 'attendance_rate', type: 'int', default: 0 })
  attendanceRate!: number;

  /** Active | Review | Inactive */
  @Column({ type: 'varchar', length: 20, default: 'Active' })
  status!: string;

  @Column({ name: 'login_enabled', type: 'boolean', default: true })
  loginEnabled!: boolean;

  /** Optional link to users.id for login accounts. */
  @Column({ name: 'user_id', type: 'varchar', length: 64, nullable: true })
  userId!: string | null;
}
