import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { USER_ROLES } from '../../common/constants/roles.constant';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthGuard } from '../../common/guards/auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CreateStudentDto } from './dto/create-student.dto';
import { DeleteStudentDto } from './dto/delete-student.dto';
import { ListStudentsQueryDto } from './dto/list-students-query.dto';
import { UpdateStudentDto } from './dto/update-student.dto';
import { UpdateStudentAccessDto } from './dto/update-student-access.dto';
import { StudentsService } from './students.service';

@Controller('students')
@UseGuards(AuthGuard, RolesGuard)
export class StudentsController {
  constructor(private readonly studentsService: StudentsService) {}

  /** Student directory (teachers manage accounts). */
  @Get()
  @Roles(USER_ROLES.teacher)
  findAll(@Query() query: ListStudentsQueryDto) {
    return this.studentsService.findDirectory(query);
  }

  /** Create a student (optionally with a login account). */
  @Post()
  @Roles(USER_ROLES.teacher)
  create(@Body() dto: CreateStudentDto) {
    return this.studentsService.create(dto);
  }

  /** Update a student's profile and linked login identity. */
  @Patch(':studentId')
  @Roles(USER_ROLES.teacher)
  update(
    @Param('studentId') studentId: string,
    @Body() dto: UpdateStudentDto,
  ) {
    return this.studentsService.update(studentId, dto);
  }

  /** Delete a student profile and its linked student login account. */
  @Delete()
  @HttpCode(HttpStatus.OK)
  @Roles(USER_ROLES.teacher)
  remove(@Body() dto: DeleteStudentDto) {
    return this.studentsService.remove(dto.studentId);
  }

  /** Toggle login access for a student. */
  @Patch(':studentId/access')
  @Roles(USER_ROLES.teacher)
  updateAccess(
    @Param('studentId') studentId: string,
    @Body() dto: UpdateStudentAccessDto,
  ) {
    return this.studentsService.setLoginEnabled(studentId, dto.loginEnabled);
  }
}
