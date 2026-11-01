import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/components/auth-provider";
import AssetStatusChip from "@/components/asset-status-chip";
import ExportExcelButton from "@/components/export-excel-button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getItWarehouseAssets } from "@/lib/warehouses";
import { assetStatusLabels } from "@/lib/assets";

const columns = ["Mã tài sản", "Tên tài sản", "Danh mục", "Trạng thái"];

export default function WarehousePage() {
  const { token } = useAuth();
  const assets = useQuery({
    queryKey: ["warehouse-assets"],
    queryFn: ({ signal }) => getItWarehouseAssets(signal),
    enabled: Boolean(token),
    retry: false,
    staleTime: 60_000,
  });

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
          headers={columns}
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
        <div className="overflow-hidden rounded-xl border">
          <Table className="min-w-[640px]">
            <TableCaption className="sr-only">
              Tài sản trong kho IT
            </TableCaption>
            <TableHeader>
              <TableRow>
                {columns.map((label) => (
                  <TableHead key={label} className="font-semibold" scope="col">
                    {label}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {assets.isPending ? (
                <TableRow>
                  <TableCell colSpan={4} className="h-32 text-center">
                    <p role="status">Đang tải tài sản trong kho...</p>
                  </TableCell>
                </TableRow>
              ) : assets.data.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="h-32 text-center text-muted-foreground"
                  >
                    Kho IT chưa có tài sản.
                  </TableCell>
                </TableRow>
              ) : (
                assets.data.map((asset) => (
                  <TableRow key={asset.id}>
                    <TableCell className="font-medium">
                      {asset.assetCode}
                    </TableCell>
                    <TableCell>{asset.name || "—"}</TableCell>
                    <TableCell>{asset.category || "—"}</TableCell>
                    <TableCell>
                      <AssetStatusChip status={asset.status} />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
