import {
  courseProgress,
  formatHours,
  type CourseProgress,
} from "./course-progress";
import { canTeachIndividual } from "./individual";
import {
  canAccess,
  displayDate,
  today,
  type Store,
  type Student,
  type Profile,
} from "./domain";
export function courseReviewState(
  store: Store,
  student: Student,
  reference = today(),
  progress: CourseProgress = courseProgress(store, student, reference),
) {
  const p = progress;
  const reviews = store.contacts
    .filter(
      (c) =>
        c.student_id === student.id &&
        !c.archived_at &&
        c.date <= reference &&
        c.course_review &&
        c.course_review.offering_id === p.offeringId &&
        c.course_review.contracted_hours === p.totalHours &&
        c.course_review.start_date === p.startDate,
    )
    .sort(
      (a, b) =>
        b.date.localeCompare(a.date) ||
        (b.created_at || "").localeCompare(a.created_at || ""),
    );
  const latest = reviews[0];
  const excessReviewed = reviews.some(
    (c) =>
      c.course_review!.completed_hours >= p.completedHours && c.outcome.trim(),
  );
  const deadlineReviewed = reviews.some(
    (c) =>
      c.course_review!.deadline === p.lastInstallment &&
      c.course_review!.deadline_state === p.deadlineState &&
      c.outcome.trim(),
  );
  const completionReviewed = reviews.some(
    (c) =>
      c.course_review!.completed_hours >= (p.totalHours || Infinity) &&
      c.outcome.trim(),
  );
  const messages: string[] = [];
  if (p.excessHours > 0 && !excessReviewed)
    messages.push(
      `${formatHours(p.excessHours)} h além da carga contratada — registre o motivo`,
    );
  if (p.deadlineState !== "none" && !deadlineReviewed)
    messages.push(
      p.deadlineState === "upcoming"
        ? `Prazo contratual em ${displayDate(p.lastInstallment!)} — ${p.daysUntilDeadline} dias para concluir`
        : p.deadlineState === "due"
          ? "Prazo contratual termina hoje"
          : `Prazo contratual encerrado em ${displayDate(p.lastInstallment!)}`,
    );
  if (p.completed && !completionReviewed && !p.excessHours)
    messages.push("Carga horária contratada cumprida — avaliar conclusão");
  return {
    progress: p,
    reviews,
    latest,
    messages,
    active: !p.inactive && messages.length > 0,
  };
}
export function canReviewCourse(
  store: Store,
  profile: Profile,
  student: Student,
) {
  return (
    canAccess(profile, student.unit_id) &&
    profile.role !== "comercial" &&
    (profile.role !== "professor" ||
      canTeachIndividual(profile, student) ||
      store.classes.some(
        (c) => c.id === student.class_id && c.teacher_id === profile.id,
      ))
  );
}
