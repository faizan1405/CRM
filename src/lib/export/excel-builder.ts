import ExcelJS from "exceljs";
import type { ColumnDefinition } from "./types";

/**
 * Builds an Excel (.xlsx) file in-memory using exceljs.
 * - Cells for monetary and numeric fields remain purely numeric so formulas and sums work.
 * - Column widths and headers are styled cleanly.
 * - Fully compatible with Vercel serverless (zero file system writes).
 */
export async function buildExcelBuffer<T>(
  sheetName: string,
  data: T[],
  columns: ColumnDefinition<T>[]
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Scale Flow CRM";
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet(sheetName, {
    views: [{ state: "frozen", ySplit: 1 }], // Freeze header row
  });

  // Setup columns
  worksheet.columns = columns.map((col) => ({
    header: col.header,
    key: col.key,
    width: col.width || Math.max(col.header.length + 4, 14),
  }));

  // Style Header Row
  const headerRow = worksheet.getRow(1);
  headerRow.height = 26;
  headerRow.eachCell((cell) => {
    cell.font = {
      name: "Segoe UI",
      size: 10,
      bold: true,
      color: { argb: "FF0F172A" }, // Slate 900
    };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFF1F5F9" }, // Slate 100
    };
    cell.alignment = {
      vertical: "middle",
      horizontal: "left",
      wrapText: false,
    };
    cell.border = {
      bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
    };
  });

  // Add Data Rows
  for (const item of data) {
    const rowValues: Record<string, unknown> = {};
    for (const col of columns) {
      const val = col.getValue(item);
      if (col.isNumeric && val !== null && val !== undefined && val !== "" && !isNaN(Number(val))) {
        rowValues[col.key] = Number(val);
      } else {
        rowValues[col.key] = val ?? "";
      }
    }

    const row = worksheet.addRow(rowValues);
    row.height = 20;

    // Apply cell styles per column
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      const colDef = columns[colNumber - 1];
      cell.font = {
        name: "Segoe UI",
        size: 9.5,
        color: { argb: "FF334155" }, // Slate 700
      };
      cell.alignment = {
        vertical: "middle",
        horizontal: colDef?.isNumeric ? "right" : "left",
      };

      if (colDef?.isNumeric && typeof cell.value === "number") {
        cell.numFmt = colDef.numFmt || "#,##0.00";
      }
    });
  }

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}
