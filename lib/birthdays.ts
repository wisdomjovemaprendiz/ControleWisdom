import { type Student, today } from "./domain";
export interface Birthday {
  student: Student;
  date: string;
  isToday: boolean;
}
export function birthdaysThisWeek(
  students: Student[],
  reference = today(),
): Birthday[] {
  const now = new Date(reference + "T12:00:00Z"),
    day = (now.getUTCDay() + 6) % 7,
    start = new Date(now.getTime() - day * 86400000),
    end = new Date(start.getTime() + 6 * 86400000),
    startText = start.toISOString().slice(0, 10),
    endText = end.toISOString().slice(0, 10);
  const years = [...new Set([start.getUTCFullYear(), end.getUTCFullYear()])];
  return students
    .filter(
      (s) =>
        s.status === "ativo" &&
        /^\d{4}-\d{2}-\d{2}$/.test(s.birth_date) &&
        s.birth_date <= reference,
    )
    .flatMap((student) =>
      years.flatMap((year) => {
        const date = `${year}-${student.birth_date.slice(5)}`,
          check = new Date(date + "T12:00:00Z");
        return !Number.isNaN(check.getTime()) &&
          check.toISOString().slice(0, 10) === date &&
          date >= startText &&
          date <= endText
          ? [{ student, date, isToday: date === reference }]
          : [];
      }),
    )
    .sort(
      (a, b) =>
        a.date.localeCompare(b.date) ||
        a.student.name.localeCompare(b.student.name, "pt-BR"),
    );
}
