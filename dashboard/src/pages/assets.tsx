import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router";
import { History, Pencil } from "lucide-react";
import AssetEditDialog from "@/components/asset-edit-dialog";
import StatusChip from "@/components/status-chip";
import ExportExcelButton from "@/components/export-excel-button";
import type { Asset } from "@/types";
import { useAuth } from "@/components/auth-provider";
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
import { DataTable, type DataTableColumn } from "@/components/data-table";
import {
  assetDepartmentLabels,
  assetStatusLabels,
  getAssetHistory,
  getAssetOptions,
  getAssets,
} from "@/lib/assets";
import { formatVietnamDate, formatVnd } from "@/lib/format";
import { RepairHistory } from "@/pages/repair-costs";

const historyFields = {
  assetCode: "Mã tài sản",
  name: "Tên tài sản",
  assetCategoryId: "Danh mục",
  supplierId: "Nhà cung cấp",
  initialValue: "Nguyên giá",
  purchaseDate: "Ngày mua",
  inServiceDate: "Ngày đưa vào sử dụng",
};
const handoverTypes: Record<string, string> = {
  initial_allocation: "Cấp phát lần đầu",
  reallocation: "Phân bổ lại",
  repair_to_it_warehouse: "Nhập kho IT để sửa chữa",
  repair_returned: "Trả tài sản sau sửa chữa",
  recall_to_it_warehouse: "Thu hồi về kho IT",
  upgrade_returned: "Trả tài sản sau nâng cấp",
  exchange_issued: "Bàn giao tài sản thay thế",
  disposed: "Báo phế",
};
const historyTime = new Intl.DateTimeFormat("vi-VN", {
  timeZone: "Asia/Ho_Chi_Minh",
  dateStyle: "short",
  timeStyle: "short",
});

function AssetHistoryDialog({ asset }: { asset: Asset }) {
  return (
    <Dialog>
      <DialogTrigger render={<Button variant="ghost" size="icon-sm" />}>
        <History />
      </DialogTrigger>
      <DialogContent
        showCloseButton={false}
        className="max-h-[90dvh] overflow-y-auto wrap-anywhere motion-reduce:animate-none sm:max-w-xl"
      >
        <DialogHeader>
          <DialogTitle>Lịch sử tài sản</DialogTitle>
          <DialogDescription>
            {asset.assetCode} · {asset.name}
          </DialogDescription>
        </DialogHeader>
        {asset.purchaseOrderId && asset.purchaseOrderOwner && (
          <Link
            className="w-fit text-sm font-medium text-primary underline underline-offset-4"
            to={`/purchase-orders?owner=${asset.purchaseOrderOwner}&order=${asset.purchaseOrderId}`}
          >
            Xem đơn mua gốc
          </Link>
        )}
        <section className="space-y-2">
          <h3 className="font-semibold">Chi phí sửa chữa</h3>
          <RepairHistory assetId={asset.id} />
        </section>
        <AssetHistory assetId={asset.id} />
        <DialogClose
          render={
            <Button
              variant="outline"
              className="cursor-pointer justify-self-end"
            />
          }
        >
          Đóng
        </DialogClose>
      </DialogContent>
    </Dialog>
  );
}

function AssetHistory({ assetId }: { assetId: string }) {
  const { token } = useAuth();
  const history = useQuery({
    queryKey: ["asset-history", assetId],
    queryFn: ({ signal }) => getAssetHistory(assetId, signal),
    enabled: Boolean(token),
    retry: false,
  });
  const options = useQuery({
    queryKey: ["asset-options"],
    queryFn: ({ signal }) => getAssetOptions(signal),
    enabled: Boolean(token),
    retry: false,
    staleTime: 60_000,
  });

  if (history.isPending) return <p role="status">Đang tải lịch sử...</p>;

  if (history.isError)
    return (
      <Alert variant="destructive">
        <AlertTitle>Không thể tải lịch sử tài sản</AlertTitle>
        <AlertDescription>
          <p>{history.error.message}</p>
          <Button
            variant="outline"
            className="mt-3 cursor-pointer"
            onClick={() => history.refetch()}
            disabled={history.isFetching}
          >
            {history.isFetching ? "Đang tải..." : "Thử lại"}
          </Button>
        </AlertDescription>
      </Alert>
    );

  return (
    <div className="space-y-6">
      <section aria-label="Chỉnh sửa thông tin" className="space-y-2">
        <h3 className="font-semibold">Chỉnh sửa thông tin</h3>
        {history.data.changes.length === 0 ? (
          <p className="text-muted-foreground">
            Chưa ghi nhận lần chỉnh sửa nào.
          </p>
        ) : (
          <ol className="divide-y border-y">
            {history.data.changes.map((change) => (
              <li key={change.id} className="space-y-2 py-3">
                <p className="font-medium">
                  {change.employeeName} ·{" "}
                  <time dateTime={change.createdAt}>
                    {historyTime.format(new Date(change.createdAt))}
                  </time>
                </p>
                <dl className="space-y-2">
                  {Object.entries(historyFields).map(([field, label]) => {
                    const before = change.oldData?.[field];
                    const after = change.newData?.[field];
                    if (before === after) return null;

                    return (
                      <div key={field} className="grid gap-x-4 sm:grid-cols-2">
                        <dt className="sm:col-span-2">{label}</dt>
                        {(
                          [
                            ["Trước", before],
                            ["Sau", after],
                          ] as const
                        ).map(([phase, value]) => {
                          let display = typeof value === "string" ? value : "—";
                          if (field === "assetCategoryId")
                            display =
                              options.data?.categories.find(
                                (item) => item.id === value
                              )?.label ?? display;
                          if (field === "supplierId")
                            display =
                              options.data?.suppliers.find(
                                (item) => item.id === value
                              )?.label ?? display;
                          if (
                            field === "initialValue" &&
                            typeof value === "string" &&
                            /^-?\d+(\.\d+)?$/.test(value)
                          )
                            display = formatVnd(value as `${number}`);

                          return (
                            <dd key={phase} className="text-muted-foreground">
                              {phase}
                              {" · "}
                              {display}
                            </dd>
                          );
                        })}
                      </div>
                    );
                  })}
                </dl>
              </li>
            ))}
          </ol>
        )}
      </section>
      <section aria-label="Bàn giao" className="space-y-2">
        <h3 className="font-semibold">Bàn giao</h3>
        {history.data.handovers.length === 0 ? (
          <p className="text-muted-foreground">
            Chưa ghi nhận lần bàn giao nào.
          </p>
        ) : (
          <ol className="divide-y border-y">
            {history.data.handovers.map((handover) => (
              <li key={handover.id} className="space-y-1 py-3">
                <p className="font-medium">
                  {Object.hasOwn(handoverTypes, handover.handoverType)
                    ? handoverTypes[handover.handoverType]
                    : handover.handoverType}{" "}
                  ·{" "}
                  <time dateTime={handover.handoverDate}>
                    {formatVietnamDate(new Date(handover.handoverDate))}
                  </time>
                </p>
                <p className="text-muted-foreground">
                  {handover.status === "completed"
                    ? "Đã hoàn tất"
                    : handover.status}
                </p>
                {handover.recipientName || handover.departmentName ? (
                  <p>
                    Bên nhận ·{" "}
                    {[
                      handover.recipientName,
                      handover.departmentName
                        ? Object.hasOwn(
                            assetDepartmentLabels,
                            handover.departmentName
                          )
                          ? assetDepartmentLabels[handover.departmentName]
                          : handover.departmentName
                        : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                ) : null}
                {handover.note ? (
                  <p className="text-muted-foreground">{handover.note}</p>
                ) : null}
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}

export default function AssetsPage() {
  const { token } = useAuth();
  const [editing, setEditing] = useState<Asset | null>(null);
  const assets = useQuery({
    queryKey: ["assets", token],
    queryFn: ({ signal }) => getAssets(signal),
    enabled: Boolean(token),
    retry: false,
    staleTime: 60_000,
  });

  const columns: DataTableColumn<Asset>[] = [
    {
      id: "code",
      header: "Mã tài sản",
      cell: (asset) => asset.assetCode,
      cellClassName: "font-medium",
    },
    { id: "name", header: "Tên tài sản", cell: (asset) => asset.name || "—" },
    {
      id: "category",
      header: "Danh mục",
      cell: (asset) => asset.category || "—",
    },
    {
      id: "assignee",
      header: "Người sử dụng",
      cell: (asset) => asset.assignedTo || "—",
    },
    {
      id: "department",
      header: "Phòng ban",
      cell: (asset) =>
        asset.department
          ? (assetDepartmentLabels[asset.department] ?? asset.department)
          : "—",
    },
    {
      id: "location",
      header: "Vị trí",
      cell: (asset) => asset.location || "—",
    },
    {
      id: "status",
      header: "Trạng thái",
      cell: (asset) => (
        <StatusChip
          status={asset.status}
          label={
            assetStatusLabels[asset.status.toLowerCase()] ?? "Chưa xác định"
          }
        />
      ),
    },
    {
      id: "actions",
      header: "Hành động",
      cell: (asset) => (
        <div className="flex items-center gap-1">
          <AssetHistoryDialog asset={asset} />
          <Button
            variant="ghost"
            size="icon-sm"
            title="Chỉnh sửa"
            onClick={() => setEditing(asset)}
          >
            <Pencil />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Tài sản</h1>
          <p className="mt-2 text-muted-foreground">
            Chi tiết tài sản, tình trạng và nơi quản lý.
          </p>
        </div>
        <ExportExcelButton
          fileName="danh-sach-tai-san"
          sheetName="Tài sản"
          headers={columns
            .filter((column) => column.id !== "actions")
            .map((column) => column.header)}
          rows={(assets.data ?? []).map((asset) => [
            asset.assetCode,
            asset.name || "—",
            asset.category || "—",
            asset.assignedTo || "—",
            asset.department
              ? (assetDepartmentLabels[asset.department] ?? asset.department)
              : "—",
            asset.location || "—",
            assetStatusLabels[asset.status.toLowerCase()] ?? "Chưa xác định",
          ])}
          disabled={!assets.isSuccess || assets.isFetching}
        />
      </div>
      {assets.isError ? (
        <Alert variant="destructive">
          <AlertTitle>Không thể tải danh sách tài sản</AlertTitle>
          <AlertDescription>
            <p>{assets.error.message}</p>
            <Button
              variant="outline"
              className="mt-3"
              onClick={() => assets.refetch()}
              disabled={assets.isFetching}
            >
              {assets.isFetching ? "Đang tải..." : "Thử lại"}
            </Button>
          </AlertDescription>
        </Alert>
      ) : (
        <DataTable
          columns={columns}
          data={assets.data ?? []}

          tableClassName="min-w-[960px]"
          emptyContent="Chưa có tài sản."
          loading="Đang tải tài sản..."
        />
      )}
      {editing ? (
        <AssetEditDialog asset={editing} onClose={() => setEditing(null)} />
      ) : null}
    </div>
  );
}
