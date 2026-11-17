import type { ManagementOwner } from "@/lib/purchase-orders";

export type Employee = {
  id: string;
  employeeCode: string;
  fullName: string;
  email: string;
  phoneNumber: string | null;
  departmentId: string;
  isDepartmentHead: boolean;
  isActive: boolean;
};

export type EmployeeFormValue = Pick<
  Employee,
  "employeeCode" | "fullName" | "email" | "departmentId" | "isDepartmentHead"
> & { phoneNumber: string };

export type Asset = {
  id: string;
  assetCode: string;
  purchaseOrderId?: string | null;
  purchaseOrderOwner?: ManagementOwner | null;
  name: string | null;
  category: string | null;
  assignedTo: string | null;
  department: string | null;
  location: string | null;
  status: string;
  assetCategoryId: string;
  supplierId: string;
  initialValue: string;
  purchaseDate: string;
  inServiceDate: string;
};

export type AssetFormValue = Pick<
  Asset,
  | "assetCode"
  | "assetCategoryId"
  | "supplierId"
  | "initialValue"
  | "purchaseDate"
  | "inServiceDate"
> & { name: string };
