import { fetcher } from "@/lib/fetcher";
import type { Employee, EmployeeFormValue } from "@/types";

async function request<TData = unknown>(
  path: string,
  options: RequestInit = {}
) {
  const response = await fetcher(path, options);

  let data: TData;

  try {
    data = (await response.json()) as TData;
  } catch {
    throw new Error("Dữ liệu nhân viên không hợp lệ. Vui lòng thử lại.");
  }

  if (!response.ok) {
    if (response.status === 401)
      throw new Error(
        "Phiên đăng nhập đã hết hạn. Vui lòng đăng xuất và đăng nhập lại."
      );
    if (response.status === 403)
      throw new Error("Bạn không có quyền quản lý nhân viên.");
    if (response.status === 409)
      throw new Error(
        "Mã nhân viên hoặc email đã tồn tại, hoặc phòng ban/vai trò không hợp lệ."
      );
    if (response.status === 404)
      throw new Error(
        "Nhân viên không còn tồn tại. Vui lòng tải lại danh sách."
      );
    throw new Error(
      "Không thể xử lý yêu cầu. Vui lòng kiểm tra dữ liệu và thử lại."
    );
  }

  return data;
}

export async function getEmployees(signal?: AbortSignal) {
  const data = await request<Employee[]>("/employees", { signal });

  if (!Array.isArray(data)) {
    throw new Error("Dữ liệu nhân viên không hợp lệ. Vui lòng thử lại.");
  }

  return data;
}

export async function saveEmployee(
  values: (EmployeeFormValue & { roleId: string }) | { isActive: boolean },
  id?: string
) {
  // Tạo mới hoặc lưu một nhân viên tuỳ vào có id hay không
  const data = await request<Employee>(id ? `/employees/${id}` : "/employees", {
    method: id ? "PATCH" : "POST",
    body: JSON.stringify(values),
  });

  return data;
}

type Option = { id: string; name: string };

const departmentLabels: Record<string, string> = {
  IT: "Phòng Công nghệ thông tin",
  ACCOUNTING: "Phòng Kế toán",
  WAREHOUSE: "Phòng Kho vận",
  PROCUREMENT: "Phòng Thu mua",
  EXECUTIVE: "Ban Điều hành",
};

async function getOptions(path: string, signal: AbortSignal) {
  const data = await request(path, { signal });

  if (
    !Array.isArray(data) ||
    !data.every(
      (item: unknown): item is Option =>
        typeof item === "object" &&
        item !== null &&
        "id" in item &&
        typeof item.id === "string" &&
        "name" in item &&
        typeof item.name === "string"
    )
  ) {
    throw new Error("Không thể tải dữ liệu phòng ban. Vui lòng thử lại.");
  }

  return data;
}

export async function getEmployeeOptions(signal: AbortSignal) {
  const [departments, roles] = await Promise.all([
    getOptions("/departments", signal),
    getOptions("/roles", signal),
  ]);
  return {
    departments: departments.map((department) => ({
      ...department,
      label: departmentLabels[department.name] ?? department.name,
    })),
    roles,
  };
}
