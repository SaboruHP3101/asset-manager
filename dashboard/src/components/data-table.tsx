import type { ReactNode } from "react";
import { cn } from "cn";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export type DataTableColumn<T> = {
  id: string;
  header: string;
  cell: (row: T) => ReactNode;
  headerClassName?: string;
  cellClassName?: string;
};

export function DataTable<T extends { id: string | number }>({
  columns,
  data,
  emptyContent,
  loading,
  tableClassName,
}: {
  columns: DataTableColumn<T>[];
  data: T[];
  emptyContent?: string;
  loading?: string;
  tableClassName?: string;
}) {
  const isEmptyRow = data.length === 0;

  return (
    <div className="min-w-0 overflow-hidden rounded-lg border bg-card text-card-foreground">
      <Table className={tableClassName}>
        <TableHeader className="bg-muted/60">
          <TableRow className="hover:bg-transparent">
            {columns.map((column) => (
              <TableHead
                key={column.id}
                scope="col"
                className={cn(
                  "h-11 px-4 font-semibold",
                  column.headerClassName
                )}
              >
                {column.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading && isEmptyRow && (
            <TableRow className="hover:bg-transparent">
              <TableCell
                colSpan={columns.length}
                className="h-32 text-center text-muted-foreground"
              >
                <p>{loading}</p>
              </TableCell>
            </TableRow>
          )}
          {!loading && isEmptyRow && emptyContent && (
            <TableRow className="hover:bg-transparent">
              <TableCell
                colSpan={columns.length}
                className="h-32 text-center text-muted-foreground"
              >
                {emptyContent}
              </TableCell>
            </TableRow>
          )}
          {data.map((row) => (
            <TableRow key={row.id} className="focus-within:bg-muted/50">
              {columns.map((column) => (
                <TableCell
                  key={column.id}
                  className={cn("px-4 py-2.5", column.cellClassName)}
                >
                  {column.cell(row)}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
