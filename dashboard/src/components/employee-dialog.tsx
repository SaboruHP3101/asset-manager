import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { useAuth } from "@/components/auth-provider";
import { getEmployeeOptions, saveEmployee } from "@/lib/employees";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Employee, EmployeeFormValue } from "@/types";

const textFields = [
  { name: "employeeCode", label: "Mã nhân viên", maxLength: 100 },
  { name: "fullName", label: "Họ tên", maxLength: 255 },
  { name: "email", label: "Email", maxLength: 255 },
  { name: "phoneNumber", label: "Số điện thoại", maxLength: 50 },
] as const;

export default function EmployeeDialog({
  employee,
  onClose,
}: {
  employee: Employee | null;
  onClose: () => void;
}) {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<EmployeeFormValue>({
    defaultValues: {
      employeeCode: employee?.employeeCode ?? "",
      fullName: employee?.fullName ?? "",
      email: employee?.email ?? "",
      phoneNumber: employee?.phoneNumber ?? "",
      departmentId: employee?.departmentId ?? "",
      isDepartmentHead: employee?.isDepartmentHead ?? false,
    },
  });
  const options = useQuery({
    queryKey: ["employee-options"],
    queryFn: ({ signal }) => getEmployeeOptions(signal),
    staleTime: 60_000,
    retry: false,
  });
  const save = useMutation({
    mutationFn: (values: EmployeeFormValue) => {
      const department = options.data?.departments.find(
        (item) => item.id === values.departmentId
      );
      const role =
        options.data?.roles.find((item) => item.name === department?.name) ??
        options.data?.roles.find((item) => item.name === "EMPLOYEE");

      if (!role)
        throw new Error(
          "Chưa có cấu hình phù hợp cho phòng ban. Vui lòng liên hệ quản trị viên."
        );

      return saveEmployee({ ...values, roleId: role.id }, employee?.id);
    },
    onSuccess() {
      onClose();

      queryClient.invalidateQueries({ queryKey: ["employees"] });

      if (employee?.email === profile?.email) {
        queryClient.invalidateQueries({ queryKey: ["profile"] });
      }
    },
  });

  const hasOptions =
    options.data &&
    options.data.departments.length > 0 &&
    options.data.roles.length > 0;
  const departmentItems =
    options.data?.departments.map((item) => ({
      value: item.id,
      label: item.label,
    })) ?? [];

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !save.isPending) onClose();
      }}
    >
      <DialogContent
        className="max-h-[90svh] overflow-y-auto sm:max-w-lg"
        showCloseButton={!save.isPending}
      >
        <DialogHeader>
          <DialogTitle>
            {employee ? "Chỉnh sửa nhân viên" : "Thêm nhân viên"}
          </DialogTitle>
          <DialogDescription>
            {employee
              ? "Cập nhật thông tin nhân viên."
              : "Nhập thông tin cho nhân viên mới. Tài khoản được tạo sẽ ở trạng thái hoạt động."}
          </DialogDescription>
        </DialogHeader>
        <form
          noValidate
          onSubmit={handleSubmit((values) => save.mutate(values))}
          className="space-y-5"
        >
          <fieldset
            disabled={save.isPending}
            className="grid gap-4 sm:grid-cols-2"
          >
            {textFields.map((field) => (
              <div key={field.name} className="space-y-2">
                <Label htmlFor={field.name}>{field.label}</Label>
                <Input
                  id={field.name}
                  type={
                    field.name === "email"
                      ? "email"
                      : field.name === "phoneNumber"
                        ? "tel"
                        : "text"
                  }
                  {...register(field.name, {
                    required:
                      field.name === "phoneNumber"
                        ? false
                        : `Vui lòng nhập ${field.label.toLowerCase()}.`,
                    maxLength: {
                      value: field.maxLength,
                      message: `Tối đa ${field.maxLength} ký tự.`,
                    },
                    setValueAs: (value: string) => value.trim(),
                    ...(field.name === "email"
                      ? {
                          pattern: {
                            value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                            message: "Email không hợp lệ.",
                          },
                        }
                      : {}),
                  })}
                />
                {errors[field.name] ? (
                  <p className="text-sm text-destructive" role="alert">
                    {errors[field.name]?.message}
                  </p>
                ) : null}
              </div>
            ))}
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="departmentId">Phòng ban</Label>
              <Controller
                control={control}
                name="departmentId"
                rules={{ required: "Vui lòng chọn phòng ban." }}
                render={({ field }) => (
                  <Select
                    items={departmentItems}
                    value={hasOptions ? field.value || null : null}
                    onValueChange={(value) => field.onChange(value ?? "")}
                    disabled={!hasOptions || save.isPending}
                  >
                    <SelectTrigger
                      id="departmentId"
                      className="w-full"
                      ref={field.ref}
                      onBlur={field.onBlur}
                    >
                      <SelectValue placeholder="Chọn phòng ban" />
                    </SelectTrigger>
                    <SelectContent>
                      {departmentItems.map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.departmentId ? (
                <p
                  id="department-error"
                  role="alert"
                  className="text-sm text-destructive"
                >
                  {errors.departmentId.message}
                </p>
              ) : null}
            </div>
            <div className="flex items-center gap-2 sm:col-span-2">
              <Controller
                control={control}
                name="isDepartmentHead"
                render={({ field }) => (
                  <Checkbox
                    id="isDepartmentHead"
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    onBlur={field.onBlur}
                    ref={field.ref}
                  />
                )}
              />
              <Label htmlFor="isDepartmentHead">Trưởng phòng</Label>
            </div>
          </fieldset>
          {options.isPending ? (
            <p role="status" className="text-sm text-muted-foreground">
              Đang tải phòng ban…
            </p>
          ) : options.isError ? (
            <Alert variant="destructive">
              <AlertDescription>
                {options.error.message}
                <Button
                  type="button"
                  variant="outline"
                  className="mt-2"
                  onClick={() => options.refetch()}
                  disabled={options.isFetching}
                >
                  Thử lại
                </Button>
              </AlertDescription>
            </Alert>
          ) : !hasOptions ? (
            <Alert>
              <AlertDescription>
                Chưa có dữ liệu phòng ban phù hợp. Vui lòng bổ sung dữ liệu
                trước khi lưu.
              </AlertDescription>
            </Alert>
          ) : null}
          {save.isError ? (
            <Alert variant="destructive">
              <AlertDescription>{save.error.message}</AlertDescription>
            </Alert>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={save.isPending}
            >
              Đóng
            </Button>
            <Button type="submit" disabled={save.isPending || !hasOptions}>
              {save.isPending ? "Đang lưu…" : "Lưu"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
