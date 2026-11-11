import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { getAssetCategories } from "@/lib/asset-categories";
import type { AssetCategory } from "@/lib/asset-categories";
import AssetCategoryDialog from "@/components/asset-category-dialog";
import AssetCategoryDeleteDialog from "@/components/asset-category-delete-dialog";
import ExportExcelButton from "@/components/export-excel-button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/data-table";

export default function AssetCategoriesPage() {
  const [editing, setEditing] = useState<AssetCategory | null | undefined>();
  const [deleting, setDeleting] = useState<AssetCategory | null>(null);
  const categories = useQuery({
    queryKey: ["asset-categories"],
    queryFn: ({ signal }) => getAssetCategories(signal),
    retry: false,
    staleTime: 60_000,
  });

  const descendants = useMemo(() => {
    const descendants: AssetCategory[] = [];

    if (deleting) {
      const ids = new Set([deleting.id]);

      for (const parentId of ids) {
        for (const category of categories.data ?? []) {
          if (category.parentCategoryId === parentId && !ids.has(category.id)) {
            ids.add(category.id);
            descendants.push(category);
          }
        }
      }
    }

    return descendants;
  }, [deleting, categories.data]);

  const roots =
    categories.data?.filter((category) => category.parentCategoryId === null) ??
    [];

  const columns: DataTableColumn<AssetCategory>[] = [
    {
      id: "code",
      header: "Mã danh mục",
      cell: (category) => category.code,
      cellClassName: "font-medium",
    },
    { id: "name", header: "Tên danh mục", cell: (category) => category.name },
    {
      id: "description",
      header: "Mô tả",
      cell: (category) => category.description || "—",
      cellClassName: "max-w-sm break-words whitespace-normal",
    },
    {
      id: "actions",
      header: "Hành động",
      cell: (category) => (
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setEditing(category)}
          >
            <Pencil />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setDeleting(category)}
          >
            <Trash2 />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Danh mục tài sản
          </h1>
          <p className="mt-2 text-muted-foreground">
            Quản lý danh mục tài sản cấp gốc.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ExportExcelButton
            fileName="danh-muc-tai-san"
            sheetName="Danh mục tài sản"
            headers={columns
              .filter((column) => column.id !== "actions")
              .map((column) => column.header)}
            rows={roots.map((category) => [
              category.code,
              category.name,
              category.description || "—",
            ])}
            disabled={!categories.isSuccess || categories.isFetching}
          />
          <Button onClick={() => setEditing(null)}>
            <Plus />
            Thêm danh mục
          </Button>
        </div>
      </div>
      {categories.isError ? (
        <Alert variant="destructive">
          <AlertTitle>Không thể tải danh sách danh mục</AlertTitle>
          <AlertDescription>
            <p>{categories.error.message}</p>
            <Button
              variant="outline"
              className="mt-3"
              disabled={categories.isFetching}
              onClick={() => categories.refetch()}
            >
              {categories.isFetching ? "Đang tải..." : "Thử lại"}
            </Button>
          </AlertDescription>
        </Alert>
      ) : (
        <DataTable
          columns={columns}
          data={roots}
          tableClassName="min-w-[600px]"
          emptyContent="Chưa có danh mục cấp gốc."
          loading="Đang tải danh mục..."
        />
      )}
      {editing !== undefined ? (
        <AssetCategoryDialog
          category={editing}
          onClose={() => setEditing(undefined)}
        />
      ) : null}
      {deleting ? (
        <AssetCategoryDeleteDialog
          category={deleting}
          children={descendants}
          onClose={() => setDeleting(null)}
        />
      ) : null}
    </div>
  );
}
