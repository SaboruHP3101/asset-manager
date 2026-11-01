import { useState } from "react";
import { FileSpreadsheet, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { createExcelFile } from "@/lib/export-excel";

export default function ExportExcelButton({
  fileName,
  sheetName,
  headers,
  rows,
  disabled,
}: {
  fileName: string;
  sheetName: string;
  headers: string[];
  rows: string[][];
  disabled: boolean;
}) {
  const [exporting, setExporting] = useState(false);
  const toast = useToast();

  async function handleExport() {
    setExporting(true);

    try {
      const blob = await createExcelFile(sheetName, headers, rows);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = url;
      link.download = `${fileName}.xlsx`;
      link.click();

      setTimeout(() => URL.revokeObjectURL(url), 1_000);

      toast.success("Đã tạo file Excel.");
    } catch {
      toast.error("Không thể xuất Excel. Vui lòng thử lại.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      disabled={disabled || exporting || rows.length === 0}
      aria-busy={exporting}
      onClick={handleExport}
    >
      {exporting ? (
        <LoaderCircle className="animate-spin" aria-hidden="true" />
      ) : (
        <FileSpreadsheet aria-hidden="true" />
      )}
      {exporting ? "Đang xuất..." : "Xuất Excel"}
    </Button>
  );
}
