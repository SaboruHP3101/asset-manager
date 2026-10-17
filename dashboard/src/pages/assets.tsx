import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Pencil } from "lucide-react";
import AssetEditDialog from "@/components/asset-edit-dialog";
import type { Asset } from "@/types";
import { useAuth } from "@/components/auth-provider";
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
import {
  assetDepartmentLabels,
  assetStatusLabels,
  getAssets,
} from "@/lib/assets";

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Tài sản</h1>
        <p className="mt-2 text-muted-foreground">
          Chi tiết tài sản, tình trạng và nơi quản lý.
        </p>
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
        <div className="overflow-hidden rounded-xl border">
          <Table className="min-w-[960px]">
            <TableCaption className="sr-only">Danh sách tài sản</TableCaption>
            <TableHeader>
              <TableRow>
                {[
                  "Mã tài sản",
                  "Tên tài sản",
                  "Danh mục",
                  "Người sử dụng",
                  "Phòng ban",
                  "Vị trí",
                  "Trạng thái",
                  "Hành động",
                ].map((label) => (
                  <TableHead key={label} className="font-semibold" scope="col">
                    {label}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {assets.isPending ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-32 text-center">
                    <p role="status">Đang tải tài sản...</p>
                  </TableCell>
                </TableRow>
              ) : assets.data.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="h-32 text-center text-muted-foreground"
                  >
                    Chưa có tài sản.
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
                    <TableCell>{asset.assignedTo || "—"}</TableCell>
                    <TableCell>
                      {asset.department
                        ? (assetDepartmentLabels[asset.department] ??
                          asset.department)
                        : "—"}
                    </TableCell>
                    <TableCell>{asset.location || "—"}</TableCell>
                    <TableCell>
                      {assetStatusLabels[asset.status.toLowerCase()] ??
                        "Chưa xác định"}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        title="Chỉnh sửa"
                        onClick={() => setEditing(asset)}
                      >
                        <Pencil />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}
      {editing ? (
        <AssetEditDialog asset={editing} onClose={() => setEditing(null)} />
      ) : null}
    </div>
  );
}
