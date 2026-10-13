import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ForbiddenException,
  UseGuards,
  ParseUUIDPipe,
  ValidationPipe,
} from '@nestjs/common';
import { EmployeesService } from './employees.service.js';
import { CreateEmployeeDto } from './dto/create-employee.dto.js';
import { UpdateEmployeeDto } from './dto/update-employee.dto.js';
import { ApiTags } from '@nestjs/swagger';
import { CurrentEmployee } from '../auth/current-employee.decorator.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import type { AuthenticatedEmployee } from '../auth/workflow-auth.types.js';

@ApiTags('employees')
@Controller('employees')
export class EmployeesController {
  constructor(private readonly employeesService: EmployeesService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  create(
    @Body(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
    createEmployeeDto: CreateEmployeeDto,
    @CurrentEmployee() actor: AuthenticatedEmployee,
  ) {
    this.assertIt(actor);

    return this.employeesService.create(createEmployeeDto);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  findAll(@CurrentEmployee() actor: AuthenticatedEmployee) {
    this.assertIt(actor);

    return this.employeesService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.employeesService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
    updateEmployeeDto: UpdateEmployeeDto,
    @CurrentEmployee() actor: AuthenticatedEmployee,
  ) {
    this.assertIt(actor);

    return this.employeesService.update(id, updateEmployeeDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.employeesService.remove(id);
  }

  private assertIt(actor: AuthenticatedEmployee) {
    if (actor.departmentName !== 'IT') {
      throw new ForbiddenException('Chỉ phòng IT được quản lý nhân viên.');
    }
  }
}
