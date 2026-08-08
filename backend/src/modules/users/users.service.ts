import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomBytes } from 'crypto';
import { Repository } from 'typeorm';
import { USER_ROLES, UserRole } from '../../common/constants/roles.constant';
import { hashPassword } from '../../common/utils/password.util';
import { StudentEntity } from '../../database/entities/student.entity';
import { UserEntity } from '../../database/entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UserResponseDto } from './dto/user-response.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly users: Repository<UserEntity>,
    @InjectRepository(StudentEntity)
    private readonly students: Repository<StudentEntity>,
  ) {}

  async findByEmail(email: string): Promise<UserEntity | null> {
    return this.users.findOne({
      where: { email: email.trim().toLowerCase() },
    });
  }

  async findById(id: string): Promise<UserEntity | null> {
    return this.users.findOne({ where: { id } });
  }

  /**
   * Admin-only account provisioning (any role). Student accounts must link to
   * an existing student profile and enable login on it.
   */
  async createUser(dto: CreateUserDto): Promise<UserResponseDto> {
    const name = dto.name.trim();
    const email = dto.email.trim().toLowerCase();
    const role = dto.role as UserRole;

    if (await this.findByEmail(email)) {
      throw new ConflictException(
        `An account with email ${email} already exists.`,
      );
    }

    let student: StudentEntity | null = null;
    let studentId: string | null = null;

    if (role === USER_ROLES.student) {
      const rawId = (dto.studentId ?? '').trim();
      if (!rawId) {
        throw new BadRequestException(
          'studentId is required when creating a student account.',
        );
      }
      student = await this.students.findOne({ where: { studentId: rawId } });
      if (!student) {
        throw new BadRequestException(
          `No student profile found for ID ${rawId}. Create the student first.`,
        );
      }
      studentId = rawId;
    }

    const user = this.users.create({
      id: `u-${randomBytes(6).toString('hex')}`,
      name,
      email,
      passwordHash: hashPassword(dto.password),
      role,
      studentId,
    });
    const saved = await this.users.save(user);

    if (student) {
      student.userId = saved.id;
      student.loginEnabled = true;
      await this.students.save(student);
    }

    return this.toResponse(saved);
  }

  toResponse(user: UserEntity): UserResponseDto {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role as UserResponseDto['role'],
      ...(user.studentId ? { studentId: user.studentId } : {}),
    };
  }
}
