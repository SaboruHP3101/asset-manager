import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { deleteAssetCategory } from "@/lib/asset-categories";
import type { AssetCategory } from "@/lib/asset-categories";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function AssetCategoryDeleteDialog({
  category,
  children,
  onClose,
}: {
  category: AssetCategory;
  children: AssetCategory[];
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [force, setForce] = useState(false);
  const remove = useMutation({
    mutationFn: () => deleteAssetCategory(category.id, force),
    onSuccess() {
      queryClient.invalidateQueries({ queryKey: ["asset-categories"] });
      queryClient.invalidateQueries({ queryKey: ["asset-options"] });
      toast.success("Đã xóa danh mục.");
      onClose();
    },
    onError() {
      queryClient.invalidateQueries({ queryKey: ["asset-categories"] });
    },
  });

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !remove.isPending) onClose();
      }}
    >
      <DialogContent
        className="max-h-[90svh] overflow-y-auto"
        showCloseButton={!remove.isPending}
      >
        <DialogHeader>
          <DialogTitle>Xóa danh mục?</DialogTitle>
          <DialogDescription>
            {category.code} — {category.name}.{" "}
            {children.length
              ? "Danh mục này có các danh mục con bên dưới. Chọn xóa cả cha và con để xóa toàn bộ nhánh. Thao tác này không thể hoàn tác."
              : "Bạn có chắc muốn xóa danh mục này? Thao tác này không thể hoàn tác."}
          </DialogDescription>
        </DialogHeader>
        {children.length ? (
          <ul className="max-h-60 space-y-2 overflow-y-auto rounded-md border p-3 break-words">
            {children.map((child) => (
              <li key={child.id}>
                {child.code} — {child.name}
              </li>
            ))}
          </ul>
        ) : null}
        <div className="flex items-start gap-2">
          <Checkbox
            id="force-delete"
            checked={force}
            onCheckedChange={(checked) => setForce(checked === true)}
            disabled={remove.isPending}
          />
          <Label htmlFor="force-delete">
            Xóa cả danh mục cha và tất cả danh mục con
          </Label>
        </div>
        {remove.isError ? (
          <Alert variant="destructive">
            <AlertDescription>{remove.error.message}</AlertDescription>
          </Alert>
        ) : null}
        <DialogFooter>
          <Button
            variant="outline"
            disabled={remove.isPending}
            onClick={onClose}
          >
            Đóng
          </Button>
          <Button
            variant="destructive"
            disabled={remove.isPending || (children.length > 0 && !force)}
            onClick={() => remove.mutate()}
          >
            {remove.isPending ? "Đang xóa..." : "Xóa"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
