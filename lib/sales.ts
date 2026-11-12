import { absenceAlert } from "./absence-alerts";
import {
  canAccess,
  type Store,
  type Profile,
  type CourseClass,
  type Student,
} from "./domain";
export function validGroupLink(value: string) {
  if (!value) return true;
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      !url.hash &&
      !url.port &&
      url.hostname === "chat.whatsapp.com" &&
      !url.username &&
      !url.password &&
      /^\/[A-Za-z0-9_-]{6,128}\/?$/.test(url.pathname)
    );
  } catch {
    return false;
  }
}
export function enrollmentStage(student: Student) {
  return student.registration_stage || "complete";
}
export function canEditStudent(profile: Profile, student: Student) {
  return (
    canAccess(profile, student.unit_id) &&
    (profile.role !== "comercial" ||
      (student.created_by === profile.id &&
        enrollmentStage(student) === "pre_enrollment"))
  );
}
export function classSalesRows(store: Store, profile: Profile, unit = "all") {
  return store.classes
    .filter(
      (c) =>
        !c.archived_at &&
        canAccess(profile, c.unit_id) &&
        (unit === "all" || unit === c.unit_id),
    )
    .map((course) => {
      const enrolled = store.students.filter(
        (s) =>
          !s.archived_at && s.status === "ativo" && s.class_id === course.id,
      ).length;
      return {
        course,
        enrolled,
        vacancies: Math.max(0, course.capacity - enrolled),
        occupancy: course.capacity
          ? Math.round((enrolled / course.capacity) * 100)
          : 0,
        priority: course.enrollment_priority || 3,
        open: course.enrollment_open !== false,
      };
    })
    .sort(
      (a, b) =>
        a.priority - b.priority ||
        a.enrolled - b.enrolled ||
        a.course.name.localeCompare(b.course.name, "pt-BR"),
    );
}
export function lastAbsence(store: Store, student: Student) {
  const rows = store.attendance
    .filter((a) => !a.archived_at && a.student_id === student.id)
    .map((mark) => ({
      mark,
      lesson: store.lessons.find(
        (l) => l.id === mark.lesson_id && !l.archived_at,
      ),
    }))
    .filter((row) => row.lesson)
    .sort((a, b) => b.lesson!.date.localeCompare(a.lesson!.date));
  return rows[0]?.mark.status === "falta" ? rows[0].lesson : null;
}
export function needsAbsenceOutreach(store: Store, student: Student) {
  return absenceAlert(store, student).active;
}
export function groupInvitation(
  student: Student,
  course: CourseClass,
  recipient: "student" | "guardian",
) {
  const greeting =
    recipient === "student" ? student.name.trim() : student.guardian.trim();
  return `*WISDOM CURSOS*\nOlá${greeting ? ", " + greeting : ""}!\n\n*Turma:* ${course.name}\n${recipient === "student" ? "Este é o grupo da sua turma! Aqui você poderá tirar dúvidas com o professor, receber orientações e interagir com seus colegas." : "Este é o grupo da turma do aluno. Aqui você poderá acompanhar a frequência e a evolução dele, receber orientações e conversar com o professor."}\n\n*Entre pelo link:*\n${course.whatsapp}\n\n_Equipe Wisdom • Aprender transforma o futuro._`;
}
