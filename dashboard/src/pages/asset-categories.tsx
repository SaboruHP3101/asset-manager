import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { getAssetCategories } from "@/lib/asset-categories";
import type { AssetCategory } from "@/lib/asset-categories";
import AssetCategoryDialog from "@/components/asset-category-dialog";
import AssetCategoryDeleteDialog from "@/components/asset-category-delete-dialog";
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
        <Button onClick={() => setEditing(null)}>
          <Plus />
          Thêm danh mục
        </Button>
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
        <div className="overflow-hidden rounded-xl border">
          <Table className="min-w-[600px]">
            <TableCaption className="sr-only">
              Danh mục tài sản cấp gốc
            </TableCaption>
            <TableHeader>
              <TableRow>
                {["Mã danh mục", "Tên danh mục", "Mô tả", "Hành động"].map(
                  (label) => (
                    <TableHead
                      key={label}
                      scope="col"
                      className="font-semibold"
                    >
                      {label}
                    </TableHead>
                  )
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {categories.isPending ? (
                <TableRow>
                  <TableCell colSpan={4} className="h-32 text-center">
                    <p role="status">Đang tải danh mục...</p>
                  </TableCell>
                </TableRow>
              ) : roots.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="h-32 text-center text-muted-foreground"
                  >
                    Chưa có danh mục cấp gốc.
                  </TableCell>
                </TableRow>
              ) : (
                roots.map((category) => (
                  <TableRow key={category.id}>
                    <TableCell className="font-medium">
                      {category.code}
                    </TableCell>
                    <TableCell>{category.name}</TableCell>
                    <TableCell className="max-w-sm break-words whitespace-normal">
                      {category.description || "—"}
                    </TableCell>
                    <TableCell>
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
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
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
