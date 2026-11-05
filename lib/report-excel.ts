import type { ReportCell } from "./custom-reports";
export async function createReportExcel(
  headers: string[],
  rows: ReportCell[][],
  format: "xls" | "xlsx",
) {
  if (rows.length > (format === "xls" ? 65535 : 1048575))
    throw new Error(
      format === "xls"
        ? "XLS aceita até 65.535 alunos. Use XLSX para este relatório."
        : "O relatório excede o limite de linhas do Excel. Reduza os filtros.",
    );
  if (
    [headers, ...rows].some((row) =>
      row.some((cell) => typeof cell === "string" && cell.length > 32767),
    )
  )
    throw new Error(
      "Uma informação excede o limite de texto de uma célula do Excel. Reduza os campos selecionados.",
    );
  const XLSX = await import("xlsx");
  const workbook = XLSX.utils.book_new(),
    sheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  sheet["!cols"] = headers.map((header, index) => ({
    wch: Math.min(
      50,
      Math.max(
        16,
        header.length + 2,
        ...rows.slice(0, 100).map((row) => String(row[index] ?? "").length + 2),
      ),
    ),
  }));
  sheet["!autofilter"] = {
    ref: XLSX.utils.encode_range(
      { r: 0, c: 0 },
      { r: rows.length, c: headers.length - 1 },
    ),
  };
  XLSX.utils.book_append_sheet(workbook, sheet, "Alunos");
  return new Uint8Array(
    XLSX.write(workbook, {
      type: "array",
      bookType: format === "xls" ? "biff8" : "xlsx",
    }),
  );
}
