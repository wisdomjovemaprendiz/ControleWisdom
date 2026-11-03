import { isManager } from "@/lib/accounts";
import {
  absenceCount,
  canAccess,
  type Profile,
  type Store,
  type Student,
  today,
} from "./domain";
export interface FollowUp {
  id: string;
  student: Student;
  kind: "absence" | "registration" | "contact" | "pedagogy";
  priority: number;
  title: string;
  detail: string;
  date?: string;
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
    (s) => visible(s.unit_id) && s.status === "ativo",
  );
  const items: FollowUp[] = [];
  for (const s of students) {
    const count = absenceCount(store, s.id);
    if (count >= 3)
      items.push({
        id: `absence-${s.id}`,
        student: s,
        kind: "absence",
        priority: 1,
        title: `${count} faltas acumuladas`,
        detail: store.contacts.some((c) => c.student_id === s.id)
          ? "Consulte os contatos anteriores antes de retomar."
          : "Nenhum contato registrado com o responsável.",
      });
    const missing = [
      !s.guardian && "responsável",
      !s.guardian_phone && "WhatsApp",
      !s.birth_date && "nascimento",
      !s.address && "endereço",
    ].filter(Boolean);
    if (missing.length)
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
    // Na mesma data, mantém o prazo mais próximo: o cadastro não registra horário.
    const record = store.pedagogy
      .filter((p) => p.student_id === s.id)
      .sort(
        (a, b) =>
          b.date.localeCompare(a.date) ||
          (a.follow_up || "9999").localeCompare(b.follow_up || "9999"),
      )[0];
    if (record?.follow_up && record.follow_up <= today())
      items.push({
        id: `pedagogy-${record.id}`,
        student: s,
        kind: "pedagogy",
        priority: 2,
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
