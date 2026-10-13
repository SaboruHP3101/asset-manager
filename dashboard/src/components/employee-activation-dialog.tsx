import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/components/auth-provider";
import { saveEmployee } from "@/lib/employees";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { Employee } from "@/types";

export default function EmployeeActivationDialog({
  employee,
  onClose,
}: {
  employee: Employee;
  onClose: () => void;
}) {
  const { profile, logout } = useAuth();
  const queryClient = useQueryClient();

  const action = employee.isActive ? "Vô hiệu hóa" : "Kích hoạt";

  const save = useMutation({
    mutationFn: () =>
      saveEmployee({ isActive: !employee.isActive }, employee.id),
    onSuccess(updated) {
      onClose();

      if (employee.email === profile?.email && !updated.isActive) {
        logout();

        return;
      }

      queryClient.invalidateQueries({ queryKey: ["employees"] });
    },
  });

  return (
    <AlertDialog
      open
      onOpenChange={(open) => {
        if (!open && !save.isPending) onClose();
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{action} nhân viên?</AlertDialogTitle>
          <AlertDialogDescription>
            {action} tài khoản của {employee.fullName} ({employee.employeeCode}
            ).{" "}
            {employee.isActive
              ? "Nhân viên sẽ không thể đăng nhập khi tài khoản bị vô hiệu hóa."
              : "Nhân viên có thể đăng nhập lại nếu đã thiết lập mật khẩu."}
            {employee.email === profile?.email && employee.isActive
              ? " Bạn sẽ được đăng xuất sau khi xác nhận."
              : ""}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {save.isError ? (
          <Alert variant="destructive">
            <AlertDescription>{save.error.message}</AlertDescription>
          </Alert>
        ) : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={save.isPending}>Đóng</AlertDialogCancel>
          <AlertDialogAction
            variant={employee.isActive ? "destructive" : "default"}
            disabled={save.isPending}
            onClick={() => save.mutate()}
          >
            {save.isPending ? "Đang lưu…" : action}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
