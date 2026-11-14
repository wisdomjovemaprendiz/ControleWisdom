import { jsPDF } from "jspdf";
import autoTable, { type Table } from "jspdf-autotable";
import { displayDate } from "./domain";
import type { StudentReport } from "./student-report";
import type { ReportPhoto } from "./photos";

export async function createStudentReportPdf(
  report: StudentReport,
  author: string,
  photo?: ReportPhoto | null,
) {
  const load = async (path: string) => {
    const response = await fetch(path);
    if (!response.ok)
      throw new Error("Não foi possível carregar os recursos da ficha.");
    return new Uint8Array(await response.arrayBuffer());
  };
  const [logo, regular, bold] = await Promise.all([
    load("/wisdom-logo.jpg"),
    load("/fonts/wisdom-regular.ttf"),
    load("/fonts/wisdom-bold.ttf"),
  ]);
  const base64 = (bytes: Uint8Array) => {
    let text = "";
    for (let i = 0; i < bytes.length; i += 32768)
      text += String.fromCharCode(...bytes.subarray(i, i + 32768));
    return btoa(text);
  };
  const doc = new jsPDF({ unit: "mm", format: "a4", compress: true });
  doc.addFileToVFS("report-regular.ttf", base64(regular));
  doc.addFileToVFS("report-bold.ttf", base64(bold));
  doc.addFont("report-regular.ttf", "StudentReport", "normal");
  doc.addFont("report-bold.ttf", "StudentReport", "bold");
  doc.setProperties({
    title: `${report.title} — ${report.name}`,
    author,
    subject:
      report.audience === "internal"
        ? "Documento interno"
        : "Acompanhamento familiar",
  });
  doc.setFont("StudentReport", "bold");
  doc.setFontSize(17);
  const nameLines = doc.splitTextToSize(
    report.name,
    photo ? 150 : 180,
  ) as string[];
  const nameBottom = 38 + nameLines.length * 7;
  const cardsY = Math.max(nameBottom + 4, photo ? 63 : 0);
  let y = report.metrics.length
    ? cardsY + 29
    : Math.max(nameBottom + 8, photo ? 59 : 0);
  report.sections.forEach((section) => {
    // Keep the section heading with its first row at page boundaries.
    doc.setFont("StudentReport", "bold");
    doc.setFontSize(9);
    const widths =
      section.headers.length === 2
        ? [49, 133]
        : [
            26,
            ...section.headers
              .slice(1)
              .map(() => 156 / (section.headers.length - 1)),
          ];
    const firstRowLines = Math.max(
      1,
      ...(section.rows[0] || []).map(
        (cell, index) => doc.splitTextToSize(cell, widths[index] - 6).length,
      ),
    );
    const firstRowHeight = firstRowLines * 3.7 + 6;
    if (y + firstRowHeight + 24 > 274 && y > 28) {
      doc.addPage();
      y = 28;
    }
    autoTable(doc, {
      startY: y,
      margin: { top: 28, left: 14, right: 14, bottom: 23 },
      head: [
        [
          {
            content: section.title,
            colSpan: section.headers.length,
            styles: {
              fillColor: [21, 57, 102],
              textColor: [255, 255, 255],
              fontSize: 10,
            },
          },
        ],
        section.headers,
      ],
      body: section.rows,
      theme: "grid",
      rowPageBreak: "avoid",
      showHead: "everyPage",
      styles: {
        font: "StudentReport",
        fontSize: 9,
        cellPadding: 3,
        lineWidth: 0.15,
        lineColor: [221, 229, 239],
        textColor: [43, 61, 83],
        overflow: "linebreak",
      },
      headStyles: {
        fontStyle: "bold",
        fillColor: [234, 240, 248],
        textColor: [36, 67, 108],
        fontSize: 8.5,
      },
      alternateRowStyles: { fillColor: [248, 250, 253] },
      columnStyles:
        section.headers.length === 2
          ? { 0: { cellWidth: 49, fontStyle: "bold" } }
          : { 0: { cellWidth: 26 } },
    });
    y =
      (doc as typeof doc & { lastAutoTable: Table }).lastAutoTable.finalY! + 7;
    if (y > 264) {
      doc.addPage();
      y = 28;
    }
  });
  // Remove a trailing page reserved for a section that did not exist.
  if (y === 28 && doc.getNumberOfPages() > 1)
    doc.deletePage(doc.getNumberOfPages());
  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page++) {
    doc.setPage(page);
    doc.setFillColor(13, 64, 139);
    doc.rect(0, 0, 210, 2, "F");
    doc.setFillColor(235, 25, 37);
    doc.rect(175, 0, 35, 2, "F");
    doc.setFont("StudentReport", "bold");
    doc.setTextColor(21, 57, 102);
    if (page === 1) {
      doc.addImage(logo, "JPEG", 172, 7, 24, 16, "student-report-logo");
      doc.setFontSize(11);
      doc.text(report.title, 14, 14);
      doc.setFont("StudentReport", "normal");
      doc.setFontSize(8);
      doc.text(
        doc.splitTextToSize(
          `${report.unit} · Emitido em ${displayDate(report.date)}`,
          150,
        ),
        14,
        21,
      );
      doc.setFont("StudentReport", "bold");
      doc.setFontSize(17);
      doc.text(nameLines, photo ? 41 : 14, 38);
      if (photo)
        doc.addImage(
          photo.data,
          photo.format || "PNG",
          14,
          31,
          21,
          21,
          `student-${photo.id}`,
        );
      report.metrics.forEach((metric, index) => {
        const x = 14 + index * 46;
        doc.setFillColor(239, 244, 251);
        doc.roundedRect(x, cardsY, 43, 22, 2, 2, "F");
        doc.setFont("StudentReport", "normal");
        doc.setFontSize(8);
        doc.setTextColor(80, 101, 130);
        doc.text(metric.label, x + 3, cardsY + 6);
        doc.setFont("StudentReport", "bold");
        doc.setFontSize(metric.value.length > 12 ? 10 : 16);
        doc.setTextColor(21, 57, 102);
        doc.text(metric.value, x + 3, cardsY + 16);
      });
    } else {
      doc.setFontSize(9);
      doc.text((doc.splitTextToSize(report.name, 180) as string[])[0], 14, 12);
      doc.setFont("StudentReport", "normal");
      doc.setFontSize(8);
      doc.text(report.title, 14, 19);
    }
    doc.setDrawColor(214, 223, 235);
    doc.line(14, 278, 196, 278);
    doc.setFont("StudentReport", "normal");
    doc.setFontSize(7);
    doc.setTextColor(89, 106, 130);
    doc.text(doc.splitTextToSize(report.notice, 161), 14, 283);
    doc.text(`${page}/${pages}`, 196, 284, { align: "right" });
    doc.text(`Emissão: ${author}`, 14, 293);
  }
  return doc;
}
