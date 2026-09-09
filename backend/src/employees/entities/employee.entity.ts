import { ApiHideProperty } from '@nestjs/swagger';

export class Employee {
  id: string;
  employeeCode: string;
  fullName: string;
  email: string;
  phoneNumber?: string | null;
  departmentId: string;
  roleId: string;
  isDepartmentHead: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string | null;
  updatedBy?: string | null;

  @ApiHideProperty()
  password?: string | null;

  constructor(partial: Partial<Employee>) {
    Object.assign(this, partial);
  }
}
