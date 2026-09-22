/**
 * Principal nội bộ được JwtAuthGuard tạo từ dữ liệu mới nhất trong DB. Controller
 * và service dùng kiểu này để không phải tin employeeId hoặc role do client gửi.
 */
export interface AuthenticatedEmployee {
  id: string;
  email: string;
  roleId: string;
  roleName: string;
  departmentId: string;
  departmentName: string;
  isDepartmentHead: boolean;
}
