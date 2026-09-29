import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, FindOptionsWhere, Repository } from 'typeorm';
import { USER_ROLES } from '../../common/constants/roles.constant';
import { AttendanceRecordEntity } from '../../database/entities/attendance-record.entity';
import { StudentEntity } from '../../database/entities/student.entity';
import { UserEntity } from '../../database/entities/user.entity';
import { UsersService } from '../users/users.service';
import { CreateStudentDto } from './dto/create-student.dto';
import { ListStudentsQueryDto } from './dto/list-students-query.dto';
import { StudentDirectoryResponseDto } from './dto/student-directory-response.dto';
import { StudentResponseDto } from './dto/student-response.dto';
import { UpdateStudentDto } from './dto/update-student.dto';

@Injectable()
export class StudentsService {
  constructor(
    @InjectRepository(StudentEntity)
    private readonly students: Repository<StudentEntity>,
    private readonly usersService: UsersService,
    private readonly dataSource: DataSource,
  ) {}

  async findAll(): Promise<StudentResponseDto[]> {
    const rows = await this.students.find({ order: { name: 'ASC' } });
    return rows.map((row) => this.toResponse(row));
  }

  async findDirectory(
    filters: ListStudentsQueryDto = {},
  ): Promise<StudentDirectoryResponseDto> {
    const query = this.students.createQueryBuilder('student');
    const search = filters.search?.trim();

    if (search) {
      query.andWhere(
        `(student.name LIKE :search ESCAPE '!'
          OR student.studentId LIKE :search ESCAPE '!'
          OR student.email LIKE :search ESCAPE '!')`,
        { search: `${this.escapeLikePattern(search)}%` },
      );
    }
    if (filters.course && filters.course !== 'all') {
      query.andWhere('student.course = :course', { course: filters.course });
    }
    if (filters.status && filters.status !== 'all') {
      query.andWhere('student.status = :status', { status: filters.status });
    }

    query.orderBy('student.name', 'ASC').addOrderBy('student.studentId', 'ASC');

    const summaryQuery = this.students
      .createQueryBuilder('student')
      .select('COUNT(*)', 'total_students')
      .addSelect(
        'COALESCE(SUM(CASE WHEN student.status = :active THEN 1 ELSE 0 END), 0)',
        'active_scanners',
      )
      .addSelect(
        'COALESCE(SUM(CASE WHEN student.status = :review THEN 1 ELSE 0 END), 0)',
        'needs_review',
      )
      .addSelect(
        'COALESCE(SUM(CASE WHEN student.loginEnabled = :enabled THEN 1 ELSE 0 END), 0)',
        'login_enabled_count',
      )
      .setParameters({ active: 'Active', review: 'Review', enabled: true });

    const coursesQuery = this.students
      .createQueryBuilder('student')
      .select('student.course', 'course')
      .where("student.course <> ''")
      .groupBy('student.course')
      .orderBy('student.course', 'ASC');

    const [rows, summaryRow, courseRows] = await Promise.all([
      query.getMany(),
      summaryQuery.getRawOne<{
        total_students: string | number;
        active_scanners: string | number;
        login_enabled_count: string | number;
        needs_review: string | number;
      }>(),
      coursesQuery.getRawMany<{ course: string }>(),
    ]);

    return {
      students: rows.map((row) => this.toResponse(row)),
      courses: courseRows.map((row) => row.course),
      summary: {
        totalStudents: Number(summaryRow?.total_students ?? 0),
        activeScanners: Number(summaryRow?.active_scanners ?? 0),
        loginEnabledCount: Number(summaryRow?.login_enabled_count ?? 0),
        needsReview: Number(summaryRow?.needs_review ?? 0),
      },
    };
  }

  /** Delete the profile and linked student login together; attendance snapshots are retained. */
  async remove(studentId: string): Promise<StudentResponseDto> {
    const id = studentId.trim();
    if (!id) {
      throw new BadRequestException('Student ID is required.');
    }

    return this.dataSource.transaction(async (manager) => {
      const students = manager.getRepository(StudentEntity);
      const student = await students.findOne({ where: { studentId: id } });
      if (!student) {
        throw new NotFoundException(`Student ${id} was not found.`);
      }

      const response = this.toResponse(student);
      const userCriteria: FindOptionsWhere<UserEntity>[] = [
        { role: USER_ROLES.student, studentId: id },
      ];
      if (student.userId) {
        userCriteria.push({ role: USER_ROLES.student, id: student.userId });
      }

      await manager.getRepository(UserEntity).delete(userCriteria);
      await students.delete({ studentId: id });
      return response;
    });
  }

  async findByStudentId(studentId: string): Promise<StudentEntity | null> {
    return this.students.findOne({ where: { studentId } });
  }

  async findByUserId(userId: string): Promise<StudentEntity | null> {
    const id = userId.trim();
    if (!id) {
      return null;
    }
    return this.students.findOne({ where: { userId: id } });
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

  /** Update profile fields, identifier, linked login, and attendance references atomically. */
  async update(
    studentId: string,
    dto: UpdateStudentDto,
  ): Promise<StudentResponseDto> {
    const id = studentId.trim();
    const requestedStudentId = dto.studentId.trim();
    if (!id) {
      throw new BadRequestException('Student ID is required.');
    }

    const name = dto.name.trim();
    const email = dto.email.trim().toLowerCase();
    const course = dto.course.trim();
    const year = dto.year.trim();
    if (!requestedStudentId || !name || !email || !course || !year) {
      throw new BadRequestException(
        'Student ID, name, email, class, and year are required.',
      );
    }
    const identifierChanged =
      requestedStudentId.toLowerCase() !== id.toLowerCase();
    const nextStudentId = identifierChanged ? requestedStudentId : id;

    return this.dataSource.transaction(async (manager) => {
      const students = manager.getRepository(StudentEntity);
      const users = manager.getRepository(UserEntity);
      const student = await students.findOne({ where: { studentId: id } });

      if (!student) {
        throw new NotFoundException('Student ' + id + ' was not found.');
      }

      if (identifierChanged) {
        const existingStudent = await students.findOne({
          where: { studentId: nextStudentId },
        });
        if (existingStudent) {
          throw new ConflictException(
            `Student ${nextStudentId} already exists.`,
          );
        }
      }

      let account = student.userId
        ? await users.findOne({
            where: { id: student.userId, role: USER_ROLES.student },
          })
        : null;
      if (!account) {
        account = await users.findOne({
          where: { role: USER_ROLES.student, studentId: id },
        });
      }

      if (identifierChanged) {
        const accountUsingStudentId = await users.findOne({
          where: { role: USER_ROLES.student, studentId: nextStudentId },
        });
        if (accountUsingStudentId && accountUsingStudentId.id !== account?.id) {
          throw new ConflictException(
            `Student ID ${nextStudentId} is already linked to another account.`,
          );
        }

        const attendanceRecords = manager.getRepository(AttendanceRecordEntity);
        const previouslyUsedId = await attendanceRecords.findOne({
          where: { studentId: nextStudentId },
          select: { id: true },
        });
        if (previouslyUsedId) {
          throw new ConflictException(
            `Student ID ${nextStudentId} already appears in attendance history and cannot be reassigned.`,
          );
        }
      }

      if (account) {
        const emailOwner = await users.findOne({ where: { email } });
        if (emailOwner && emailOwner.id !== account.id) {
          throw new ConflictException(
            'An account with email ' + email + ' already exists.',
          );
        }
        account.name = name;
        account.email = email;
        account.studentId = nextStudentId;
        await users.save(account);
        student.userId = account.id;
      }

      const attendanceRecords = manager.getRepository(AttendanceRecordEntity);
      if (identifierChanged) {
        await attendanceRecords.update(
          { studentId: id },
          { studentId: nextStudentId },
        );
      }

      student.name = name;
      student.email = email;
      student.course = course;
      student.year = year;
      if (identifierChanged) {
        const result = await students.update(
          { studentId: id },
          {
            studentId: nextStudentId,
            name,
            email,
            course,
            year,
            userId: student.userId,
          },
        );
        if (result.affected !== 1) {
          throw new NotFoundException('Student ' + id + ' was not found.');
        }
        student.studentId = nextStudentId;
        return this.toResponse(student);
      }

      const updated = await students.save(student);
      return this.toResponse(updated);
    });
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

  private escapeLikePattern(value: string): string {
    return value.replace(/[!%_]/g, (character) => `!${character}`);
  }
}
