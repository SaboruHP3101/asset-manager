import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  CircleCheck,
  CircleMinus,
  Pencil,
  Plus,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { getEmployees } from "@/lib/employees";
import EmployeeDialog from "@/components/employee-dialog";
import EmployeeActivationDialog from "@/components/employee-activation-dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Employee } from "@/types";

const tableHeaders = [
  "Mã nhân viên",
  "Họ tên",
  "Email",
  "Số điện thoại",
  "Trưởng phòng",
  "Trạng thái",
  "Hành động",
];

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
        <div className="overflow-hidden rounded-xl border">
          <Table className="min-w-[760px]">
            <TableCaption className="sr-only">Danh sách nhân viên</TableCaption>
            <TableHeader>
              <TableRow>
                {tableHeaders.map((label) => (
                  <TableHead key={label} className="font-semibold" scope="col">
                    {label}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {employees.isPending ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-32 text-center">
                    <p role="status">Đang tải nhân viên...</p>
                  </TableCell>
                </TableRow>
              ) : employees.data.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="h-32 text-center text-muted-foreground"
                  >
                    Chưa có nhân viên.
                  </TableCell>
                </TableRow>
              ) : (
                employees.data.map((employee) => (
                  <TableRow key={employee.id}>
                    <TableCell className="font-medium">
                      {employee.employeeCode}
                    </TableCell>
                    <TableCell>{employee.fullName}</TableCell>
                    <TableCell>{employee.email}</TableCell>
                    <TableCell>{employee.phoneNumber || "—"}</TableCell>
                    <TableCell>
                      {employee.isDepartmentHead ? "Có" : "Không"}
                    </TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ${employee.isActive ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" : "bg-muted text-muted-foreground"}`}
                      >
                        {employee.isActive ? (
                          <CircleCheck
                            className="size-3 shrink-0"
                            aria-hidden="true"
                          />
                        ) : (
                          <CircleMinus
                            className="size-3 shrink-0"
                            aria-hidden="true"
                          />
                        )}
                        {employee.isActive
                          ? "Đang hoạt động"
                          : "Ngừng hoạt động"}
                      </span>
                    </TableCell>
                    <TableCell>
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
                          title={
                            employee.isActive ? "Vô hiệu hóa" : "Kích hoạt"
                          }
                          onClick={() => setActivating(employee)}
                        >
                          {employee.isActive ? <ToggleRight /> : <ToggleLeft />}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
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
