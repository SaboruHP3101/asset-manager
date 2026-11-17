/**
 * Principal nội bộ được JwtAuthGuard tạo từ dữ liệu mới nhất trong DB. Controller
 * và service dùng kiểu này để không phải tin employeeId hoặc phòng ban do client gửi.
 */
export interface AuthenticatedEmployee {
  id: string;
  email: string;
  departmentId: string;
  departmentName: string;
  isDepartmentHead: boolean;
}
