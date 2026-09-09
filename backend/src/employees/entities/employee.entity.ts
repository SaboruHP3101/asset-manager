export class Employee {
  id: string;
  employeeCode: string;
  fullName: string;
  email: string;
  phoneNumber?: string | null;
  departmentId: string;
  roleId: string;
  isDepartmentHead: boolean;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string | null;
  updatedBy?: string | null;

  constructor(partial: Partial<Employee>) {
    Object.assign(this, partial);
  }
}
