import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { displayDate, today } from "./domain";
const clean = (text: string) =>
  text
    .replace(/[\p{Extended_Pictographic}\uFE0F]/gu, "")
    .replace(/[━]/g, "")
    .replace(/\*/g, "")
    .replace(/^_|_$/g, "")
    .trim();
async function logoData() {
  const response = await fetch("/wisdom-logo.jpg");
  if (!response.ok)
    throw new Error("Não foi possível carregar a marca para o relatório.");
  return new Uint8Array(await response.arrayBuffer());
}
function headers(title: string, count: number) {
  const low = title.toLocaleLowerCase("pt-BR");
  const map: Record<string, string[]> = {
    "frequência e faltas": [
      "Aluno",
      "Turma",
      "Presenças",
      "Faltas",
      "Atrasos",
      "Justificadas",
    ],
    "atividade da equipe": [
      "Colaborador",
      "Perfil",
      "Aulas",
      "Matrículas",
      "Pedagógico",
      "Contatos",
    ],
    "panorama da gestão": ["Turma / ocupação", "Professor"],
    "acompanhamento pedagógico": ["Data", "Aluno", "Turma", "Registro"],
    "resumo da aula": ["Aluno", "Situação"],
  };
  return map[low]?.length === count
    ? map[low]
    : Array.from({ length: count }, (_, i) =>
        i === 0 ? "Registro" : i === 1 ? "Informação" : `Detalhe ${i}`,
      );
}
export async function createInstitutionalPdf({
  title,
  lines,
  unit,
  author,
}: {
  title: string;
  lines: string[];
  unit: string;
  author: string;
}) {
  const logo = await logoData();
  const doc = new jsPDF({
    orientation: title === "Atividade da equipe" ? "landscape" : "portrait",
  });
  const width = doc.internal.pageSize.getWidth(),
    height = doc.internal.pageSize.getHeight();
  const fontBase64 = async (path: string) => {
    const response = await fetch(path);
    if (!response.ok)
      throw new Error("Não foi possível carregar a fonte institucional.");
    const bytes = new Uint8Array(await response.arrayBuffer());
    let binary = "";
    for (let i = 0; i < bytes.length; i += 32768)
      binary += String.fromCharCode(...bytes.subarray(i, i + 32768));
    return btoa(binary);
  };
  const [regular, bold] = await Promise.all([
    fontBase64("/fonts/wisdom-regular.ttf"),
    fontBase64("/fonts/wisdom-bold.ttf"),
  ]);
  doc.addFileToVFS("wisdom-regular.ttf", regular);
  doc.addFont("wisdom-regular.ttf", "Wisdom", "normal");
  doc.addFileToVFS("wisdom-bold.ttf", bold);
  doc.addFont("wisdom-bold.ttf", "Wisdom", "bold");
  doc.setProperties({
    title: `${title} • Wisdom Cursos`,
    author: "Wisdom Cursos",
    subject: "Relatório acadêmico",
  });
  const header = () => {
    doc.setFillColor(11, 64, 142);
    doc.rect(0, 0, width, 2.5, "F");
    doc.setFillColor(239, 29, 43);
    doc.rect(width - 35, 0, 35, 2.5, "F");
    doc.addImage(logo, "JPEG", 16, 9, 39, 25, "wisdom-logo");
    doc.setFont("Wisdom", "bold");
    doc.setFontSize(8);
    doc.setTextColor(11, 64, 142);
    doc.text("WISDOM CURSOS / CONTROLE ACADÊMICO", 63, 16);
    doc.setFont("Wisdom", "normal");
    doc.setFontSize(8);
    doc.setTextColor(106, 119, 136);
    doc.text(doc.splitTextToSize(unit, width - 83), 63, 22);
    doc.text(`Emitido em ${displayDate(today())}`, 63, 29);
    doc.setDrawColor(224, 230, 237);
    doc.line(16, 38, width - 16, 38);
    doc.setTextColor(24, 44, 72);
    doc.setFont("Wisdom", "bold");
    doc.setFontSize(18);
    doc.text(title, 16, 49);
    doc.setFont("Wisdom", "normal");
    doc.setFontSize(8);
    doc.setTextColor(125, 138, 154);
    doc.text(`Responsável pela emissão: ${author}`, 16, 56);
  };
  let y = 64;
  const segments: { table: boolean; lines: string[] }[] = [];
  for (const line of lines.filter(Boolean)) {
    const isTable = line.includes(" | "),
      last = segments.at(-1);
    if (last && last.table === isTable) last.lines.push(line);
    else segments.push({ table: isTable, lines: [line] });
  }
  if (!segments.length)
    segments.push({
      table: false,
      lines: ["Nenhum registro encontrado para os filtros selecionados."],
    });
  for (const segment of segments) {
    if (
      title === "Panorama da gestão" &&
      !segment.table &&
      segment === segments[0]
    ) {
      const cards = segment.lines.filter((line) => line.includes(":"));
      const gap = 4,
        cardWidth = (width - 32 - gap * 2) / 3;
      cards.forEach((line, index) => {
        const [label, ...value] = line.split(":"),
          x = 16 + (index % 3) * (cardWidth + gap),
          cy = y + Math.floor(index / 3) * 25;
        doc.setFillColor(244, 247, 252);
        doc.roundedRect(x, cy, cardWidth, 21, 2, 2, "F");
        doc.setFont("Wisdom", "normal");
        doc.setFontSize(8);
        doc.setTextColor(123, 143, 169);
        doc.text(label.trim(), x + 4, cy + 6);
        doc.setFont("Wisdom", "bold");
        doc.setFontSize(16);
        doc.setTextColor(24, 61, 108);
        doc.text(value.join(":").trim(), x + 4, cy + 15);
      });
      y += Math.ceil(cards.length / 3) * 25 + 7;
      continue;
    }
    const count = segment.table
      ? Math.max(...segment.lines.map((l) => l.split(" | ").length))
      : 1;
    autoTable(doc, {
      startY: y,
      margin: { top: 64, left: 16, right: 16, bottom: 20 },
      head: [
        segment.table ? headers(title, count) : ["INFORMAÇÕES DO RELATÓRIO"],
      ],
      body: segment.lines.map((line) =>
        segment.table
          ? line
              .split(" | ")
              .map((cell, i) =>
                clean(i >= 2 ? cell.replace(/^[^:]+:\s*/, "") : cell),
              )
          : [clean(line)],
      ),
      theme: "plain",
      styles: {
        font: "Wisdom",
        fontSize: segment.table ? 8.5 : 9,
        cellPadding: segment.table
          ? { top: 1.3, bottom: 1.3, left: 3, right: 3 }
          : 4,
        textColor: [65, 83, 107],
        lineColor: [229, 234, 240],
        lineWidth: 0.15,
        overflow: "linebreak",
      },
      headStyles: {
        fillColor: [16, 47, 88],
        textColor: [255, 255, 255],
        fontSize: 8,
        fontStyle: "bold",
        cellPadding: segment.table ? 3 : 4,
      },
      alternateRowStyles: { fillColor: [245, 248, 252] },
      columnStyles: segment.table
        ? { 0: { fontStyle: "bold", textColor: [31, 62, 101] } }
        : {},
      willDrawPage: header,
    });
    y =
      (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable
        .finalY + 9;
  }
  const total = doc.getNumberOfPages();
  for (let page = 1; page <= total; page++) {
    doc.setPage(page);
    doc.setDrawColor(221, 229, 239);
    doc.line(16, height - 16, width - 16, height - 16);
    doc.setFont("Wisdom", "normal");
    doc.setFontSize(7);
    doc.setTextColor(133, 146, 163);
    doc.text("WISDOM CURSOS • Relatório acadêmico", 16, height - 10);
    doc.text(
      `${String(page).padStart(2, "0")} / ${String(total).padStart(2, "0")}`,
      width - 16,
      height - 10,
      { align: "right" },
    );
  }
  return doc;
}
