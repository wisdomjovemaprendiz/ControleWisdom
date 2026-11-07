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
  phone: string;
  guardian: string;
  guardianPhone: string;
  email: string;
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
    const match = /^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})$/.exec(raw);
    text = match
      ? `${match[3]}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}`
      : raw;
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
  options?: { classId?: string; columns: ImportField[]; hasHeader: boolean },
): ImportRow[] {
  if (!canAccess(profile, unitId))
    throw new Error("Sem acesso à unidade selecionada.");
  if (!rows.length) throw new Error("Planilha vazia.");
  const configuration = options || detectImportColumns(rows);
  const columns = configuration.columns;
  const data = rows.slice(configuration.hasHeader ? 1 : 0);
  if (
    data.filter((r) => r.some((c) => c !== null && String(c).trim())).length >
    500
  )
    throw new Error("Importe até 500 alunos por lote.");
  const mapped = columns.filter((c) => c !== "ignore");
  if (new Set(mapped).size !== mapped.length)
    throw new Error(
      "Cada informação deve ter apenas uma coluna. Revise o mapeamento.",
    );
  const nameIndex = columns.indexOf("name"),
    classIndex = columns.indexOf("class"),
    birthIndex = columns.indexOf("birth"),
    phoneIndex = columns.indexOf("phone"),
    guardianIndex = columns.indexOf("guardian"),
    guardianPhoneIndex = columns.indexOf("guardian_phone"),
    emailIndex = columns.indexOf("email");
  if (nameIndex < 0 || (classIndex < 0 && !options?.classId))
    throw new Error(
      "Identifique a coluna Nome e escolha uma turma de destino ou uma coluna Turma.",
    );
  const allowed = classes.filter(
      (c) =>
        c.unit_id === unitId &&
        !c.archived_at &&
        (profile.role !== "professor" || c.teacher_id === profile.id),
    ),
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
  return data.flatMap((cells, index) => {
    if (cells.every((c) => c === null || String(c).trim() === "")) return [];
    const name = String(cells[nameIndex] || "")
        .trim()
        .replace(/\s+/g, " "),
      className = String(cells[classIndex] || "").trim();
    const row: ImportRow = {
      row: index + (configuration.hasHeader ? 2 : 1),
      name,
      className,
      birthDate: "",
      phone: "",
      guardian: "",
      guardianPhone: "",
      email: "",
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
    const matches = allowed.filter((c) =>
      options?.classId
        ? c.id === options.classId
        : c.id === className || normalized(c.name) === normalized(className),
    );
    if (matches.length !== 1) {
      row.detail = matches.length
        ? "Nome de turma ambíguo. Use o ID da turma."
        : "Turma não encontrada nesta unidade.";
      return [row];
    }
    const group = matches[0];
    row.classId = group.id;
    row.className = group.name;
    try {
      row.phone = importPhone(cells[phoneIndex] ?? null);
      row.guardianPhone = importPhone(cells[guardianPhoneIndex] ?? null);
      row.guardian = String(cells[guardianIndex] ?? "").trim();
      row.email = String(cells[emailIndex] ?? "").trim();
      if (row.guardian.length > 150)
        throw new Error("Nome do responsável excede 150 caracteres.");
      if (row.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email))
        throw new Error("E-mail inválido.");
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
    phone: row.phone,
    guardian: row.guardian,
    guardian_phone: row.guardianPhone,
    email: row.email,
    address: "",
    created_by: profile.id,
    enrollment_date: today(),
    status: "ativo",
    archive_reason: "",
  };
}

export const importFields = {
  ignore: "Ignorar",
  name: "Nome do aluno",
  class: "Turma",
  birth: "Data de nascimento",
  phone: "Telefone do aluno",
  guardian: "Nome do responsável",
  guardian_phone: "Telefone do responsável",
  email: "E-mail",
} as const;
export type ImportField = keyof typeof importFields;
const headerAliases: Record<ImportField, string[]> = {
  ignore: [],
  name: [
    "nome",
    "aluno",
    "alunos",
    "nomedoaluno",
    "nomesdosalunos",
    "nomecompleto",
    "estudante",
  ],
  class: ["turma", "classe", "nomedaturma"],
  birth: [
    "nascimento",
    "datadenascimento",
    "datanascimento",
    "aniversario",
    "dn",
  ],
  phone: [
    "telefone",
    "celular",
    "whatsapp",
    "fone",
    "contato",
    "telefonedoaluno",
    "telefonealuno",
    "celulardoaluno",
  ],
  guardian: ["responsavel", "nomedoresponsavel", "nomeresponsavel"],
  guardian_phone: [
    "telefonedoresponsavel",
    "telefoneresponsavel",
    "celulardoresponsavel",
    "whatsappdoresponsavel",
  ],
  email: ["email", "emaildoaluno"],
};
export function importPhone(value: ImportCell) {
  if (value === null || value === "") return "";
  const text = String(value).trim(),
    digits = text.replace(/\D/g, "");
  if (!/^[+\d\s().-]+$/.test(text) || digits.length < 10 || digits.length > 15)
    throw new Error(
      "Telefone inválido. Revise a coluna ou deixe o campo vazio.",
    );
  return digits;
}
export function detectImportColumns(
  rows: ImportCell[][],
  classes: CourseClass[] = [],
) {
  const first = rows[0] || [];
  const header = first.map(
    (v) =>
      (Object.keys(headerAliases) as ImportField[]).find((key) =>
        headerAliases[key].includes(normalized(String(v ?? ""))),
      ) || "ignore",
  );
  const hasHeader =
    header.includes("name") || header.filter((v) => v !== "ignore").length >= 2;
  const used = new Set<ImportField>();
  const width = Math.max(0, ...rows.slice(0, 501).map((r) => r.length));
  if (width > 30)
    throw new Error("Selecione no máximo 30 colunas por importação.");
  const columns: ImportField[] = Array.from({ length: width }, (_, index) => {
    let field: ImportField = hasHeader ? header[index] || "ignore" : "ignore";
    const sample = rows
      .slice(hasHeader ? 1 : 0)
      .map((r) => r[index])
      .filter((v) => v !== null && v !== undefined && String(v).trim())
      .slice(0, 20);
    if (!hasHeader && sample.length) {
      if (
        sample.every(
          (v) =>
            v instanceof Date ||
            (typeof v === "string" &&
              /^(?:\d{1,2}[/.\-]\d{1,2}[/.\-]\d{4}|\d{4}-\d{2}-\d{2})$/.test(
                v.trim(),
              )) ||
            (typeof v === "number" && v > 1000 && v < 100000),
        )
      )
        field = "birth";
      else if (
        sample.every((v) => {
          try {
            return !!importPhone(v ?? null);
          } catch {
            return false;
          }
        })
      )
        field = "phone";
      else if (
        sample.every(
          (v) => typeof v === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
        )
      )
        field = "email";
      else if (
        sample.every((v) =>
          classes.some(
            (c) =>
              c.id === String(v) ||
              normalized(c.name) === normalized(String(v)),
          ),
        )
      )
        field = "class";
      else if (
        !used.has("name") &&
        sample.every((v) => typeof v === "string" && /\p{L}/u.test(v))
      )
        field = "name";
    }
    if (field !== "ignore" && used.has(field)) return "ignore";
    used.add(field);
    return field;
  });
  return { columns, hasHeader };
}
// Clipboard tables use tabs. Delimited text and plain Word lists are also accepted.
export function parsePastedStudents(text: string): ImportCell[][] {
  if (text.length > 200000)
    throw new Error("A lista é muito grande. Cole até 500 alunos por lote.");
  const cleaned = text
    .replace(/^\uFEFF/, "")
    .replace(/\r\n?/g, "\n")
    .replace(/^\n+|\n+$/g, "");
  if (!cleaned.trim()) return [];
  const first = cleaned.split("\n").find((line) => line.trim()) || "";
  const delimiter = ["\t", ";", "|", ","].find((d) => first.includes(d));
  let rows: ImportCell[][];
  if (delimiter) {
    rows = [];
    let row: string[] = [],
      cell = "",
      quoted = false;
    for (let i = 0; i <= cleaned.length; i++) {
      const c = cleaned[i];
      if (c === '"' && (quoted || !cell)) {
        if (quoted && cleaned[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = !quoted;
      } else if (
        !quoted &&
        (c === delimiter || c === "\n" || c === undefined)
      ) {
        row.push(cell.trim());
        cell = "";
        if (c !== delimiter) {
          rows.push(row);
          row = [];
        }
      } else if (c !== undefined) cell += c;
    }
    if (quoted)
      throw new Error("Há aspas abertas na lista. Confira o texto colado.");
  } else {
    rows = cleaned
      .split("\n")
      .filter((line) => line.trim())
      .map((line) => {
        const value = line.trim().replace(/^(?:[•●▪*–-]\s+|\d+[.)]\s+)/, "");
        // Preserve names with single spaces. Extract clearly delimited dates/phones only.
        const birth =
          /(?:^|\s)(\d{1,2}[/.\-]\d{1,2}[/.\-]\d{4}|\d{4}-\d{2}-\d{2})(?=\s|$)/.exec(
            value,
          );
        const withoutBirth = birth
          ? value.replace(birth[0], " ").trim()
          : value;
        const phone = /(?:^|\s)([+()]?\d[\d ().-]{8,}\d)$/.exec(withoutBirth);
        const name = phone
          ? withoutBirth.slice(0, phone.index).trim()
          : withoutBirth;
        if (birth || phone) return [name, birth?.[1] || "", phone?.[1] || ""];
        return [value];
      });
  }
  rows = rows.filter((r) => r.some((v) => String(v ?? "").trim()));
  if (rows.length > 501) throw new Error("Importe até 500 alunos por lote.");
  return rows;
}
