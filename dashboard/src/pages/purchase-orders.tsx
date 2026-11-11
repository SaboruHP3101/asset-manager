import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router";
import { useAuth } from "@/components/auth-provider";
import { DataTable, type DataTableColumn } from "@/components/data-table";
import ExportExcelButton from "@/components/export-excel-button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { assetDepartmentLabels } from "@/lib/assets";
import { formatVietnamDate, formatVnd } from "@/lib/format";
import {
  getItPurchaseOrder,
  getItPurchaseOrders,
  managementOwnerLabels,
  orderStatusLabels,
  type ManagementOwner,
  type ItPurchaseOrder,
} from "@/lib/purchase-orders";

const selectClass =
  "h-9 min-w-0 w-full cursor-pointer rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-2 focus-visible:outline-ring";

function OrderLoadError({
  message,
  retry,
}: {
  message: string;
  retry: () => void;
}) {
  return (
    <Alert variant="destructive">
      <AlertTitle>Không tải được đơn mua</AlertTitle>
      <AlertDescription>
        <p>{message}</p>
        <Button
          variant="outline"
          onClick={retry}
          className="mt-2 cursor-pointer"
        >
          Thử lại
        </Button>
      </AlertDescription>
    </Alert>
  );
}

function OrderDetail({ id, owner }: { id: string; owner: ManagementOwner }) {
  const detail = useQuery({
    queryKey: ["it-purchase-order", id, owner],
    queryFn: ({ signal }) => getItPurchaseOrder(id, owner, signal),
    retry: false,
  });

  if (detail.isPending) return <p>Đang tải chi tiết đơn mua...</p>;
  if (detail.isError)
    return (
      <OrderLoadError message={detail.error.message} retry={detail.refetch} />
    );

  const order = detail.data;
  const fields = [
    ["Mã đơn", order.code],
    ["Trạng thái đơn", orderStatusLabels[order.status]],
    ["Nhà cung cấp", order.supplierName],
    [
      "Phòng đề nghị",
      assetDepartmentLabels[order.department] ?? order.department,
    ],
    ["Ngày đặt", formatVietnamDate(new Date(order.orderDate))],
    ["Dự kiến giao", formatVietnamDate(new Date(order.expectedDeliveryDate))],
  ];

  return (
    <div className="space-y-4">
      <dl className="grid grid-cols-2 gap-x-3 gap-y-2 rounded-lg border p-3 text-sm">
        {fields.map(([label, value]) => (
          <div key={label}>
            <dt className="text-muted-foreground">{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-semibold">Dòng hàng</h3>
        <p className="text-sm">
          Tổng dòng hàng: <strong>{formatVnd(order.total)}</strong>
        </p>
      </div>
      {order.lines.length === 0 && (
        <p>Đơn này không còn dòng hàng thuộc đơn vị đã chọn.</p>
      )}
      <ul className="divide-y rounded-lg border px-3">
        {order.lines.map((line) => (
          <li key={line.id} className="space-y-2 py-3 text-sm">
            <div className="flex flex-wrap justify-between gap-x-3 gap-y-1">
              <p className="font-medium">{line.name}</p>
              <p className="tabular-nums">{formatVnd(line.total)}</p>
            </div>
            <dl className="grid grid-cols-2 gap-2 text-sm tabular-nums sm:grid-cols-4">
              {[
                ["Đã đặt", line.ordered],
                ["Đã nhận", line.received],
                ["Nghiệm thu đạt", line.accepted],
                ["Không đạt", line.rejected],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
            <p>
              <span className="text-muted-foreground">Mã tài sản:</span>{" "}
              {line.assetCodes.join(", ") || "Chưa tạo tài sản"}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function ItPurchaseOrdersPage() {
  const { profile } = useAuth();
  const [params, setParams] = useSearchParams();
  const [status, setStatus] = useState("");
  const [supplier, setSupplier] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const requestedOwner = params.get("owner");
  const defaultOwner =
    profile?.department === "PROCUREMENT" ? "procurement" : "it";
  const owner =
    requestedOwner === "it" || requestedOwner === "procurement"
      ? requestedOwner
      : defaultOwner;
  const orders = useQuery({
    queryKey: ["purchase-orders", owner],
    queryFn: ({ signal }) => getItPurchaseOrders(owner, signal),
    retry: false,
  });

  const orderId = params.get("order");

  const suppliers = new Map(
    orders.data?.map((order) => [order.supplierId, order.supplierName])
  );

  const invalidDates = Boolean(fromDate && toDate && fromDate > toDate);

  const filtered =
    orders.data?.filter(
      (order) =>
        (!status || order.status === status) &&
        (!supplier || order.supplierId === supplier) &&
        (!fromDate || order.orderDate >= fromDate) &&
        (!toDate || order.orderDate <= toDate)
    ) ?? [];

  const columns: DataTableColumn<ItPurchaseOrder>[] = [
    {
      id: "code",
      header: "Mã đơn",
      cell: (order) => (
        <Button
          variant="link"
          className="h-auto min-h-9 cursor-pointer p-0 underline"
          onClick={() => setParams({ owner, order: order.id })}
        >
          {order.code}
        </Button>
      ),
    },
    {
      id: "supplier",
      header: "Nhà cung cấp",
      cell: (order) => order.supplierName,
      cellClassName: "max-w-60 wrap-anywhere whitespace-normal",
    },
    {
      id: "department",
      header: "Phòng đề nghị",
      cell: (order) =>
        assetDepartmentLabels[order.department] ?? order.department,
    },
    {
      id: "order-date",
      header: "Ngày đặt",
      cell: (order) => formatVietnamDate(new Date(order.orderDate)),
    },
    {
      id: "expected-delivery-date",
      header: "Dự kiến giao",
      cell: (order) => formatVietnamDate(new Date(order.expectedDeliveryDate)),
    },
    {
      id: "status",
      header: "Trạng thái đơn",
      cell: (order) => orderStatusLabels[order.status],
    },
    {
      id: "total",
      header: "Tổng theo đơn vị quản lý",
      cell: (order) => formatVnd(order.total),
      headerClassName: "text-right",
      cellClassName: "text-right tabular-nums",
    },
  ];

  return (
    <section className="min-w-0 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            Đơn mua tài sản
          </h1>
          <p className="text-sm text-muted-foreground">
            Theo dõi giao hàng, nghiệm thu và tài sản tạo từ từng đơn.
          </p>
        </div>
        <ExportExcelButton
          fileName={`don-mua-tai-san-${owner}`}
          sheetName="Đơn mua tài sản"
          headers={columns.map((column) => column.header)}
          rows={filtered.map((order) => [
            order.code,
            order.supplierName,
            assetDepartmentLabels[order.department] ?? order.department,
            formatVietnamDate(new Date(order.orderDate)),
            formatVietnamDate(new Date(order.expectedDeliveryDate)),
            orderStatusLabels[order.status],
            formatVnd(order.total),
          ])}
          disabled={!orders.isSuccess || orders.isFetching || invalidDates}
        />
      </div>
      <fieldset className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div className="min-w-0 space-y-1.5">
          <Label htmlFor="order-owner">Đơn vị quản lý</Label>
          <select
            id="order-owner"
            className={selectClass}
            value={owner}
            onChange={(event) => {
              setSupplier("");
              setParams({ owner: event.target.value }, { replace: true });
            }}
          >
            {Object.entries(managementOwnerLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-0 space-y-1.5">
          <Label htmlFor="order-status">Trạng thái</Label>
          <select
            id="order-status"
            className={selectClass}
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            <option value="">Tất cả trạng thái</option>
            {Object.entries(orderStatusLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-0 space-y-1.5">
          <Label htmlFor="order-supplier">Nhà cung cấp</Label>
          <select
            id="order-supplier"
            className={selectClass}
            value={supplier}
            onChange={(event) => setSupplier(event.target.value)}
          >
            <option value="">Tất cả nhà cung cấp</option>
            {[...suppliers]
              .sort((a, b) => a[1].localeCompare(b[1], "vi"))
              .map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
          </select>
        </div>
        <div className="min-w-0 space-y-1.5">
          <Label htmlFor="order-from">Đặt từ ngày</Label>
          <Input
            id="order-from"
            type="date"
            value={fromDate}
            onChange={(event) => setFromDate(event.target.value)}
          />
        </div>
        <div className="min-w-0 space-y-1.5">
          <Label htmlFor="order-to">Đặt đến ngày</Label>
          <Input
            id="order-to"
            type="date"
            value={toDate}
            onChange={(event) => setToDate(event.target.value)}
          />
        </div>
      </fieldset>
      {orders.isPending && <p>Đang tải đơn mua...</p>}
      {orders.isError && (
        <OrderLoadError message={orders.error.message} retry={orders.refetch} />
      )}
      {invalidDates && (
        <p id="order-date-error" className="text-sm text-destructive">
          Ngày kết thúc phải bằng hoặc sau ngày bắt đầu.
        </p>
      )}
      {orders.isSuccess &&
        !invalidDates &&
        (filtered.length ? (
          <DataTable columns={columns} data={filtered} />
        ) : (
          <p className="rounded-lg border p-4 text-sm text-muted-foreground">
            {orders.data.length
              ? "Không có đơn phù hợp với bộ lọc."
              : "Chưa có đơn mua cho đơn vị quản lý đã chọn."}
          </p>
        ))}
      <Dialog
        open={Boolean(orderId)}
        onOpenChange={(open) => {
          if (!open) setParams({ owner }, { replace: true });
        }}
      >
        <DialogContent className="max-h-[90dvh] overflow-y-auto wrap-anywhere motion-reduce:animate-none sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Chi tiết đơn mua</DialogTitle>
            <DialogDescription>Tiến độ và giá trị tài sản.</DialogDescription>
          </DialogHeader>
          {orderId && <OrderDetail id={orderId} owner={owner} />}
        </DialogContent>
      </Dialog>
    </section>
  );
}
