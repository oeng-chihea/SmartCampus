import { AttendanceRecordEntity } from './attendance-record.entity';
import { LocationEntity } from './location.entity';
import { PasswordResetTokenEntity } from './password-reset-token.entity';
import { SessionEntity } from './session.entity';
import { StudentEntity } from './student.entity';
import { UserEntity } from './user.entity';

export const ALL_ENTITIES = [
  UserEntity,
  StudentEntity,
  LocationEntity,
  SessionEntity,
  AttendanceRecordEntity,
  PasswordResetTokenEntity,
] as const;

export {
  AttendanceRecordEntity,
  LocationEntity,
  PasswordResetTokenEntity,
  SessionEntity,
  StudentEntity,
  UserEntity,
};
