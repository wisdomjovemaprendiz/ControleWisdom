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
  class_id: string;
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
  archived_at?: string | null;
  record_archive_reason?: string;
  id: string;
  unit_id: string;
  lesson_id: string;
  student_id: string;
  status: AttendanceStatus;
}
export interface Pedagogy {
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
export function attendanceMessage(store: Store, lesson: Lesson) {
  const group = store.classes.find((c) => c.id === lesson.class_id);
  const rows = store.attendance.filter(
    (a) =>
      a.lesson_id === lesson.id &&
      (a.status === "presente" || a.status === "atrasado"),
  );
  const section = (
    status: "presente" | "atrasado",
    title: string,
    icon: string,
  ) => {
    const selected = rows.filter((a) => a.status === status);
    return (
      `*${icon} ${title} (${selected.length})*\n` +
      (selected.length
        ? selected
            .map(
              (a) =>
                `• ${shortStudentName(store.students.find((s) => s.id === a.student_id)?.name || "Aluno")} — ${labels[status]}`,
            )
            .join("\n")
        : "• Nenhum registro")
    );
  };
  return `*WISDOM CURSOS*\n_Acompanhamento da aula_\n━━━━━━━━━━━━━━━━━━\n*Turma:* ${group?.name || ""}\n*Data:* ${displayDate(lesson.date)}\n*Professor(a):* ${lesson.teacher}\n\n*Conteúdo trabalhado*\n${lesson.topic}\n\n${section("presente", "PRESENTES", "✅")}\n\n${section("atrasado", "ATRASADOS", "🕒")}\n━━━━━━━━━━━━━━━━━━\n_Equipe Wisdom • Aprender transforma o futuro._`;
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
          `${store.students.find((s) => s.id === a.student_id)?.name || "Aluno"} | ${labels[a.status]}`,
      ),
  ];
}
export function evolutionMessage(store: Store, student: Student) {
  const records = store.pedagogy
    .filter((p) => p.student_id === student.id)
    .sort((a, b) => b.date.localeCompare(a.date));
  const latest = records[0];
  const f = frequency(store, student.id);
  return `*Wisdom | Acompanhamento pedagógico*\nOlá, ${student.guardian || "responsável"}!\nAluno(a): ${student.name}\nTurma: ${store.classes.find((c) => c.id === student.class_id)?.name || "—"}\nFrequência: ${f === null ? "Sem registros" : f + "%"}\n${latest ? `\nRegistro de ${displayDate(latest.date)}\nHabilidade: ${latest.skill}\nEvolução: ${latest.notes}\nPróximos passos: ${latest.intervention || "Continuar acompanhamento"}` : "\nAinda não há registros individuais de evolução."}\n\nEquipe Wisdom`;
}
export function whatsappUrl(phone: string, message: string) {
  const number = phone.replace(/\D/g, "");
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}
export function validateStudent(student: Partial<Student>) {
  if (!student.name?.trim()) return "Informe o nome do aluno.";
  if (!student.class_id) return "Selecione uma turma.";
  if (!student.guardian_phone?.replace(/\D/g, ""))
    return "Informe o WhatsApp do responsável com DDI e DDD.";
  return null;
}
