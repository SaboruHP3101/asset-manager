import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { getAssetOptions, updateAsset } from "@/lib/assets";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Asset, AssetFormValue } from "@/types";

const textFields = [
  { name: "assetCode", label: "Mã tài sản", type: "text", maxLength: 100 },
  { name: "name", label: "Tên tài sản", type: "text", maxLength: 255 },
  {
    name: "initialValue",
    label: "Nguyên giá (VND)",
    type: "text",
    maxLength: undefined,
  },
  {
    name: "purchaseDate",
    label: "Ngày mua",
    type: "date",
    maxLength: undefined,
  },
  {
    name: "inServiceDate",
    label: "Ngày đưa vào sử dụng",
    type: "date",
    maxLength: undefined,
  },
] as const;

export default function AssetEditDialog({
  asset,
  onClose,
}: {
  asset: Asset;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<AssetFormValue>({
    defaultValues: {
      assetCode: asset.assetCode,
      name: asset.name ?? "",
      assetCategoryId: asset.assetCategoryId,
      supplierId: asset.supplierId,
      initialValue: asset.initialValue,
      purchaseDate: asset.purchaseDate,
      inServiceDate: asset.inServiceDate,
    },
  });
  const options = useQuery({
    queryKey: ["asset-options"],
    queryFn: ({ signal }) => getAssetOptions(signal),
    retry: false,
    staleTime: 60_000,
  });
  const save = useMutation({
    mutationFn: (values: AssetFormValue) => updateAsset(asset.id, values),
    onSuccess() {
      queryClient.invalidateQueries({ queryKey: ["assets"] });
      toast.success("Đã cập nhật tài sản.");
      onClose();
    },
  });

  const hasOptions = Boolean(
    options.data?.categories.length && options.data?.suppliers.length
  );

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
          <DialogTitle>Sửa tài sản</DialogTitle>
          <DialogDescription>
            Cập nhật thông tin của tài sản {asset.assetCode}.
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
              <div key={field.name} className="min-w-0 space-y-2">
                <Label htmlFor={`asset-${field.name}`}>{field.label}</Label>
                <Input
                  id={`asset-${field.name}`}
                  type={field.type}
                  inputMode={
                    field.name === "initialValue" ? "decimal" : undefined
                  }
                  maxLength={field.maxLength}
                  {...register(field.name, {
                    required: `Vui lòng nhập ${field.label.toLowerCase()}.`,
                    setValueAs: (value: string) => value.trim(),
                    ...(field.maxLength
                      ? {
                          maxLength: {
                            value: field.maxLength,
                            message: `Tối đa ${field.maxLength} ký tự.`,
                          },
                        }
                      : {}),
                    ...(field.name === "initialValue"
                      ? {
                          pattern: {
                            value: /^\d+(\.\d+)?$/,
                            message:
                              "Nguyên giá phải là số không âm, dùng dấu chấm cho phần thập phân.",
                          },
                        }
                      : {}),
                    ...(field.type === "date"
                      ? {
                          pattern: {
                            value: /^\d{4}-\d{2}-\d{2}$/,
                            message: "Ngày không hợp lệ.",
                          },
                        }
                      : {}),
                  })}
                />
                {errors[field.name] ? (
                  <p role="alert" className="text-sm text-destructive">
                    {errors[field.name]?.message}
                  </p>
                ) : null}
              </div>
            ))}
            {(
              [
                {
                  name: "assetCategoryId",
                  label: "Danh mục",
                  items: options.data?.categories ?? [],
                },
                {
                  name: "supplierId",
                  label: "Nhà cung cấp",
                  items: options.data?.suppliers ?? [],
                },
              ] as const
            ).map((select) => {
              const items = select.items.map((item) => ({
                value: item.id,
                label: item.label,
              }));

              return (
                <div
                  key={select.name}
                  className="min-w-0 space-y-2 sm:col-span-2"
                >
                  <Label htmlFor={`asset-${select.name}`}>{select.label}</Label>
                  <Controller
                    control={control}
                    name={select.name}
                    rules={{
                      required: `Vui lòng chọn ${select.label.toLowerCase()}.`,
                    }}
                    render={({ field }) => (
                      <Select
                        items={items}
                        value={hasOptions ? field.value || null : null}
                        onValueChange={(value) => field.onChange(value ?? "")}
                        disabled={!hasOptions || save.isPending}
                      >
                        <SelectTrigger
                          id={`asset-${select.name}`}
                          className="w-full"
                          ref={field.ref}
                          onBlur={field.onBlur}
                        >
                          <SelectValue
                            placeholder={`Chọn ${select.label.toLowerCase()}`}
                          />
                        </SelectTrigger>
                        <SelectContent>
                          {items.map((item) => (
                            <SelectItem key={item.value} value={item.value}>
                              {item.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                  {errors[select.name] ? (
                    <p role="alert" className="text-sm text-destructive">
                      {errors[select.name]?.message}
                    </p>
                  ) : null}
                </div>
              );
            })}
          </fieldset>
          {options.isPending ? (
            <p role="status" className="text-sm text-muted-foreground">
              Đang tải danh mục và nhà cung cấp...
            </p>
          ) : options.isError ? (
            <Alert variant="destructive">
              <AlertDescription>
                <p>{options.error.message}</p>
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
                Chưa có danh mục hoặc nhà cung cấp. Vui lòng bổ sung dữ liệu
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
              {save.isPending ? "Đang lưu..." : "Lưu"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
