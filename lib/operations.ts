import { enrollmentStage } from "./sales";
import { absenceAlert } from "./absence-alerts";
import { pendingPedagogy } from "./pedagogy";
import { isManager } from "@/lib/accounts";
import {
  canAccess,
  type Profile,
  type Store,
  type Student,
  today,
} from "./domain";
export interface FollowUp {
  id: string;
  student: Student;
  kind: "absence" | "registration" | "contact" | "pedagogy" | "enrollment";
  priority: number;
  title: string;
  detail: string;
  date?: string;
  pedagogy_id?: string;
}
export function followUps(
  store: Store,
  profile: Profile,
  unit = "all",
): FollowUp[] {
  const visible = (unitId: string) =>
    canAccess(profile, unitId) &&
    (!isManager(profile.role) || unit === "all" || unit === unitId);
  const students = store.students.filter(
    (s) => visible(s.unit_id) && s.status === "ativo" && !s.archived_at,
  );
  const items: FollowUp[] = [];
  for (const s of students) {
    const alert = absenceAlert(store, s);
    if (alert.active)
      items.push({
        id: `absence-${s.id}`,
        student: s,
        kind: "absence",
        priority: 1,
        title: alert.label,
        detail: store.contacts.some((c) => c.student_id === s.id)
          ? "Consulte os contatos anteriores antes de retomar."
          : "Nenhum contato registrado com o responsável.",
      });
    const missing = [
      !s.name.trim() && "nome",
      !s.class_id && s.enrollment_mode !== "individual" && "turma",
      !s.guardian && "responsável",
      !s.guardian_phone && "WhatsApp",
      !s.birth_date && "nascimento",
      !s.address && "endereço",
    ].filter(Boolean);
    if (enrollmentStage(s) !== "complete" && profile.role !== "comercial")
      items.push({
        id: `enrollment-${s.id}`,
        student: s,
        kind: "enrollment",
        priority: 1,
        title: "Concluir pré-matrícula",
        detail:
          "Pré-matrícula recebida. Confira os dados, complete o cadastro e sinalize a conclusão para o comercial.",
      });
    if (
      missing.length &&
      enrollmentStage(s) === "complete" &&
      profile.role !== "comercial"
    )
      items.push({
        id: `registration-${s.id}`,
        student: s,
        kind: "registration",
        priority: 3,
        title: "Completar matrícula",
        detail: `Falta informar: ${missing.join(", ")}.`,
      });
    const contact = store.contacts
      .filter((c) => c.student_id === s.id)
      .sort(
        (a, b) =>
          b.date.localeCompare(a.date) ||
          (a.next_contact || "9999").localeCompare(b.next_contact || "9999"),
      )[0];
    if (contact?.next_contact && contact.next_contact <= today())
      items.push({
        id: `contact-${contact.id}`,
        student: s,
        kind: "contact",
        priority: contact.next_contact < today() ? 0 : 2,
        title: "Retorno ao responsável",
        detail: contact.outcome,
        date: contact.next_contact,
      });
  }
  for (const { record, state } of pendingPedagogy(store, profile, unit)) {
    const student = students.find((s) => s.id === record.student_id);
    if (!student || state === "upcoming") continue;
    items.push({
      id: `pedagogy-${record.id}`,
      student,
      kind: "pedagogy",
      pedagogy_id: record.id,
      priority: state === "overdue" ? 0 : 2,
      title: "Revisar intervenção",
      detail: record.intervention || record.notes,
      date: record.follow_up,
    });
  }

  return items.sort(
    (a, b) =>
      a.priority - b.priority ||
      a.student.name.localeCompare(b.student.name, "pt-BR"),
  );
}
export function classLessons(store: Store, classId: string) {
  return store.lessons
    .filter((l) => l.class_id === classId)
    .sort((a, b) => b.date.localeCompare(a.date));
}
