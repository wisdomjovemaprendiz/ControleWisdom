import {
  type CourseClass,
  type Student,
  type Profile,
  canAccess,
  today,
} from "./domain";
export type ImportCell = string | number | boolean | Date | null;
export interface ImportRow {
  row: number;
  name: string;
  className: string;
  birthDate: string;
  classId: string;
  unitId: string;
  status: "ready" | "duplicate" | "error";
  detail: string;
}
export function normalized(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/[^\p{L}\p{N}]/gu, "");
}
export function parseBirthDate(value: ImportCell, reference = today()): string {
  if (value === null || value === "") return "";
  let text = "";
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) throw new Error("Nascimento inválido.");
    text = value.toISOString().slice(0, 10);
  } else if (typeof value === "number") {
    if (!Number.isInteger(value) || value < 1 || value > 100000)
      throw new Error("Nascimento inválido.");
    text = new Date(Date.UTC(1899, 11, 30) + value * 86400000)
      .toISOString()
      .slice(0, 10);
  } else {
    const raw = String(value).trim();
    const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(raw);
    text = match ? `${match[3]}-${match[2]}-${match[1]}` : raw;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text))
    throw new Error("Use nascimento em DD/MM/AAAA.");
  const date = new Date(text + "T12:00:00Z");
  if (
    Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== text ||
    text > reference ||
    text < "1900-01-01"
  )
    throw new Error("Nascimento inválido ou no futuro.");
  return text;
}
export function previewStudents(
  rows: ImportCell[][],
  classes: CourseClass[],
  students: Student[],
  profile: Profile,
  unitId: string,
): ImportRow[] {
  if (!canAccess(profile, unitId))
    throw new Error("Sem acesso à unidade selecionada.");
  if (!rows.length) throw new Error("Planilha vazia.");
  if (rows.length > 501) throw new Error("Importe até 500 alunos por arquivo.");
  const headers = rows[0].map((v) => normalized(String(v || "")));
  const find = (aliases: string[]) =>
    headers.findIndex((h) => aliases.includes(h));
  const nameIndex = find(["nome", "aluno", "nomedoaluno", "nomecompleto"]),
    classIndex = find(["turma", "classe", "nomedaturma"]),
    birthIndex = find(["nascimento", "datadenascimento", "aniversario"]);
  if (nameIndex < 0 || classIndex < 0)
    throw new Error("A primeira linha deve conter as colunas Nome e Turma.");
  const allowed = classes.filter((c) => c.unit_id === unitId),
    seen = new Set(
      students
        .filter((s) => s.unit_id === unitId)
        .map((s) => s.class_id + "|" + normalized(s.name)),
    );
  const occupied = new Map(
    allowed.map((c) => [
      c.id,
      students.filter((s) => s.class_id === c.id && s.status === "ativo")
        .length,
    ]),
  );
  return rows.slice(1).flatMap((cells, index) => {
    if (cells.every((c) => c === null || String(c).trim() === "")) return [];
    const name = String(cells[nameIndex] || "")
        .trim()
        .replace(/\s+/g, " "),
      className = String(cells[classIndex] || "").trim();
    const row: ImportRow = {
      row: index + 2,
      name,
      className,
      birthDate: "",
      classId: "",
      unitId,
      status: "error",
      detail: "",
    };
    if (!name || typeof cells[nameIndex] !== "string") {
      row.detail = "Informe um nome em texto.";
      return [row];
    }
    if (name.length > 150) {
      row.detail = "Nome excede 150 caracteres.";
      return [row];
    }
    const matches = allowed.filter(
      (c) => c.id === className || normalized(c.name) === normalized(className),
    );
    if (matches.length !== 1) {
      row.detail = matches.length
        ? "Nome de turma ambíguo. Use o ID da turma."
        : "Turma não encontrada nesta unidade.";
      return [row];
    }
    const group = matches[0];
    row.classId = group.id;
    try {
      row.birthDate = parseBirthDate(
        birthIndex < 0 ? null : (cells[birthIndex] ?? null),
      );
    } catch (e) {
      row.detail = (e as Error).message;
      return [row];
    }
    const key = group.id + "|" + normalized(name);
    if (seen.has(key)) {
      row.status = "duplicate";
      row.detail =
        "Nome já cadastrado nesta turma ou repetido no arquivo. Revise homônimos manualmente.";
      return [row];
    }
    if ((occupied.get(group.id) || 0) >= group.capacity) {
      row.detail = "Turma sem vagas para esta linha.";
      return [row];
    }
    seen.add(key);
    occupied.set(group.id, (occupied.get(group.id) || 0) + 1);
    row.status = "ready";
    row.detail = "Pronto para importar; completar dados depois.";
    return [row];
  });
}
export function importedStudent(row: ImportRow, profile: Profile): Student {
  if (row.status !== "ready" || !row.classId || !canAccess(profile, row.unitId))
    throw new Error("Linha inválida para importação.");
  return {
    id: crypto.randomUUID(),
    unit_id: row.unitId,
    class_id: row.classId,
    offering_id: null,
    name: row.name,
    birth_date: row.birthDate,
    phone: "",
    guardian: "",
    guardian_phone: "",
    email: "",
    address: "",
    created_by: profile.id,
    enrollment_date: today(),
    status: "ativo",
    archive_reason: "",
  };
}
