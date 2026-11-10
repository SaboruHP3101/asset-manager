import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { History } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  formatVietnamDate,
  formatVietnamMonth,
  formatVnd,
  isValidYearMonth,
} from "@/lib/format";
import {
  getRepairCosts,
  getRepairHistory,
  type RepairCostAsset,
} from "@/lib/repair-costs";

const tableHeaders = [
  "Mã tài sản",
  "Tên tài sản",
  "Người đang giữ",
  "Vị trí",
  "Chi phí trong tháng",
  "Lịch sử",
];

const outcomeLabels = {
  accepted: "Đã nghiệm thu",
  pending: "Chờ nghiệm thu",
  returned: "Đã trả sửa lại",
  recorded: "Đã ghi nhận",
};

function formatCost(cost: `${number}` | null) {
  return cost === null ? "Chưa ghi nhận" : formatVnd(cost);
}

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

export default function RepairCostsPage() {
  const [month, setMonth] = useState(() => formatVietnamMonth(new Date()));
  const costs = useQuery({
    queryKey: ["repair-costs", month],
    queryFn: ({ signal }) => getRepairCosts(month, signal),
    enabled: isValidYearMonth(month),
    retry: false,
  });

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
        <div className="grid gap-2">
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
          <div className="overflow-hidden rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  {tableHeaders.map((title) => (
                    <TableHead key={title} scope="col">
                      {title}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {costs.data.assets.map((asset) => (
                  <TableRow key={asset.id}>
                    <TableCell className="font-medium">{asset.code}</TableCell>
                    <TableCell className="min-w-32 wrap-anywhere whitespace-normal">
                      {asset.name}
                    </TableCell>
                    <TableCell>{asset.holder ?? "Chưa giao"}</TableCell>
                    <TableCell className="min-w-28 wrap-anywhere whitespace-normal">
                      {asset.location || "Chưa có vị trí"}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {formatCost(asset.cost)}
                    </TableCell>
                    <TableCell>
                      <HistoryDialog asset={asset} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  );
}
