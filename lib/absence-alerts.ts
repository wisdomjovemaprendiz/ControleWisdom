import { today, type Store, type Student } from "./domain";

export function absenceAlert(
  store: Store,
  student: Student,
  reference = today(),
) {
  const marks = new Map(
    store.attendance
      .filter((mark) => mark.student_id === student.id && !mark.archived_at)
      .map((mark) => [mark.lesson_id, mark]),
  );
  const lessons = store.lessons
    .filter(
      (lesson) =>
        lesson.closed &&
        !lesson.archived_at &&
        lesson.date <= reference &&
        lesson.unit_id === student.unit_id &&
        (marks.has(lesson.id) ||
          (student.enrollment_mode === "individual"
            ? lesson.student_id === student.id
            : !!student.class_id &&
              lesson.class_id === student.class_id &&
              !lesson.student_id)),
    )
    .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
  let consecutive = 0;
  for (const lesson of lessons) {
    if (marks.get(lesson.id)?.status !== "falta") break;
    consecutive++;
  }
  const monthly = lessons.filter(
    (lesson) =>
      lesson.date.slice(0, 7) === reference.slice(0, 7) &&
      marks.get(lesson.id)?.status === "falta",
  ).length;
  const active =
    student.status === "ativo" &&
    !student.archived_at &&
    (consecutive >= 2 || monthly > 3);
  const label =
    consecutive >= 2
      ? `${consecutive} faltas consecutivas`
      : `${monthly} faltas em ${reference.slice(5, 7)}/${reference.slice(0, 4)}`;
  return { active, consecutive, monthly, label };
}
