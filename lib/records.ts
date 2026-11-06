import type { Store } from "./domain";
export const recordTables = [
  "students",
  "units",
  "offerings",
  "classes",
  "profiles",
  "lessons",
  "attendance",
  "pedagogy",
  "contacts",
] as const;
export type RecordTable = (typeof recordTables)[number];
export const recordLabels: Record<RecordTable, string> = {
  students: "Alunos",
  units: "Unidades",
  offerings: "Cursos e pacotes",
  classes: "Turmas",
  profiles: "Usuários",
  lessons: "Aulas",
  attendance: "Presenças",
  pedagogy: "Registros pedagógicos",
  contacts: "Contatos com responsáveis",
};
export type RecordField = {
  key: string;
  label: string;
  type?: "text" | "date" | "number" | "textarea" | "time";
  options?: string[];
  relation?: RecordTable;
  required?: boolean;
  nullable?: boolean;
  min?: number;
  max?: number;
  step?: number;
};
const name = { key: "name", label: "Nome", required: true };
export const recordFields: Record<RecordTable, RecordField[]> = {
  units: [name, { key: "address", label: "Endereço" }],
  offerings: [
    name,
    { key: "kind", label: "Tipo", options: ["individual", "pacote"] },
    {
      key: "duration_months",
      label: "Duração em meses (referência)",
      type: "number",
      nullable: true,
    },
    {
      key: "total_hours",
      label: "Carga horária total (horas)",
      type: "number",
      nullable: true,
      min: 0.25,
      max: 100000,
      step: 0.25,
    },
    { key: "courses", label: "Cursos / módulos", type: "textarea" },
  ],
  classes: [
    name,
    { key: "course", label: "Curso" },
    {
      key: "offering_id",
      label: "Curso ou pacote de referência",
      relation: "offerings",
    },
    {
      key: "lesson_duration_minutes",
      label: "Carga por aula (minutos)",
      type: "number",
      nullable: true,
      min: 5,
      max: 480,
    },
    {
      key: "teacher_id",
      label: "Professor",
      relation: "profiles",
      required: true,
    },
    { key: "schedule", label: "Horário" },
    { key: "capacity", label: "Vagas", type: "number" },
    { key: "whatsapp", label: "WhatsApp da turma" },
  ],
  students: [
    { key: "name", label: "Nome" },
    { key: "birth_date", label: "Nascimento", type: "date" },
    { key: "class_id", label: "Turma", relation: "classes" },
    { key: "offering_id", label: "Curso ou pacote", relation: "offerings" },
    { key: "phone", label: "Telefone" },
    { key: "guardian", label: "Responsável" },
    { key: "guardian_phone", label: "WhatsApp do responsável" },
    { key: "email", label: "E-mail" },
    { key: "address", label: "Endereço" },
    { key: "enrollment_date", label: "Data de matrícula", type: "date" },
    {
      key: "course_start_date",
      label: "Data de início do curso",
      type: "date",
      nullable: true,
    },
    {
      key: "last_installment_date",
      label: "Vencimento do último boleto",
      type: "date",
      nullable: true,
    },
    {
      key: "opening_hours",
      label: "Horas anteriores aos registros",
      type: "number",
      min: 0,
      max: 100000,
      step: 0.25,
    },
    {
      key: "status",
      label: "Situação",
      options: [
        "ativo",
        "conclusao",
        "inadimplencia",
        "abandono",
        "cancelamento",
      ],
    },
    { key: "archive_reason", label: "Motivo da situação", type: "textarea" },
  ],
  profiles: [
    name,
    {
      key: "role",
      label: "Perfil",
      options: ["admin", "coordenacao", "secretaria", "professor", "comercial"],
    },
    { key: "unit_id", label: "Unidade", relation: "units", required: true },
    { key: "active", label: "Acesso ativo", options: ["true", "false"] },
  ],
  lessons: [
    {
      key: "duration_minutes",
      label: "Duração registrada (minutos)",
      type: "number",
      nullable: true,
      min: 5,
      max: 480,
    },
    {
      key: "topic",
      label: "Conteúdo da aula",
      type: "textarea",
      required: true,
    },
    { key: "date", label: "Data", type: "date", required: true },
  ],
  attendance: [
    { key: "arrival_time", label: "Horário de chegada (atraso)", type: "time" },
    {
      key: "justification",
      label: "Motivo da justificativa",
      type: "textarea",
    },
    {
      key: "status",
      label: "Situação",
      options: ["presente", "falta", "atrasado", "justificado"],
    },
  ],
  pedagogy: [
    { key: "date", label: "Data", type: "date" },
    {
      key: "kind",
      label: "Tipo",
      options: ["Diagnóstico", "Evolução", "Intervenção"],
    },
    { key: "skill", label: "Habilidade" },
    { key: "level", label: "Nível (1 a 5)", type: "number" },
    { key: "notes", label: "Observações", type: "textarea" },
    { key: "intervention", label: "Intervenção", type: "textarea" },
    { key: "follow_up", label: "Acompanhamento", type: "date" },
  ],
  contacts: [
    { key: "date", label: "Data", type: "date" },
    { key: "reason", label: "Motivo", type: "textarea" },
    { key: "outcome", label: "Resultado", type: "textarea" },
    { key: "next_contact", label: "Próximo contato", type: "date" },
  ],
};
export type ManagedRecord = {
  id: string;
  unit_id?: string;
  archived_at?: string | null;
  record_archive_reason?: string;
  [key: string]: unknown;
};
// Archive storage remains available in management; operational screens omit the
// archived record and records whose unit/class/student/lesson has been archived.
export function operationalStore(source: Store): Store {
  const visible = (rows: { id: string; archived_at?: string | null }[]) =>
    new Set(rows.filter((r) => !r.archived_at).map((r) => r.id));
  const units = source.units.filter((r) => !r.archived_at),
    unitIds = visible(units);
  const classes = source.classes.filter(
      (r) => !r.archived_at && unitIds.has(r.unit_id),
    ),
    classIds = visible(classes);
  const students = source.students.filter(
      (r) =>
        !r.archived_at &&
        (!r.class_id || classIds.has(r.class_id)) &&
        unitIds.has(r.unit_id),
    ),
    studentIds = visible(students);
  const lessons = source.lessons.filter(
      (r) =>
        !r.archived_at &&
        (r.class_id
          ? classIds.has(r.class_id)
          : !!r.student_id && studentIds.has(r.student_id)) &&
        unitIds.has(r.unit_id),
    ),
    lessonIds = visible(lessons);
  return {
    units,
    classes,
    students,
    lessons,
    profiles: source.profiles.filter((r) => !r.archived_at),
    offerings: source.offerings.filter(
      (r) => !r.archived_at && unitIds.has(r.unit_id),
    ),
    attendance: source.attendance.filter(
      (r) =>
        !r.archived_at &&
        studentIds.has(r.student_id) &&
        lessonIds.has(r.lesson_id),
    ),
    pedagogy: source.pedagogy.filter(
      (r) =>
        !r.archived_at &&
        (r.class_id
          ? classIds.has(r.class_id)
          : !!r.student_id && studentIds.has(r.student_id)) &&
        (!r.student_id || studentIds.has(r.student_id)) &&
        unitIds.has(r.unit_id),
    ),
    contacts: source.contacts.filter(
      (r) =>
        !r.archived_at &&
        studentIds.has(r.student_id) &&
        unitIds.has(r.unit_id),
    ),
  };
}
