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

  /** Student directory (teachers manage accounts). */
  @Get()
  @Roles(USER_ROLES.teacher)
  findAll() {
    return this.studentsService.findAll();
  }

  /** Create a student (optionally with a login account). */
  @Post()
  @Roles(USER_ROLES.teacher)
  create(@Body() dto: CreateStudentDto) {
    return this.studentsService.create(dto);
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
