export type Role = "admin" | "coordenacao" | "secretaria" | "professor";
export type Status =
  "ativo" | "conclusao" | "inadimplencia" | "abandono" | "cancelamento";
export type AttendanceStatus =
  "presente" | "falta" | "atrasado" | "justificado";
export interface Unit {
  archived_at?: string | null;
  record_archive_reason?: string;
  id: string;
  name: string;
  address: string;
}
export interface Profile {
  archived_at?: string | null;
  record_archive_reason?: string;
  id: string;
  name: string;
  username?: string | null;
  active?: boolean;
  must_change_password?: boolean;
  role: Role;
  unit_id: string;
}
export interface CourseClass {
  archived_at?: string | null;
  record_archive_reason?: string;
  id: string;
  unit_id: string;
  name: string;
  course: string;
  teacher_id: string;
  teacher: string;
  schedule: string;
  capacity: number;
  whatsapp: string;
}
export interface Offering {
  archived_at?: string | null;
  record_archive_reason?: string;
  id: string;
  unit_id: string;
  name: string;
  kind: "individual" | "pacote";
  duration_months: number;
  courses: string;
}
export interface Student {
  archived_at?: string | null;
  record_archive_reason?: string;
  photo_path?: string | null;
  id: string;
  unit_id: string;
  class_id: string | null;
  offering_id: string | null;
  name: string;
  birth_date: string;
  phone: string;
  guardian: string;
  guardian_phone: string;
  email: string;
  address: string;
  created_by?: string | null;
  enrollment_date: string;
  status: Status;
  archive_reason: string;
}
export interface Lesson {
  archived_at?: string | null;
  record_archive_reason?: string;
  id: string;
  unit_id: string;
  class_id: string;
  teacher_id: string;
  teacher: string;
  date: string;
  topic: string;
  closed: boolean;
}
export interface Attendance {
  arrival_time?: string;
  justification?: string;
  archived_at?: string | null;
  record_archive_reason?: string;
  id: string;
  unit_id: string;
  lesson_id: string;
  student_id: string;
  status: AttendanceStatus;
}
export interface SupportPlan {
  mode: "manual" | "assisted";
  observation_scores: Record<string, number>;
  strategy_ids: string[];
  context: string;
  baseline: string;
  goal: string;
  criteria: string;
  outcome: string;
  evidence: string;
  sources: string[];
  catalogue_version: string;
}
export interface Pedagogy {
  created_at?: string;
  parent_record_id?: string | null;
  support_plan?: SupportPlan;
  archived_at?: string | null;
  record_archive_reason?: string;
  id: string;
  unit_id: string;
  class_id: string;
  student_id: string | null;
  author_id: string;
  date: string;
  kind: string;
  skill: string;
  level: number;
  notes: string;
  intervention: string;
  follow_up: string;
}
export interface Contact {
  archived_at?: string | null;
  record_archive_reason?: string;
  id: string;
  unit_id: string;
  student_id: string;
  author_id: string;
  date: string;
  reason: string;
  outcome: string;
  next_contact: string;
}
export interface Store {
  offerings: Offering[];
  units: Unit[];
  profiles: Profile[];
  classes: CourseClass[];
  students: Student[];
  lessons: Lesson[];
  attendance: Attendance[];
  pedagogy: Pedagogy[];
  contacts: Contact[];
}
export const labels: Record<string, string> = {
  admin: "Administrador",
  ativo: "Ativo",
  conclusao: "Conclusão",
  inadimplencia: "Inadimplência",
  abandono: "Abandono",
  cancelamento: "Cancelamento",
  presente: "Presente",
  falta: "Falta",
  atrasado: "Atrasado",
  justificado: "Justificado",
  coordenacao: "Coordenação",
  secretaria: "Secretaria",
  professor: "Professor",
};
export function canAccess(profile: Profile, unitId: string) {
  return (
    profile.active !== false &&
    !profile.must_change_password &&
    (profile.role === "admin" ||
      profile.role === "coordenacao" ||
      profile.unit_id === unitId)
  );
}
export function absenceCount(store: Store, studentId: string) {
  return store.attendance.filter(
    (a) => a.student_id === studentId && a.status === "falta",
  ).length;
}
export function frequency(store: Store, studentId?: string) {
  const rows = store.attendance.filter(
    (a) => !studentId || a.student_id === studentId,
  );
  const valid = rows.filter((a) => a.status !== "justificado");
  return valid.length
    ? Math.round(
        (valid.filter((a) => a.status !== "falta").length / valid.length) * 100,
      )
    : null;
}
export function today() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
  }).format(new Date());
}
export function displayDate(value: string) {
  return value
    ? new Date(value + "T12:00:00").toLocaleDateString("pt-BR")
    : "—";
}
export function shortStudentName(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).join(" ");
}
export function studentDisplayName(student: Pick<Student, "id" | "name">) {
  return (
    student.name.trim() || `Cadastro ${student.id.slice(0, 6).toUpperCase()}`
  );
}
export function attendanceDescription(row: Attendance) {
  return (
    labels[row.status] +
    (row.status === "atrasado" && row.arrival_time
      ? ` — Chegada: ${row.arrival_time.slice(0, 5)}`
      : row.status === "justificado" && row.justification?.trim()
        ? ` — Motivo: ${row.justification.trim().replace(/\s+/g, " ")}`
        : "")
  );
}
export function attendanceMessage(store: Store, lesson: Lesson) {
  const group = store.classes.find((c) => c.id === lesson.class_id);
  const rows = store.attendance.filter((a) => a.lesson_id === lesson.id);
  const section = (status: AttendanceStatus, title: string, icon: string) => {
    const selected = rows.filter((a) => a.status === status);
    return (
      `*${icon} ${title} (${selected.length})*\n` +
      (selected.length
        ? selected
            .map(
              (a) =>
                `• ${shortStudentName(studentDisplayName(store.students.find((s) => s.id === a.student_id) || { id: a.student_id, name: "" }))} — ${attendanceDescription(a)}`,
            )
            .join("\n")
        : "• Nenhum registro")
    );
  };
  return `*WISDOM CURSOS*\n_Acompanhamento da aula_\n━━━━━━━━━━━━━━━━━━\n*Turma:* ${group?.name || ""}\n*Data:* ${displayDate(lesson.date)}\n*Professor(a):* ${lesson.teacher}\n\n*Conteúdo trabalhado*\n${lesson.topic}\n\n${section("presente", "PRESENTES", "✅")}\n\n${section("atrasado", "ATRASADOS", "🕒")}\n\n${section("falta", "AUSENTES", "❌")}\n\n${section("justificado", "FALTAS JUSTIFICADAS", "📋")}\n━━━━━━━━━━━━━━━━━━\n_Equipe Wisdom • Aprender transforma o futuro._`;
}
export function frequencyReportLines(
  store: Store,
  lessons: Lesson[],
  unitId: string,
  classId = "all",
) {
  const ids = new Set(lessons.map((l) => l.id));
  const attendance = store.attendance.filter((a) => ids.has(a.lesson_id));
  return store.students
    .filter(
      (s) =>
        (unitId === "all" || s.unit_id === unitId) &&
        (classId === "all" ||
          s.class_id === classId ||
          attendance.some((a) => a.student_id === s.id)),
    )
    .map((s) => {
      const rows = attendance.filter((a) => a.student_id === s.id);
      const label =
        store.classes.find(
          (c) => c.id === (classId === "all" ? s.class_id : classId),
        )?.name || (s.class_id ? "Turma não localizada" : "Sem turma");
      return `${studentDisplayName(s)} | ${label} | Presenças: ${rows.filter((a) => a.status === "presente").length} | Faltas: ${rows.filter((a) => a.status === "falta").length} | Atrasos: ${rows.filter((a) => a.status === "atrasado").length} | Justificadas: ${rows.filter((a) => a.status === "justificado").length}`;
    });
}
export function attendanceReportLines(store: Store, lesson: Lesson) {
  return [
    `Data: ${displayDate(lesson.date)}`,
    `Turma: ${store.classes.find((c) => c.id === lesson.class_id)?.name || ""}`,
    `Professor(a): ${lesson.teacher}`,
    `Conteúdo: ${lesson.topic}`,
    ...store.attendance
      .filter((a) => a.lesson_id === lesson.id)
      .map(
        (a) =>
          `${studentDisplayName(store.students.find((s) => s.id === a.student_id) || { id: a.student_id, name: "" })} | ${attendanceDescription(a)}`,
      ),
  ];
}
export function comparePedagogy(a: Pedagogy, b: Pedagogy) {
  return (
    b.date.localeCompare(a.date) ||
    (b.created_at || "").localeCompare(a.created_at || "") ||
    (a.parent_record_id === b.id ? -1 : b.parent_record_id === a.id ? 1 : 0)
  );
}
export function evolutionMessage(store: Store, student: Student) {
  const records = store.pedagogy
    .filter((p) => p.student_id === student.id)
    .sort(comparePedagogy);
  const latest = records[0];
  const f = frequency(store, student.id);
  return `*Wisdom | Acompanhamento pedagógico*\nOlá, ${student.guardian || "responsável"}!\nAluno(a): ${studentDisplayName(student)}\nTurma: ${store.classes.find((c) => c.id === student.class_id)?.name || "—"}\nFrequência: ${f === null ? "Sem registros" : f + "%"}\n${latest ? `\nRegistro de ${displayDate(latest.date)}\nHabilidade: ${latest.skill}\nEvolução: ${latest.notes}\nPróximos passos: ${latest.intervention || "Continuar acompanhamento"}` : "\nAinda não há registros individuais de evolução."}\n\nEquipe Wisdom`;
}
export function whatsappUrl(phone: string, message: string) {
  const number = phone.replace(/\D/g, "");
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}
export function validateStudent(student: Partial<Student>) {
  if (
    student.guardian_phone?.trim() &&
    student.guardian_phone.replace(/\D/g, "").length < 10
  )
    return "Confira o WhatsApp informado ou deixe-o vazio para completar depois.";
  return null;
}
