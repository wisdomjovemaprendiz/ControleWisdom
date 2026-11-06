import type { Store, Student } from "./domain";
import { today } from "./domain";
const DAY = 86400000;
export function validDate(value?: string | null): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + "T12:00:00Z");
  return (
    Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}
const dateValue = (value: string) => new Date(value + "T12:00:00Z");
export function addDays(value: string, days: number) {
  const date = dateValue(value);
  date.setUTCDate(date.getUTCDate() + days);
  if (!Number.isFinite(date.getTime())) return "";
  const result = date.toISOString().slice(0, 10);
  return validDate(result) ? result : "";
}
export function daysBetween(from: string, to: string) {
  return Math.round(
    (dateValue(to).getTime() - dateValue(from).getTime()) / DAY,
  );
}
export function scheduleDays(schedule: string) {
  const text = schedule
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/-feiras?\b/g, "");
  const names = [
    "dom(?:ingos?)?",
    "seg(?:undas?)?",
    "ter(?:cas?)?",
    "qua(?:rtas?)?",
    "qui(?:ntas?)?",
    "sex(?:tas?)?",
    "sab(?:ados?)?",
  ];
  const found = names.flatMap((pattern, day) =>
    new RegExp(`\\b${pattern}\\b`).test(text) ? [day] : [],
  );
  const range = new RegExp(
    `\\b(${names.join("|")})\\b\\s*(?:a|ate|-)\\s*\\b(${names.join("|")})\\b`,
  ).exec(text);
  if (range) {
    const first = names.findIndex((p) =>
        new RegExp("^" + p + "$").test(range[1]),
      ),
      last = names.findIndex((p) => new RegExp("^" + p + "$").test(range[2]));
    if (first >= 0 && last >= 0) {
      const days: number[] = [];
      for (
        let day = first, count = 0;
        count < 7;
        day = (day + 1) % 7, count++
      ) {
        days.push(day);
        if (day === last) break;
      }
      return [...new Set([...found, ...days])].sort((a, b) => a - b);
    }
  }
  return found;
}
export function nthClassDate(anchor: string, count: number, days: number[]) {
  const unique = [...new Set(days)].filter(
    (d) => Number.isInteger(d) && d >= 0 && d <= 6,
  );
  if (!unique.length || count < 1 || !validDate(anchor)) return null;
  const day = dateValue(anchor).getUTCDay(),
    offsets = Array.from({ length: 7 }, (_, i) => i).filter((i) =>
      unique.includes((day + i) % 7),
    );
  return addDays(
    anchor,
    Math.floor((count - 1) / offsets.length) * 7 +
      offsets[(count - 1) % offsets.length],
  );
}
export function createProgressIndex(store: Store) {
  const attendanceByStudent = new Map<string, Store["attendance"]>();
  for (const row of store.attendance) {
    const list = attendanceByStudent.get(row.student_id) || [];
    list.push(row);
    attendanceByStudent.set(row.student_id, list);
  }
  return {
    attendanceByStudent,
    lessons: new Map(store.lessons.map((l) => [l.id, l])),
    classes: new Map(store.classes.map((c) => [c.id, c])),
    offerings: new Map(store.offerings.map((o) => [o.id, o])),
  };
}
export function courseProgress(
  store: Store,
  student: Student,
  reference = today(),
  index = createProgressIndex(store),
) {
  const courseClass = student.class_id
    ? index.classes.get(student.class_id)
    : undefined;
  const offeringId = student.offering_id || courseClass?.offering_id || null;
  const offering = offeringId ? index.offerings.get(offeringId) : undefined;
  const individual = student.enrollment_mode === "individual";
  const totalHours =
    (individual ? student.individual_hours : null) ||
    offering?.total_hours ||
    null;
  const startDate = validDate(student.course_start_date)
    ? student.course_start_date
    : validDate(student.enrollment_date)
      ? student.enrollment_date
      : null;
  const lastInstallment = validDate(student.last_installment_date)
    ? student.last_installment_date
    : null;
  const lessonMinutes = individual
    ? student.individual_duration_minutes
    : courseClass?.lesson_duration_minutes;
  const weekdays = individual
    ? student.individual_days || []
    : courseClass?.lesson_days?.length
      ? courseClass.lesson_days
      : scheduleDays(courseClass?.schedule || "");
  const openingHours = Math.max(0, student.opening_hours || 0),
    seen = new Set<string>();
  let creditedMinutes = openingHours * 60,
    missingDurations = 0,
    legacyCalls = 0;
  const rows: { date: string; minutes: number; credited: boolean }[] = [];
  for (const row of index.attendanceByStudent.get(student.id) || []) {
    const lesson = index.lessons.get(row.lesson_id);
    if (
      !lesson ||
      !lesson.closed ||
      lesson.archived_at ||
      row.archived_at ||
      seen.has(lesson.id) ||
      lesson.unit_id !== student.unit_id ||
      lesson.date > reference ||
      (startDate && lesson.date < startDate)
    )
      continue;
    if (
      row.course_offering_id &&
      offeringId &&
      row.course_offering_id !== offeringId
    )
      continue;
    const historicalClass = lesson.class_id
      ? index.classes.get(lesson.class_id)
      : undefined;
    if (
      !row.course_offering_id &&
      offeringId &&
      historicalClass?.offering_id &&
      historicalClass.offering_id !== offeringId &&
      lesson.class_id !== student.class_id
    )
      continue;
    seen.add(lesson.id);
    const credited = ["presente", "atrasado"].includes(row.status);
    const minutes =
      lesson.duration_minutes ||
      (lesson.student_id
        ? student.individual_duration_minutes
        : historicalClass?.lesson_duration_minutes) ||
      0;
    if (!minutes) {
      missingDurations++;
      continue;
    }
    if (!lesson.duration_minutes || (!row.course_offering_id && offeringId))
      legacyCalls++;
    if (credited) creditedMinutes += minutes;
    rows.push({ date: lesson.date, minutes, credited });
  }
  const completedHours = Math.round((creditedMinutes / 60) * 100) / 100;
  const remainingMinutes = totalHours
    ? Math.max(0, totalHours * 60 - creditedMinutes)
    : null;
  const remainingHours =
    remainingMinutes === null
      ? null
      : Math.round((remainingMinutes / 60) * 100) / 100;
  const completed = remainingMinutes === 0;
  const percent = totalHours
    ? completed
      ? 100
      : Math.min(
          99.9,
          Math.round((creditedMinutes / (totalHours * 60)) * 1000) / 10,
        )
    : null;
  const recent = rows
      .slice()
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 20),
    recordedMinutes = recent.reduce((sum, row) => sum + row.minutes, 0),
    presentMinutes = recent
      .filter((row) => row.credited)
      .reduce((sum, row) => sum + row.minutes, 0);
  const observedRate = recordedMinutes
    ? presentMinutes / recordedMinutes
    : null;
  const usesAttendance =
    recent.length >= 4 && observedRate !== null && observedRate > 0;
  const rate = usesAttendance ? observedRate! : 1;
  let estimatedEnd: string | null = null,
    estimateBasis: "schedule" | "billing" | null = null;
  let anchor = startDate && startDate > reference ? startDate : reference;
  if (rows.some((row) => row.date === anchor)) anchor = addDays(anchor, 1);
  const remainingLessons =
    remainingMinutes !== null && lessonMinutes
      ? Math.ceil(remainingMinutes / lessonMinutes - 1e-10)
      : null;
  if (
    remainingMinutes !== null &&
    remainingMinutes > 0 &&
    lessonMinutes &&
    weekdays.length
  ) {
    estimatedEnd = nthClassDate(
      anchor,
      Math.ceil(remainingMinutes / lessonMinutes / rate - 1e-10),
      weekdays,
    );
    estimateBasis = "schedule";
  } else if (
    remainingMinutes !== null &&
    remainingMinutes > 0 &&
    totalHours &&
    startDate &&
    lastInstallment &&
    lastInstallment > startDate
  ) {
    estimatedEnd = addDays(
      anchor,
      Math.ceil(
        (daysBetween(startDate, lastInstallment) * remainingMinutes) /
          (totalHours * 60) /
          rate,
      ),
    );
    estimateBasis = "billing";
  }
  const inactive = student.status !== "ativo" || !!student.archived_at;
  if (inactive || !validDate(estimatedEnd)) estimatedEnd = null;
  const completedOn = completed
    ? rows
        .filter((row) => row.credited)
        .sort((a, b) => b.date.localeCompare(a.date))[0]?.date || null
    : null;
  const billingGap =
    estimatedEnd && lastInstallment
      ? daysBetween(lastInstallment, estimatedEnd)
      : null;
  return {
    inactive,
    offeringId,
    offeringName:
      offering?.name ||
      courseClass?.course ||
      (individual ? "Aula individual" : "Curso a definir"),
    totalHours,
    completedHours,
    remainingHours,
    percent,
    startDate,
    startFromEnrollment: !validDate(student.course_start_date),
    lastInstallment,
    lessonMinutes: lessonMinutes || null,
    weekdays,
    remainingLessons,
    estimatedEnd,
    estimateBasis,
    usesAttendance,
    observedRate,
    recordedCalls: rows.length,
    missingDurations,
    legacyCalls,
    noRecentPresence: recent.length >= 4 && observedRate === 0,
    completed,
    completedOn,
    billingGap,
    openingHours,
  };
}
export type CourseProgress = ReturnType<typeof courseProgress>;
export const formatHours = (hours: number) =>
  hours.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
