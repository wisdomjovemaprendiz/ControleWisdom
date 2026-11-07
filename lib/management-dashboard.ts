import {
  canAccess,
  studentDisplayName,
  today,
  type Store,
  type Profile,
  type Student,
} from "./domain";
import { canTeachIndividual } from "./individual";
import { naturalName } from "./occurrences";
import { pendingPedagogy } from "./pedagogy";
import { enrollmentStage } from "./sales";

export function shiftDay(day: string, offset: number) {
  const date = new Date(day + "T12:00:00Z");
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}
function departureDay(student: Student) {
  const value = student.offboarding?.completed_at;
  if (!value || Number.isNaN(Date.parse(value))) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
  }).format(new Date(value));
}
export function managementDashboard(
  store: Store,
  profile: Profile,
  unit: string,
  days = 30,
  reference = today(),
  history: Store = store,
) {
  const start = shiftDay(reference, 1 - days);
  const enabledUnits = new Set(
    store.units.filter((u) => !u.archived_at).map((u) => u.id),
  );
  const visible = (unitId: string) =>
    canAccess(profile, unitId) &&
    (unit === "all" || unitId === unit) &&
    enabledUnits.has(unitId);
  const classes = store.classes.filter(
    (c) =>
      visible(c.unit_id) &&
      !c.archived_at &&
      (profile.role !== "professor" || c.teacher_id === profile.id),
  );
  const classIds = new Set(classes.map((c) => c.id));
  const eligible = (s: Student) =>
    visible(s.unit_id) &&
    (profile.role !== "professor" ||
      (!!s.class_id && classIds.has(s.class_id)) ||
      canTeachIndividual(profile, s));
  const students = store.students.filter(eligible),
    active = students.filter((s) => s.status === "ativo" && !s.archived_at);
  const activeIds = new Set(active.map((s) => s.id));
  const enrolledByClass = new Map<string, number>();
  for (const s of active)
    if (s.class_id)
      enrolledByClass.set(
        s.class_id,
        (enrolledByClass.get(s.class_id) || 0) + 1,
      );
  const historyStudents = history.students.filter(eligible);
  const studentIds = new Set(historyStudents.map((s) => s.id));
  const lessons = store.lessons.filter(
    (l) =>
      visible(l.unit_id) &&
      l.closed &&
      !l.archived_at &&
      l.date >= start &&
      l.date <= reference &&
      (profile.role !== "professor" ||
        (!!l.class_id && classIds.has(l.class_id)) ||
        (!!l.student_id && activeIds.has(l.student_id))),
  );
  const lessonMap = new Map(lessons.map((l) => [l.id, l]));
  const marks = [
    ...new Map(
      store.attendance
        .filter(
          (a) =>
            !a.archived_at &&
            studentIds.has(a.student_id) &&
            lessonMap.has(a.lesson_id),
        )
        .map((a) => [`${a.lesson_id}:${a.student_id}`, a]),
    ).values(),
  ];
  const marksByStudent = new Map<string, typeof marks>();
  for (const mark of marks) {
    const rows = marksByStudent.get(mark.student_id) || [];
    rows.push(mark);
    marksByStudent.set(mark.student_id, rows);
  }
  for (const rows of marksByStudent.values())
    rows.sort((a, b) =>
      lessonMap
        .get(b.lesson_id)!
        .date.localeCompare(lessonMap.get(a.lesson_id)!.date),
    );
  const latestPedagogy = new Map<string, Store["pedagogy"][number]>();
  for (const record of store.pedagogy) {
    if (
      record.archived_at ||
      !record.student_id ||
      record.date < start ||
      record.date > reference
    )
      continue;
    const previous = latestPedagogy.get(record.student_id);
    if (
      !previous ||
      record.date > previous.date ||
      (record.date === previous.date &&
        (record.created_at || "") > (previous.created_at || ""))
    )
      latestPedagogy.set(record.student_id, record);
  }
  const absences = marks.filter((a) => a.status === "falta");
  const assessed = marks.filter((a) => a.status !== "justificado");
  const frequency = assessed.length
    ? Math.round(
        (100 * assessed.filter((a) => a.status !== "falta").length) /
          assessed.length,
      )
    : null;
  const absentStudents = active
    .map((student) => {
      const attendance = marksByStudent.get(student.id) || [];
      const missing = attendance.filter((a) => a.status === "falta");
      return {
        student,
        count: missing.length,
        lastDate: missing[0] ? lessonMap.get(missing[0].lesson_id)!.date : "",
        lastAbsent: attendance[0]?.status === "falta",
      };
    })
    .filter((row) => row.count > 0)
    .sort(
      (a, b) =>
        Number(b.lastAbsent) - Number(a.lastAbsent) ||
        b.count - a.count ||
        naturalName(
          studentDisplayName(a.student),
          studentDisplayName(b.student),
        ),
    );
  const interventions = pendingPedagogy(store, profile, unit, reference).filter(
    ({ record }) =>
      visible(record.unit_id) &&
      (!record.class_id || classIds.has(record.class_id)) &&
      (!record.student_id || activeIds.has(record.student_id)),
  );
  const due = interventions.filter((i) => i.state !== "upcoming");
  const cancellations = historyStudents.filter(
    (s) => s.status === "cancelamento",
  );
  const departures = historyStudents.filter((s) =>
    ["cancelamento", "abandono", "inadimplencia"].includes(s.status),
  );
  const departuresInPeriod = departures.filter(
    (s) => departureDay(s) >= start && departureDay(s) <= reference,
  );
  const cancellationsInPeriod = cancellations.filter(
    (s) => departureDay(s) >= start && departureDay(s) <= reference,
  );
  const newEnrollments = historyStudents.filter(
    (s) =>
      s.enrollment_date >= start &&
      s.enrollment_date <= reference &&
      enrollmentStage(s) === "complete",
  );
  const pendingEnrollments = active.filter(
    (s) => enrollmentStage(s) !== "complete",
  );
  const opportunities = classes
    .filter((c) => c.enrollment_open !== false)
    .map((course) => {
      const enrolled = enrolledByClass.get(course.id) || 0;
      return {
        course,
        enrolled,
        vacancies: Math.max(0, course.capacity - enrolled),
        occupancy: course.capacity ? enrolled / course.capacity : 0,
      };
    })
    .filter((r) => r.vacancies > 0)
    .sort(
      (a, b) =>
        (a.course.enrollment_priority || 3) -
          (b.course.enrollment_priority || 3) ||
        a.occupancy - b.occupancy ||
        b.vacancies - a.vacancies ||
        naturalName(a.course.name, b.course.name),
    );
  const leaders = active
    .map((student) => {
      const attendance = (marksByStudent.get(student.id) || []).filter(
        (a) => a.status !== "justificado",
      );
      const rate = attendance.length
        ? Math.round(
            (100 * attendance.filter((a) => a.status !== "falta").length) /
              attendance.length,
          )
        : null;
      const latest = latestPedagogy.get(student.id);
      const positive = ["progress", "achieved"].includes(
        latest?.support_plan?.outcome || "",
      );
      return {
        student,
        rate,
        lessons: attendance.length,
        outcome: positive ? latest!.support_plan!.outcome : "",
        qualified:
          positive || (attendance.length >= 4 && rate !== null && rate >= 90),
      };
    })
    .filter((r) => r.qualified)
    .sort(
      (a, b) =>
        Number(b.outcome === "achieved") - Number(a.outcome === "achieved") ||
        (b.rate || 0) - (a.rate || 0) ||
        b.lessons - a.lessons ||
        naturalName(a.student.name, b.student.name),
    );
  const occurrenceCounts = new Map<string, number>();
  for (const record of store.occurrences)
    if (
      record.student_id &&
      lessonMap.has(record.lesson_id) &&
      (record.codes.some((code) => code !== "collaboration") ||
        (!record.codes.length && !!record.notes.trim()))
    )
      occurrenceCounts.set(
        record.student_id,
        (occurrenceCounts.get(record.student_id) || 0) + 1,
      );
  const recurringOccurrences = active
    .map((student) => ({
      student,
      count: occurrenceCounts.get(student.id) || 0,
    }))
    .filter((r) => r.count >= 2)
    .sort((a, b) => b.count - a.count);
  const attentionIds = new Set([
    ...absentStudents
      .filter((r) => r.lastAbsent || r.count >= 3)
      .map((r) => r.student.id),
    ...due.flatMap(({ record }) =>
      record.student_id ? [record.student_id] : [],
    ),
    ...recurringOccurrences.map((r) => r.student.id),
  ]);
  const trend = Array.from({ length: 7 }, (_, index) => {
    const from = shiftDay(start, Math.floor((index * days) / 7)),
      to = shiftDay(start, Math.floor(((index + 1) * days) / 7) - 1);
    const rows = marks.filter((a) => {
      const date = lessonMap.get(a.lesson_id)!.date;
      return date >= from && date <= to;
    });
    return {
      from,
      to,
      presente: rows.filter((a) => a.status === "presente").length,
      atrasado: rows.filter((a) => a.status === "atrasado").length,
      falta: rows.filter((a) => a.status === "falta").length,
      justificado: rows.filter((a) => a.status === "justificado").length,
      total: rows.length,
    };
  });
  return {
    start,
    reference,
    days,
    classes,
    students,
    active,
    marks,
    absences,
    frequency,
    absentStudents,
    interventions,
    due,
    cancellations,
    cancellationsInPeriod,
    departuresInPeriod,
    unknownDepartureDates: departures.filter((s) => !departureDay(s)).length,
    newEnrollments,
    pendingEnrollments,
    opportunities,
    leaders,
    recurringOccurrences,
    attentionCount: attentionIds.size,
    trend,
    departures,
  };
}
