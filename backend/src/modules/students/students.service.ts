import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { USER_ROLES } from '../../common/constants/roles.constant';
import { StudentEntity } from '../../database/entities/student.entity';
import { UsersService } from '../users/users.service';
import { CreateStudentDto } from './dto/create-student.dto';
import { StudentResponseDto } from './dto/student-response.dto';

@Injectable()
export class StudentsService {
  constructor(
    @InjectRepository(StudentEntity)
    private readonly students: Repository<StudentEntity>,
    private readonly usersService: UsersService,
  ) {}

  async findAll(): Promise<StudentResponseDto[]> {
    const rows = await this.students.find({ order: { name: 'ASC' } });
    return rows.map((row) => this.toResponse(row));
  }

  async findByStudentId(studentId: string): Promise<StudentEntity | null> {
    return this.students.findOne({ where: { studentId } });
  }

  /**
   * Create a student profile. When a password is provided, a login account
   * (role = student) is created and linked to this profile in the same call.
   */
  async create(dto: CreateStudentDto): Promise<StudentResponseDto> {
    const studentId = dto.studentId.trim();

    if (await this.findByStudentId(studentId)) {
      throw new BadRequestException(`Student ${studentId} already exists.`);
    }

    const saved = await this.students.save(
      this.students.create({
        studentId,
        name: dto.name.trim(),
        email: dto.email.trim().toLowerCase(),
        course: dto.course.trim(),
        year: dto.year.trim(),
        attendanceRate: 0,
        status: 'Active',
        loginEnabled: Boolean(dto.password),
        userId: null,
      }),
    );

    if (dto.password) {
      const account = await this.usersService.createUser({
        name: saved.name,
        email: saved.email,
        password: dto.password,
        role: USER_ROLES.student,
        studentId: saved.studentId,
      });
      saved.userId = account.id;
      saved.loginEnabled = true;
      await this.students.save(saved);
    }

    return this.toResponse(saved);
  }

  /** Enable/disable login for a student that already has an account. */
  async setLoginEnabled(
    studentId: string,
    loginEnabled: boolean,
  ): Promise<StudentResponseDto> {
    const student = await this.findByStudentId(studentId);
    if (!student) {
      throw new NotFoundException(`Student ${studentId} was not found.`);
    }

    if (loginEnabled && !student.userId) {
      throw new BadRequestException(
        'This student has no login account yet. Create the account before enabling login.',
      );
    }

    student.loginEnabled = loginEnabled;
    await this.students.save(student);
    return this.toResponse(student);
  }

  toResponse(student: StudentEntity): StudentResponseDto {
    return {
      studentId: student.studentId,
      name: student.name,
      email: student.email,
      course: student.course,
      year: student.year,
      attendanceRate: student.attendanceRate,
      status: student.status,
      loginEnabled: student.loginEnabled,
      hasAccount: Boolean(student.userId),
    };
  }
}
