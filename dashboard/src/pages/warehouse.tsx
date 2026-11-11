import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/components/auth-provider";
import StatusChip from "@/components/status-chip";
import ExportExcelButton from "@/components/export-excel-button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/data-table";
import { assetStatusLabels } from "@/lib/assets";
import { getItWarehouseAssets } from "@/lib/warehouses";

type WarehouseAsset = Awaited<ReturnType<typeof getItWarehouseAssets>>[number];

export default function WarehousePage() {
  const { token } = useAuth();
  const assets = useQuery({
    queryKey: ["warehouse-assets"],
    queryFn: ({ signal }) => getItWarehouseAssets(signal),
    enabled: Boolean(token),
    retry: false,
    staleTime: 60_000,
  });

  const columns: DataTableColumn<WarehouseAsset>[] = [
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
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Kho IT</h1>
          <p className="mt-2 text-muted-foreground">
            Tài sản đang được lưu giữ tại kho IT.
          </p>
        </div>
        <ExportExcelButton
          fileName="tai-san-kho-it"
          sheetName="Kho IT"
          headers={columns.map((column) => column.header)}
          rows={(assets.data ?? []).map((asset) => [
            asset.assetCode,
            asset.name || "—",
            asset.category || "—",
            assetStatusLabels[asset.status.toLowerCase()] ?? "Chưa xác định",
          ])}
          disabled={!assets.isSuccess || assets.isFetching}
        />
      </div>
      {assets.isError ? (
        <Alert variant="destructive">
          <AlertTitle>Không thể tải danh sách tài sản trong kho</AlertTitle>
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
          tableClassName="min-w-[640px]"
          emptyContent="Kho IT chưa có tài sản."
          loading="Đang tải tài sản trong kho..."
        />
      )}
    </div>
  );
}
