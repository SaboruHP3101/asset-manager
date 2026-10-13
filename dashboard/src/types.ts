export type Employee = {
  id: string;
  employeeCode: string;
  fullName: string;
  email: string;
  phoneNumber: string | null;
  departmentId: string;
  roleId: string;
  isDepartmentHead: boolean;
  isActive: boolean;
};

export type EmployeeFormValue = Pick<
  Employee,
  "employeeCode" | "fullName" | "email" | "departmentId" | "isDepartmentHead"
> & { phoneNumber: string };

export type Department = { id: string; name: string };

export type Asset = {};
