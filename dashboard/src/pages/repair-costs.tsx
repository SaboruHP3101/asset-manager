import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { History, Pencil } from "lucide-react";
import ExportExcelButton from "@/components/export-excel-button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { DataTable, type DataTableColumn } from "@/components/data-table";
import {
  formatVietnamDate,
  formatVietnamMonth,
  formatVnd,
  isValidYearMonth,
} from "@/lib/format";
import {
  getRepairCosts,
  getRepairHistory,
  updateRepairCost,
  type MonthlyRepairRequest,
  type RepairCostAsset,
} from "@/lib/repair-costs";

const outcomeLabels = {
  accepted: "Đã nghiệm thu",
  pending: "Chờ nghiệm thu",
  returned: "Đã trả sửa lại",
  recorded: "Đã ghi nhận",
};

function formatCost(cost: `${number}` | null) {
  return cost === null ? "Chưa ghi nhận" : formatVnd(cost);
}

const reportColumns = [
  {
    id: "code",
    header: "Mã tài sản",
    cell: (asset: RepairCostAsset) => asset.code,
    cellClassName: "font-medium",
  },
  {
    id: "name",
    header: "Tên tài sản",
    cell: (asset: RepairCostAsset) => asset.name,
    cellClassName: "min-w-32 wrap-anywhere whitespace-normal",
  },
  {
    id: "holder",
    header: "Người đang giữ",
    cell: (asset: RepairCostAsset) => asset.holder ?? "Chưa giao",
  },
  {
    id: "location",
    header: "Vị trí",
    cell: (asset: RepairCostAsset) => asset.location || "Chưa có vị trí",
    cellClassName: "min-w-28 wrap-anywhere whitespace-normal",
  },
  {
    id: "cost",
    header: "Chi phí trong tháng",
    cell: (asset: RepairCostAsset) => formatCost(asset.cost),
    cellClassName: "tabular-nums",
  },
] satisfies DataTableColumn<RepairCostAsset>[];

function LoadError({
  error,
  retry,
  loading,
}: {
  error: Error;
  retry: () => void;
  loading: boolean;
}) {
  return (
    <Alert variant="destructive">
      <AlertTitle>Không tải được dữ liệu</AlertTitle>
      <AlertDescription>
        <p>{error.message}</p>
        <Button
          variant="outline"
          className="mt-3 min-h-11 cursor-pointer disabled:cursor-not-allowed"
          onClick={retry}
          disabled={loading}
        >
          {loading ? "Đang tải..." : "Thử lại"}
        </Button>
      </AlertDescription>
    </Alert>
  );
}

export function RepairHistory({ assetId }: { assetId: string }) {
  const history = useQuery({
    queryKey: ["repair-cost-history", assetId],
    queryFn: ({ signal }) => getRepairHistory(assetId, signal),
    retry: false,
  });

  if (history.isPending)
    return <p role="status">Đang tải lịch sử sửa chữa...</p>;

  if (history.isError)
    return (
      <LoadError
        error={history.error}
        retry={history.refetch}
        loading={history.isFetching}
      />
    );

  if (!history.data.length)
    return (
      <p className="text-muted-foreground">
        Chưa có nhật ký hoàn tất sửa chữa.
      </p>
    );

  return (
    <ol className="max-h-[50dvh] divide-y overflow-y-auto">
      {history.data.map((attempt) => (
        <li
          key={attempt.id}
          className="grid grid-cols-[minmax(0,1fr)_minmax(0,auto)] gap-x-3 gap-y-1 py-3 wrap-anywhere"
        >
          <time dateTime={attempt.date}>
            {formatVietnamDate(new Date(attempt.date))}
          </time>
          <p className="text-right font-medium tabular-nums">
            {formatCost(attempt.cost)}
          </p>
          <p>{attempt.technician}</p>
          <p className="text-right text-muted-foreground">
            {outcomeLabels[attempt.outcome]}
          </p>
        </li>
      ))}
    </ol>
  );
}

function HistoryDialog({ asset }: { asset: RepairCostAsset }) {
  return (
    <Dialog>
      <DialogTrigger
        render={<Button variant="ghost" size="icon" className="size-11" />}
        title="Xem lịch sử sửa chữa"
      >
        <History aria-hidden="true" />
      </DialogTrigger>
      <DialogContent
        showCloseButton={false}
        className="max-h-[calc(100dvh-2rem)] overflow-y-auto motion-reduce:animate-none"
      >
        <DialogHeader>
          <DialogTitle className="wrap-anywhere">{asset.name}</DialogTitle>
          <DialogDescription className="wrap-anywhere">
            {asset.code} · Toàn bộ các lần IT xác nhận hoàn tất
          </DialogDescription>
        </DialogHeader>
        <RepairHistory assetId={asset.id} />
        <DialogClose
          render={
            <Button
              variant="outline"
              className="min-h-11 cursor-pointer justify-self-end"
            />
          }
        >
          Đóng
        </DialogClose>
      </DialogContent>
    </Dialog>
  );
}

function EditCostDialog({
  asset,
  month,
}: {
  asset: RepairCostAsset;
  month: string;
}) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<MonthlyRepairRequest>();
  const queryClient = useQueryClient();
  const toast = useToast();
  const save = useMutation({
    mutationFn: ({
      request,
      cost,
      reason,
    }: {
      request: MonthlyRepairRequest;
      cost: string;
      reason: string;
    }) => updateRepairCost(request, cost, reason),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["repair-costs", month] }),
        queryClient.invalidateQueries({
          queryKey: ["repair-cost-history", asset.id],
        }),
      ]);
      setOpen(false);
      toast.success("Đã lưu chi phí sửa chữa.");
    },
    onError: async (error) => {
      if (error.cause === 404 || error.cause === 409) {
        await queryClient.invalidateQueries({
          queryKey: ["repair-costs", month],
        });
      }
    },
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || save.isPending) return;

    const form = new FormData(event.currentTarget);
    save.mutate({
      request: selected,
      cost: String(form.get("cost")),
      reason: String(form.get("reason")).trim(),
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (save.isPending) return;
        if (nextOpen) {
          save.reset();
          setSelected(
            asset.requests.length === 1 ? asset.requests[0] : undefined
          );
        }
        setOpen(nextOpen);
      }}
    >
      <DialogTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className="size-11 cursor-pointer"
          />
        }
        title="Sửa chi phí"
      >
        <Pencil aria-hidden="true" />
      </DialogTrigger>
      <DialogContent
        showCloseButton={false}
        className="max-h-[calc(100dvh-2rem)] overflow-y-auto motion-reduce:animate-none"
      >
        <DialogHeader>
          <DialogTitle>
            {selected ? "Sửa chi phí sửa chữa" : "Chọn phiếu sửa chữa"}
          </DialogTitle>
          <DialogDescription className="wrap-anywhere">
            {asset.code}
            {selected ? ` · ${selected.issue}` : ` · ${month}`}
          </DialogDescription>
        </DialogHeader>
        {selected ? (
          <form className="grid gap-4" onSubmit={submit}>
            <fieldset disabled={save.isPending} className="grid min-w-0 gap-4">
              <label className="grid gap-2 font-medium">
                Trước
                <Input
                  readOnly
                  disabled
                  value={formatCost(selected.cost)}
                  className="bg-muted tabular-nums"
                />
              </label>
              <label className="grid gap-2 font-medium">
                Sau (VND)
                <Input
                  name="cost"
                  inputMode="numeric"
                  pattern="[0-9]{1,15}"
                  maxLength={15}
                  required
                  autoFocus
                  placeholder="Nhập số tiền mới"
                  className="tabular-nums"
                />
              </label>
              <label className="grid gap-2 font-medium">
                Lý do (bắt buộc)
                <textarea
                  name="reason"
                  rows={3}
                  required
                  maxLength={2000}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-base font-normal focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm"
                  onInput={(event) => {
                    const field = event.currentTarget;
                    field.setCustomValidity(
                      field.value && !field.value.trim()
                        ? "Vui lòng nhập lý do sửa chi phí."
                        : ""
                    );
                  }}
                />
              </label>
            </fieldset>
            {save.isError ? (
              <Alert variant="destructive" role="alert">
                <AlertDescription>{save.error.message}</AlertDescription>
              </Alert>
            ) : null}
            <DialogFooter>
              <DialogClose
                render={
                  <Button
                    variant="outline"
                    className="min-h-11 cursor-pointer"
                    disabled={save.isPending}
                  />
                }
              >
                Hủy
              </DialogClose>
              <Button
                type="submit"
                className="min-h-11 cursor-pointer"
                disabled={save.isPending}
              >
                {save.isPending ? "Đang lưu..." : "Lưu chi phí"}
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <>
            <ul className="grid gap-2">
              {asset.requests.map((request) => (
                <li key={request.id}>
                  <Button
                    variant="outline"
                    className="h-auto min-h-11 w-full cursor-pointer justify-between gap-3 py-2 text-left"
                    onClick={() => setSelected(request)}
                  >
                    <span className="min-w-0 wrap-anywhere whitespace-normal">
                      {request.issue}
                      <span className="block text-xs text-muted-foreground">
                        {formatVietnamDate(new Date(request.closedAt))} ·{" "}
                        {request.id.slice(0, 8)}
                      </span>
                    </span>
                    <span className="shrink-0 tabular-nums">
                      {formatCost(request.cost)}
                    </span>
                  </Button>
                </li>
              ))}
            </ul>
            <DialogFooter>
              <DialogClose
                render={
                  <Button
                    variant="outline"
                    className="min-h-11 cursor-pointer"
                  />
                }
              >
                Hủy
              </DialogClose>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function RepairCostsPage() {
  const [month, setMonth] = useState(() => formatVietnamMonth(new Date()));
  const costs = useQuery({
    queryKey: ["repair-costs", month],
    queryFn: ({ signal }) => getRepairCosts(month, signal),
    enabled: isValidYearMonth(month),
    retry: false,
  });

  const columns: DataTableColumn<RepairCostAsset>[] = [
    ...reportColumns,
    {
      id: "actions",
      header: "Hành động",
      cell: (asset) => (
        <div className="flex items-center">
          <EditCostDialog asset={asset} month={month} />
          <HistoryDialog asset={asset} />
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Chi phí sửa chữa
          </h1>
          <p className="mt-2 text-muted-foreground">
            Tổng hợp theo tháng nghiệm thu và đóng phiếu.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex gap-2">
            <Label htmlFor="repair-cost-month">Tháng báo cáo</Label>
            <Input
              id="repair-cost-month"
              type="month"
              placeholder="YYYY-MM"
              className="min-h-11 w-auto cursor-pointer"
              value={month}
              onInput={(event) => setMonth(event.currentTarget.value)}
            />
          </div>
          <ExportExcelButton
            fileName={`chi-phi-sua-chua-${month}`}
            sheetName="Chi phí sửa chữa"
            headers={reportColumns.map((column) => column.header)}
            rows={(costs.data?.assets ?? []).map((asset) =>
              reportColumns.map((column) => column.cell(asset))
            )}
            disabled={!costs.isEnabled || !costs.isSuccess || costs.isFetching}
          />
        </div>
      </div>

      {!costs.isEnabled ? (
        <p role="status">Chọn tháng báo cáo hợp lệ.</p>
      ) : costs.isPending ? (
        <p role="status">Đang tải chi phí sửa chữa...</p>
      ) : costs.isError ? (
        <LoadError
          error={costs.error}
          retry={costs.refetch}
          loading={costs.isFetching}
        />
      ) : !costs.data.assets.length ? (
        <p className="rounded-xl border p-5 text-muted-foreground">
          Tháng này chưa có phiếu sửa chữa được nghiệm thu.
        </p>
      ) : (
        <>
          <div className="rounded-xl border bg-card p-5 text-card-foreground">
            <p className="text-sm font-medium">Tổng chi phí trong tháng</p>
            <p className="mt-2 text-3xl font-semibold wrap-anywhere tabular-nums">
              {formatCost(costs.data.total)}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              Mỗi phiếu chỉ tính số tiền ở lần được nghiệm thu.
            </p>
          </div>
          <DataTable columns={columns} data={costs.data.assets} />
        </>
      )}
    </div>
  );
}
