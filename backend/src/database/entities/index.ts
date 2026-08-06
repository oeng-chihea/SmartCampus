import { AttendanceRecordEntity } from './attendance-record.entity';
import { LocationEntity } from './location.entity';
import { SessionEntity } from './session.entity';
import { StudentEntity } from './student.entity';
import { UserEntity } from './user.entity';

export const ALL_ENTITIES = [
  UserEntity,
  StudentEntity,
  LocationEntity,
  SessionEntity,
  AttendanceRecordEntity,
] as const;

export {
  AttendanceRecordEntity,
  LocationEntity,
  SessionEntity,
  StudentEntity,
  UserEntity,
};
