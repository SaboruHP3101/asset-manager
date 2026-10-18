import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import {
  managementOwners,
  trackingModes,
  saveAssetCategory,
} from "@/lib/asset-categories";
import type { AssetCategory, CategoryFormValue } from "@/lib/asset-categories";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
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

export default function AssetCategoryDialog({
  category,
  onClose,
}: {
  category: AssetCategory | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<CategoryFormValue>({
    defaultValues: {
      code: category?.code ?? "",
      name: category?.name ?? "",
      description: category?.description ?? "",
      managementOwner: category?.managementOwner ?? "it",
      trackingMode: category?.trackingMode ?? "individual_asset",
    },
  });
  const save = useMutation({
    mutationFn: (values: CategoryFormValue) =>
      saveAssetCategory(values, category?.id),
    onSuccess() {
      queryClient.invalidateQueries({ queryKey: ["asset-categories"] });
      queryClient.invalidateQueries({ queryKey: ["asset-options"] });
      queryClient.invalidateQueries({ queryKey: ["assets"] });

      toast.success(category ? "Đã cập nhật danh mục." : "Đã tạo danh mục.");

      onClose();
    },
  });

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
            {category ? "Chỉnh sửa danh mục" : "Thêm danh mục"}
          </DialogTitle>
          <DialogDescription>
            {category
              ? "Lưu ý: Đơn vị quản lý và chế độ theo dõi sẽ không thể sửa được sau khi tạo."
              : "Tạo danh mục tài sản."}
          </DialogDescription>
        </DialogHeader>
        <form
          noValidate
          className="space-y-5"
          onSubmit={handleSubmit((values) => save.mutate(values))}
        >
          <fieldset disabled={save.isPending} className="space-y-4">
            {(
              [
                { name: "code", label: "Mã danh mục", maxLength: 100 },
                { name: "name", label: "Tên danh mục", maxLength: 255 },
              ] as const
            ).map((field) => (
              <div key={field.name} className="space-y-2">
                <Label htmlFor={field.name}>{field.label}</Label>
                <Input
                  id={field.name}
                  {...register(field.name, {
                    required: `Vui lòng nhập ${field.label.toLowerCase()}.`,
                    maxLength: {
                      value: field.maxLength,
                      message: `Tối đa ${field.maxLength} ký tự.`,
                    },
                    setValueAs: (value: string) => value.trim(),
                  })}
                />
                {errors[field.name] ? (
                  <p className="text-sm text-destructive">
                    {errors[field.name]?.message}
                  </p>
                ) : null}
              </div>
            ))}
            <div className="space-y-2">
              <Label htmlFor="description">Mô tả</Label>
              <Input
                id="description"
                {...register("description", {
                  setValueAs: (value: string) => value.trim(),
                })}
              />
            </div>
            {(
              [
                {
                  name: "managementOwner",
                  label: "Đơn vị quản lý",
                  items: managementOwners,
                },
                {
                  name: "trackingMode",
                  label: "Chế độ theo dõi",
                  items: trackingModes,
                },
              ] as const
            ).map((select) => (
              <div key={select.name} className="space-y-2">
                <Label htmlFor={select.name}>{select.label}</Label>
                <Controller
                  control={control}
                  name={select.name}
                  render={({ field }) => (
                    <Select
                      items={select.items}
                      value={field.value}
                      onValueChange={(value) => {
                        if (value) field.onChange(value);
                      }}
                      disabled={Boolean(category) || save.isPending}
                    >
                      <SelectTrigger
                        id={select.name}
                        className="w-full"
                        ref={field.ref}
                        onBlur={field.onBlur}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {select.items.map((item) => (
                          <SelectItem key={item.value} value={item.value}>
                            {item.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            ))}
          </fieldset>
          {save.isError ? (
            <Alert variant="destructive">
              <AlertDescription>{save.error.message}</AlertDescription>
            </Alert>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={save.isPending}
              onClick={onClose}
            >
              Đóng
            </Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? "Đang lưu..." : "Lưu"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
