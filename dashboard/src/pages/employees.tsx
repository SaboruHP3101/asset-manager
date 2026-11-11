import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Pencil, Plus, ToggleLeft, ToggleRight } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { getEmployees } from "@/lib/employees";
import EmployeeDialog from "@/components/employee-dialog";
import EmployeeActivationDialog from "@/components/employee-activation-dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/data-table";
import StatusChip from "@/components/status-chip";
import type { Employee } from "@/types";

export default function EmployeesPage() {
  const { token } = useAuth();
  const [editing, setEditing] = useState<Employee | null | undefined>();
  const [activating, setActivating] = useState<Employee | null>(null);
  const employees = useQuery({
    queryKey: ["employees"],
    queryFn: ({ signal }) => getEmployees(signal),
    enabled: Boolean(token),
    retry: false,
    staleTime: 60_000,
  });

  const columns: DataTableColumn<Employee>[] = [
    {
      id: "code",
      header: "Mã nhân viên",
      cell: (employee) => employee.employeeCode,
      cellClassName: "font-medium",
    },
    { id: "name", header: "Họ tên", cell: (employee) => employee.fullName },
    { id: "email", header: "Email", cell: (employee) => employee.email },
    {
      id: "phone",
      header: "Số điện thoại",
      cell: (employee) => employee.phoneNumber || "—",
    },
    {
      id: "head",
      header: "Trưởng phòng",
      cell: (employee) => (employee.isDepartmentHead ? "Có" : "Không"),
    },
    {
      id: "status",
      header: "Trạng thái",
      cell: (employee) => (
        <StatusChip
          status={employee.isActive ? "active" : "inactive"}
          label={employee.isActive ? "Đang hoạt động" : "Ngừng hoạt động"}
        />
      ),
    },
    {
      id: "actions",
      header: "Hành động",
      cell: (employee) => (
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            title="Chỉnh sửa"
            onClick={() => setEditing(employee)}
          >
            <Pencil />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            title={employee.isActive ? "Vô hiệu hóa" : "Kích hoạt"}
            onClick={() => setActivating(employee)}
          >
            {employee.isActive ? <ToggleRight /> : <ToggleLeft />}
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Nhân viên</h1>
          <p className="mt-2 text-muted-foreground">
            Thông tin nhân viên trong công ty.
          </p>
        </div>
        <Button onClick={() => setEditing(null)}>
          <Plus />
          Thêm nhân viên
        </Button>
      </div>
      {employees.isError ? (
        <Alert variant="destructive">
          <AlertTitle>Không thể tải danh sách nhân viên</AlertTitle>
          <AlertDescription>
            <p>{employees.error.message}</p>
            <Button
              variant="outline"
              className="mt-3"
              onClick={() => employees.refetch()}
              disabled={employees.isFetching}
            >
              {employees.isFetching ? "Đang tải..." : "Thử lại"}
            </Button>
          </AlertDescription>
        </Alert>
      ) : (
        <DataTable
          columns={columns}
          data={employees.data ?? []}
          tableClassName="min-w-[760px]"
          emptyContent="Chưa có nhân viên."
          loading="Đang tải nhân viên..."
        />
      )}
      {editing !== undefined ? (
        <EmployeeDialog
          employee={editing}
          onClose={() => setEditing(undefined)}
        />
      ) : null}
      {activating ? (
        <EmployeeActivationDialog
          employee={activating}
          onClose={() => setActivating(null)}
        />
      ) : null}
    </div>
  );
}
