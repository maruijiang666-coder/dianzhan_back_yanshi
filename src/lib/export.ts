import * as XLSX from "xlsx";

export interface ExportSheet {
  name: string;
  rows: Record<string, unknown>[];
}

/** 导出一个或多个 sheet 到 xlsx */
export function exportXlsx(filename: string, sheets: ExportSheet[]) {
  const wb = XLSX.utils.book_new();
  for (const sheet of sheets) {
    const ws = XLSX.utils.json_to_sheet(sheet.rows);
    // 自动列宽
    const keys = Object.keys(sheet.rows[0] ?? {});
    ws["!cols"] = keys.map((k) => ({
      wch: Math.max(
        k.length * 2,
        ...sheet.rows.slice(0, 200).map((r) => String(r[k] ?? "").length * 1.9),
        8,
      ),
    }));
    XLSX.utils.book_append_sheet(wb, ws, sheet.name.slice(0, 31));
  }
  XLSX.writeFile(wb, filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`);
}
