import { jsPDF } from "jspdf";
import type { Store, Student } from "./domain";
import { displayDate, studentDisplayName, today } from "./domain";
import { weekdays } from "./individual";
import type { ReportPhoto } from "./photos";
import {
  scheduleTimeLabel,
  calendarKinds,
  paginateSignatureMonths,
  signatureMonths,
  studentWeekdays,
  type SignatureRow,
} from "./school-calendar";

async function assets() {
  const load = async (path: string) => {
    const response = await fetch(path);
    if (!response.ok)
      throw new Error("Não foi possível carregar a logo ou a fonte da ficha.");
    return new Uint8Array(await response.arrayBuffer());
  };
  const [logo, normal, bold] = await Promise.all([
    load("/wisdom-logo.jpg"),
    load("/fonts/wisdom-regular.ttf"),
    load("/fonts/wisdom-bold.ttf"),
  ]);
  const base64 = (bytes: Uint8Array) => {
    let binary = "";
    for (let i = 0; i < bytes.length; i += 32768)
      binary += String.fromCharCode(...bytes.subarray(i, i + 32768));
    return btoa(binary);
  };
  return { logo, normal: base64(normal), bold: base64(bold) };
}
export async function createSignatureSheetPdf({
  store,
  student,
  from,
  to,
  photo,
}: {
  store: Store;
  student: Student;
  from: string;
  to: string;
  photo?: ReportPhoto | null;
}) {
  const months = signatureMonths(store, student, from, to);
  const { logo, normal, bold } = await assets();
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
    compress: true,
  });
  doc.addFileToVFS("sheet-normal.ttf", normal);
  doc.addFont("sheet-normal.ttf", "WisdomSheet", "normal");
  doc.addFileToVFS("sheet-bold.ttf", bold);
  doc.addFont("sheet-bold.ttf", "WisdomSheet", "bold");
  doc.setProperties({
    title: `Ficha avaliativa — ${studentDisplayName(student)}`,
    author: "Wisdom Cursos",
    subject: `Ficha de assinatura e avaliação ${from} a ${to}`,
  });
  const margin = 12,
    width = 186,
    bottom = 278,
    columns = [22, 76, 48, 40];
  const group = store.classes.find((c) => c.id === student.class_id),
    unit = store.units.find((u) => u.id === student.unit_id);
  const course = store.offerings.find(
    (o) => o.id === (student.offering_id || group?.offering_id),
  );
  const teacher =
    student.enrollment_mode === "individual"
      ? store.profiles.find((p) => p.id === student.individual_teacher_id)?.name
      : group?.teacher;
  const days = studentWeekdays(store, student)
    .map((day) => weekdays[day])
    .join(" e ");
  const period =
    from === to
      ? months[0].label
      : `${months[0].label} a ${months.at(-1)!.label}`;
  const schedule = group
    ? `Horário: ${scheduleTimeLabel(group.schedule) || scheduleTimeLabel(group.name) || "Não informado"}`
    : student.individual_duration_minutes
      ? `Duração: ${student.individual_duration_minutes} minutos`
      : "Horário não informado";
  const lessonLabel = `Dias de aula: ${days} · ${schedule}`;
  function header(continuation = false, draw = true) {
    let y = continuation ? 12 : 24;
    const indent = !continuation && photo ? 18 : 0;
    function textBlock(
      text: string,
      size: number,
      bold: boolean,
      available: number,
      x = margin,
    ) {
      doc.setFont("WisdomSheet", bold ? "bold" : "normal");
      doc.setFontSize(size);
      doc.setTextColor(20, 55, 104);
      const lines = doc.splitTextToSize(text, available) as string[];
      const lineHeight = size * 0.3528 * 1.2;
      if (draw) doc.text(lines, x, y);
      y += lines.length * lineHeight + 1.5;
    }
    if (!continuation && draw) {
      doc.setFillColor(13, 64, 139);
      doc.rect(0, 0, 210, 2, "F");
      doc.setFillColor(237, 25, 37);
      doc.rect(175, 0, 35, 2, "F");
      doc.addImage(logo, "JPEG", 172, 6, 26, 17, "wisdom-sheet-logo");
      doc.setFont("WisdomSheet", "bold");
      doc.setTextColor(20, 55, 104);
      doc.setFontSize(11);
      doc.text("FICHA AVALIATIVA DO ALUNO", margin, 13);
      if (photo)
        doc.addImage(
          photo.data,
          photo.format || "PNG",
          margin,
          20,
          14,
          14,
          `sheet-student-${student.id}`,
        );
    }
    textBlock(
      studentDisplayName(student),
      continuation ? 10.5 : 13,
      true,
      (continuation ? width : 154) - indent,
      margin + indent,
    );
    textBlock(
      lessonLabel,
      continuation ? 9 : 11,
      !continuation,
      width - indent,
      margin + indent,
    );
    if (continuation) return y + 1;
    if (photo) y = Math.max(y, 37);
    y += 1;
    function pair(left: string, right: string) {
      doc.setFont("WisdomSheet", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(32, 49, 72);
      const first = doc.splitTextToSize(left, 91) as string[];
      const second = doc.splitTextToSize(right, 91) as string[];
      if (draw) {
        doc.text(first, margin, y);
        doc.text(second, 107, y);
      }
      y += Math.max(first.length, second.length) * 3.6 + 1.3;
    }
    pair(
      `Turma: ${student.enrollment_mode === "individual" ? "Aulas individuais" : group?.name || "Não informada"}`,
      `Curso: ${course?.name || group?.course || "Não informado"}`,
    );
    pair(
      `Responsável: ${student.guardian || "Não informado"}`,
      `Telefone do responsável: ${student.guardian_phone || "Não informado"}`,
    );
    pair(
      `Unidade: ${unit?.name || "Não informada"}`,
      `Professor(a): ${teacher || "Não informado"}`,
    );
    pair(
      `Telefone do aluno: ${student.phone || "Não informado"}`,
      `Nascimento: ${student.birth_date ? displayDate(student.birth_date) : "Não informado"}`,
    );
    textBlock(`Período: ${period}`, 8, false, width);
    return y + 1;
  }
  const startY = header(false, false);
  const continuationY = header(true, false);
  const closureText = (row: Extract<SignatureRow, { kind: "day" }>) =>
    "SEM AULA — " +
    [
      ...new Set(
        row.day.closures.map(
          (event) => `${calendarKinds[event.kind]}: ${event.title}`,
        ),
      ),
    ].join(" · ");
  const rowHeight = (row: SignatureRow) => {
    if (row.kind === "month") return 7;
    doc.setFont("WisdomSheet", "normal");
    doc.setFontSize(8);
    const lines = row.day.closures.length
      ? doc.splitTextToSize(closureText(row), width - columns[0] - 6).length
      : 1;
    return Math.max(13, lines * 3.7 + 4);
  };
  const pages = paginateSignatureMonths(
    months,
    (pageIndex) => bottom - (pageIndex ? continuationY : startY) - 10,
    rowHeight,
  );
  pages.forEach((rows, pageIndex) => {
    if (pageIndex) doc.addPage();
    let y = header(pageIndex > 0);
    doc.setFillColor(19, 64, 123);
    doc.rect(margin, y, width, 9, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("WisdomSheet", "bold");
    doc.setFontSize(8);
    let x = margin;
    [
      "DATA",
      "CONTEÚDO DA AULA",
      "ASSINATURA DO ALUNO",
      "GOSTOU DA AULA?",
    ].forEach((label, i) => {
      doc.text(label, x + 3, y + 5.7);
      x += columns[i];
    });
    y += 9;
    rows.forEach((row) => {
      const h = rowHeight(row);
      doc.setDrawColor(188, 201, 219);
      doc.setLineWidth(0.2);
      if (row.kind === "month") {
        doc.setFillColor(233, 239, 248);
        doc.rect(margin, y, width, h, "FD");
        doc.setFont("WisdomSheet", "bold");
        doc.setFontSize(8.5);
        doc.setTextColor(23, 61, 111);
        doc.text(row.label.toLocaleUpperCase("pt-BR"), margin + 3, y + 4.6);
      } else {
        const closed = row.day.closures.length > 0;
        if (closed) {
          const recess = row.day.closures.some((e) => e.kind === "recess");
          doc.setFillColor(
            ...((recess ? [252, 245, 226] : [251, 234, 235]) as [
              number,
              number,
              number,
            ]),
          );
          doc.rect(margin, y, width, h, "F");
        }
        doc.rect(margin, y, width, h);
        doc.line(margin + columns[0], y, margin + columns[0], y + h);
        doc.setFont("WisdomSheet", "normal");
        doc.setFontSize(8);
        doc.setTextColor(31, 52, 78);
        doc.text(displayDate(row.day.date), margin + 2.5, y + 5);
        doc.setFontSize(7);
        doc.setTextColor(117, 130, 147);
        doc.text(
          new Intl.DateTimeFormat("pt-BR", {
            weekday: "short",
            timeZone: "UTC",
          }).format(new Date(row.day.date + "T12:00:00Z")),
          margin + 2.5,
          y + 9.5,
        );
        if (closed) {
          doc.setFont("WisdomSheet", "bold");
          doc.setFontSize(8);
          doc.setTextColor(143, 66, 61);
          doc.text(
            doc.splitTextToSize(closureText(row), width - columns[0] - 6),
            margin + columns[0] + 3,
            y + 5,
          );
        } else {
          let columnX = margin + columns[0];
          for (const column of columns.slice(1, -1)) {
            columnX += column;
            doc.line(columnX, y, columnX, y + h);
          }
        }
      }
      y += h;
    });
  });
  const count = doc.getNumberOfPages();
  for (let page = 1; page <= count; page++) {
    doc.setPage(page);
    doc.setDrawColor(218, 225, 235);
    doc.line(margin, 283, 198, 283);
    doc.setFont("WisdomSheet", "normal");
    doc.setFontSize(7);
    doc.setTextColor(116, 129, 147);
    doc.text(
      "Linhas destacadas: dias sem aula. Demais campos para preenchimento manual.",
      margin,
      288,
    );
    doc.text(
      `Emitido em ${displayDate(today())} · ${page}/${count}`,
      198,
      292,
      { align: "right" },
    );
  }
  return doc;
}
