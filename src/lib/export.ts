import * as XLSX from "xlsx";
import { toCsv } from "@/lib/utils";

export type SheetRows = {
  name: string;
  rows: Record<string, unknown>[];
};

export function rowsToCsvResponse(
  rows: Record<string, unknown>[],
  filename: string
) {
  const csv = toCsv(rows);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

export function sheetsToXlsxBuffer(sheets: SheetRows[]) {
  const workbook = XLSX.utils.book_new();

  for (const sheet of sheets) {
    const safeName = sheet.name.slice(0, 31) || "Sheet1";
    const worksheet = XLSX.utils.json_to_sheet(
      sheet.rows.length ? sheet.rows : [{ note: "No data" }]
    );
    XLSX.utils.book_append_sheet(workbook, worksheet, safeName);
  }

  return XLSX.write(workbook, {
    type: "buffer",
    bookType: "xlsx",
  }) as Buffer;
}

export function sheetsToXlsxResponse(sheets: SheetRows[], filename: string) {
  const buffer = sheetsToXlsxBuffer(sheets);
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
