import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { USER_ROLES } from '../../common/constants/roles.constant';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthGuard } from '../../common/guards/auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CreateStudentDto } from './dto/create-student.dto';
import { UpdateStudentAccessDto } from './dto/update-student-access.dto';
import { StudentsService } from './students.service';

@Controller('students')
@UseGuards(AuthGuard, RolesGuard)
export class StudentsController {
  constructor(private readonly studentsService: StudentsService) {}

  /** Student directory (admin manages accounts; teachers can view). */
  @Get()
  @Roles(USER_ROLES.admin, USER_ROLES.teacher)
  findAll() {
    return this.studentsService.findAll();
  }

  /** Create a student (optionally with a login account). Admin only. */
  @Post()
  @Roles(USER_ROLES.admin)
  create(@Body() dto: CreateStudentDto) {
    return this.studentsService.create(dto);
  }

  /** Toggle login access for a student. Admin only. */
  @Patch(':studentId/access')
  @Roles(USER_ROLES.admin)
  updateAccess(
    @Param('studentId') studentId: string,
    @Body() dto: UpdateStudentAccessDto,
  ) {
    return this.studentsService.setLoginEnabled(studentId, dto.loginEnabled);
  }
}
