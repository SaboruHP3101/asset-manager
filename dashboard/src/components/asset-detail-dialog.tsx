import { useQuery } from "@tanstack/react-query";
import type { Asset } from "@/types";
import {
  assetDepartmentLabels,
  assetStatusLabels,
  getAssetHistory,
} from "@/lib/assets";
import { formatVietnamDate, formatVnd } from "@/lib/format";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DataTable } from "@/components/data-table";
import StatusChip from "@/components/status-chip";

export default function AssetDetailDialog({
  asset,
  onClose,
}: {
  asset: Asset;
  onClose: () => void;
}) {
  const history = useQuery({
    queryKey: ["asset-history", asset.id],
    queryFn: ({ signal }) => getAssetHistory(asset.id, signal),
    retry: false,
  });

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-h-[90dvh] overflow-y-auto wrap-anywhere motion-reduce:animate-none sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Chi tiết tài sản</DialogTitle>
          <DialogDescription>{asset.assetCode}</DialogDescription>
        </DialogHeader>
        <dl className="grid gap-4 sm:grid-cols-6">
          <div className="space-y-1 sm:col-span-3">
            <dt className="text-muted-foreground">Danh mục</dt>
            <dd>{asset.category || "Chưa cập nhật"}</dd>
          </div>
          <div className="space-y-1 sm:col-span-3">
            <dt className="text-muted-foreground">Tên tài sản</dt>
            <dd className="font-medium">{asset.name || "Chưa cập nhật"}</dd>
          </div>
          <div className="space-y-1 sm:col-span-2">
            <dt className="text-muted-foreground">Người sử dụng</dt>
            <dd>{asset.assignedTo || "Chưa có"}</dd>
          </div>
          <div className="space-y-1 sm:col-span-2">
            <dt className="text-muted-foreground">Phòng ban</dt>
            <dd>
              {asset.department
                ? (assetDepartmentLabels[asset.department] ?? asset.department)
                : "Chưa có"}
            </dd>
          </div>
          <div className="space-y-1 sm:col-span-2">
            <dt className="text-muted-foreground">Vị trí</dt>
            <dd>{asset.location || "Chưa cập nhật"}</dd>
          </div>
          <div className="space-y-1 sm:col-span-6">
            <dt className="text-muted-foreground">Trạng thái</dt>
            <dd>
              <StatusChip
                status={asset.status}
                label={
                  assetStatusLabels[asset.status.toLowerCase()] ??
                  "Chưa xác định"
                }
              />
            </dd>
          </div>
          <div className="space-y-1 sm:col-span-3">
            <dt className="text-muted-foreground">Nguyên giá</dt>
            <dd className="tabular-nums">
              {formatVnd(asset.initialValue as `${number}`)}
            </dd>
          </div>
          <div className="space-y-1 sm:col-span-3">
            <dt className="text-muted-foreground">Giá trị còn lại</dt>
            <dd className="tabular-nums">
              {asset.currentValue == null
                ? "Chưa cập nhật"
                : formatVnd(asset.currentValue)}
            </dd>
          </div>
        </dl>
        <section
          aria-label="Khấu hao đã ghi nhận"
          className="min-w-0 space-y-3"
        >
          <h3 className="font-semibold">Khấu hao đã ghi nhận</h3>
          {history.isPending ? (
            <p role="status">Đang tải khấu hao...</p>
          ) : history.isError ? (
            <Alert variant="destructive">
              <AlertTitle>Không thể tải khấu hao</AlertTitle>
              <AlertDescription>
                <p>{history.error.message}</p>
                <Button
                  variant="outline"
                  className="mt-3"
                  onClick={() => history.refetch()}
                  disabled={history.isFetching}
                >
                  {history.isFetching ? "Đang tải..." : "Thử lại"}
                </Button>
              </AlertDescription>
            </Alert>
          ) : (
            <DataTable
              data={history.data.depreciations}
              emptyContent="Chưa có khấu hao đã ghi nhận."
              columns={[
                {
                  id: "dates",
                  header: "Thời gian",
                  cell: (line) =>
                    `${formatVietnamDate(new Date(line.fromDate))} - ${formatVietnamDate(new Date(line.toDate))}`,
                },
                {
                  id: "opening",
                  header: "Đầu kỳ",
                  cell: (line) => formatVnd(line.openingValue),
                  cellClassName: "whitespace-nowrap tabular-nums",
                },
                {
                  id: "amount",
                  header: "Khấu hao",
                  cell: (line) => formatVnd(line.depreciationAmount),
                  cellClassName: "whitespace-nowrap tabular-nums",
                },
                {
                  id: "remaining",
                  header: "Cuối kỳ",
                  cell: (line) => formatVnd(line.remainingValue),
                  cellClassName: "whitespace-nowrap tabular-nums",
                },
              ]}
            />
          )}
        </section>
        <DialogClose
          render={<Button variant="outline" className="justify-self-end" />}
        >
          Đóng
        </DialogClose>
      </DialogContent>
    </Dialog>
  );
}
