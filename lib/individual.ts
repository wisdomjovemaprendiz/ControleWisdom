import type { Store, Student, Profile, Lesson } from "./domain";
import { studentDisplayName } from "./domain";
export const INDIVIDUAL = "individual";
export function isIndividual(s: Pick<Student, "enrollment_mode">) {
  return s.enrollment_mode === "individual";
}
export function studentPlacement(store: Store, s: Student) {
  return isIndividual(s)
    ? "Aula individual"
    : store.classes.find((c) => c.id === s.class_id)?.name || "Sem turma";
}
export function lessonPlacement(store: Store, l: Lesson) {
  return l.student_id
    ? `Aula individual · ${studentDisplayName(store.students.find((s) => s.id === l.student_id) || { id: l.student_id, name: "" })}`
    : store.classes.find((c) => c.id === l.class_id)?.name ||
        "Turma não localizada";
}
export function canTeachIndividual(profile: Profile, s: Student) {
  return (
    isIndividual(s) &&
    (["admin", "coordenacao"].includes(profile.role) ||
      (profile.role === "professor" &&
        profile.unit_id === s.unit_id &&
        (!s.individual_teacher_id || s.individual_teacher_id === profile.id)))
  );
}
export function individualMinutes(store: Store, id: string) {
  return store.lessons
    .filter(
      (l) =>
        l.student_id === id &&
        l.closed &&
        !l.archived_at &&
        store.attendance.some(
          (a) =>
            a.lesson_id === l.id &&
            a.student_id === id &&
            ["presente", "atrasado"].includes(a.status),
        ),
    )
    .reduce((sum, l) => sum + (l.duration_minutes || 0), 0);
}
export const weekdays = [
  "Domingo",
  "Segunda",
  "Terça",
  "Quarta",
  "Quinta",
  "Sexta",
  "Sábado",
];
