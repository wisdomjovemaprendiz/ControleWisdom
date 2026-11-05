import type { Store, Student, Profile } from "./domain";
import {
  canAccess,
  labels,
  displayDate,
  studentDisplayName,
  comparePedagogy,
} from "./domain";
import { studentPlacement, weekdays } from "./individual";
export type ReportCell = string | number;
type Context = {
  store: Store;
  student: Student;
  attendance: Store["attendance"];
  lessons: Store["lessons"];
  latestPedagogy?: Store["pedagogy"][number];
};
export interface ReportField {
  id: string;
  label: string;
  group: string;
  pedagogy?: boolean;
  value: (context: Context) => ReportCell;
}
const personal = (id: keyof Student, label: string): ReportField => ({
  id,
  label,
  group: "Cadastro",
  value: ({ student }) => String(student[id] || ""),
});
export const customReportFields: ReportField[] = [
  {
    id: "name",
    label: "Nome do aluno",
    group: "Cadastro",
    value: ({ student }) => studentDisplayName(student),
  },
  personal("phone", "Telefone do aluno"),
  personal("guardian", "Responsável"),
  personal("guardian_phone", "Telefone do responsável"),
  {
    id: "birth_date",
    label: "Data de nascimento",
    group: "Cadastro",
    value: ({ student }) =>
      student.birth_date ? displayDate(student.birth_date) : "",
  },
  personal("email", "E-mail"),
  personal("address", "Endereço"),
  {
    id: "class",
    label: "Turma / modalidade",
    group: "Matrícula",
    value: ({ store, student }) => studentPlacement(store, student),
  },
  {
    id: "unit",
    label: "Unidade",
    group: "Matrícula",
    value: ({ store, student }) =>
      store.units.find((u) => u.id === student.unit_id)?.name || "",
  },
  {
    id: "offering",
    label: "Curso ou pacote",
    group: "Matrícula",
    value: ({ store, student }) =>
      store.offerings.find((o) => o.id === student.offering_id)?.name ||
      store.classes.find((c) => c.id === student.class_id)?.course ||
      "",
  },
  {
    id: "enrollment_date",
    label: "Data da matrícula",
    group: "Matrícula",
    value: ({ student }) => displayDate(student.enrollment_date),
  },
  {
    id: "status",
    label: "Situação",
    group: "Matrícula",
    value: ({ student }) => labels[student.status],
  },
  {
    id: "registration_stage",
    label: "Etapa do cadastro",
    group: "Matrícula",
    value: ({ student }) => labels[student.registration_stage || "complete"],
  },
  {
    id: "teacher",
    label: "Professor",
    group: "Matrícula",
    value: ({ store, student }) =>
      student.enrollment_mode === "individual"
        ? store.profiles.find((p) => p.id === student.individual_teacher_id)
            ?.name || ""
        : store.classes.find((c) => c.id === student.class_id)?.teacher || "",
  },
  {
    id: "schedule",
    label: "Dias e horário",
    group: "Matrícula",
    value: ({ store, student }) =>
      student.enrollment_mode === "individual"
        ? student.individual_days?.map((d) => weekdays[d]).join(", ") || ""
        : store.classes.find((c) => c.id === student.class_id)?.schedule || "",
  },
  {
    id: "individual_hours",
    label: "Carga horária contratada (h)",
    group: "Matrícula",
    value: ({ student }) => student.individual_hours || "",
  },
  {
    id: "individual_duration",
    label: "Duração por aula (min)",
    group: "Matrícula",
    value: ({ student }) => student.individual_duration_minutes || "",
  },
  ...(["presente", "falta", "atrasado", "justificado"] as const).map(
    (status): ReportField => ({
      id: status,
      label: {
        presente: "Presenças",
        falta: "Faltas",
        atrasado: "Atrasos",
        justificado: "Justificativas",
      }[status],
      group: "Frequência",
      value: ({ attendance, student }) =>
        attendance.filter(
          (a) => a.student_id === student.id && a.status === status,
        ).length,
    }),
  ),
  {
    id: "frequency",
    label: "Frequência (%)",
    group: "Frequência",
    value: ({ attendance, student }) => {
      const rows = attendance.filter(
        (a) => a.student_id === student.id && a.status !== "justificado",
      );
      return rows.length
        ? Math.round(
            (rows.filter((a) => a.status !== "falta").length / rows.length) *
              100,
          )
        : "Sem registro";
    },
  },
  {
    id: "realized_hours",
    label: "Carga horária realizada (h)",
    group: "Frequência",
    value: ({ attendance, lessons, student }) =>
      student.enrollment_mode === "individual"
        ? Number(
            (
              lessons
                .filter(
                  (l) =>
                    l.student_id === student.id &&
                    l.closed &&
                    attendance.some(
                      (a) =>
                        a.lesson_id === l.id &&
                        a.student_id === student.id &&
                        ["presente", "atrasado"].includes(a.status),
                    ),
                )
                .reduce((sum, l) => sum + (l.duration_minutes || 0), 0) / 60
            ).toFixed(2),
          )
        : "",
  },
  {
    id: "archive_reason",
    label: "Motivo do desligamento",
    group: "Matrícula",
    value: ({ student }) =>
      student.archive_reason || student.record_archive_reason || "",
  },
  ...(["date", "skill", "notes", "intervention", "follow_up"] as const).map(
    (key): ReportField => ({
      id: `pedagogy_${key}`,
      label: {
        date: "Data do último registro",
        skill: "Última habilidade observada",
        notes: "Observações do último registro",
        intervention: "Intervenção do último registro",
        follow_up: "Próximo acompanhamento",
      }[key],
      group: "Pedagógico",
      pedagogy: true,
      value: ({ latestPedagogy }) => {
        const v = latestPedagogy?.[key] || "";
        return (key === "follow_up" || key === "date") && v
          ? displayDate(v)
          : v;
      },
    }),
  ),
];
export interface CustomReportOptions {
  unit: string;
  classId: string;
  from: string;
  to: string;
  status: string;
  includeArchived: boolean;
  filterEnrollmentDate: boolean;
}
export function availableReportFields(profile: Profile) {
  return customReportFields.filter(
    (f) => !f.pedagogy || profile.role !== "comercial",
  );
}
export function buildCustomReport(
  store: Store,
  profile: Profile,
  selected: string[],
  options: CustomReportOptions,
) {
  const selectedIds = new Set(selected),
    fields = availableReportFields(profile).filter((f) =>
      selectedIds.has(f.id),
    );
  if (!fields.length)
    throw new Error("Marque ao menos uma informação para o relatório.");
  const lessons = store.lessons.filter(
    (l) =>
      canAccess(profile, l.unit_id) &&
      (options.unit === "all" || l.unit_id === options.unit) &&
      (options.classId === "all" ||
        (options.classId === "individual"
          ? !!l.student_id
          : l.class_id === options.classId)) &&
      (!options.from || l.date >= options.from) &&
      (!options.to || l.date <= options.to) &&
      (!options.includeArchived ? !l.archived_at : true),
  );
  const lessonIds = new Set(lessons.map((l) => l.id)),
    attendance = store.attendance.filter(
      (a) =>
        lessonIds.has(a.lesson_id) &&
        (!options.includeArchived ? !a.archived_at : true),
    );
  const attendanceByStudent = new Map<string, Store["attendance"]>(),
    lessonsByStudent = new Map<string, Store["lessons"]>(),
    latestByStudent = new Map<string, Store["pedagogy"][number]>();
  for (const row of attendance) {
    const rows = attendanceByStudent.get(row.student_id) || [];
    rows.push(row);
    attendanceByStudent.set(row.student_id, rows);
  }
  for (const row of lessons)
    if (row.student_id) {
      const rows = lessonsByStudent.get(row.student_id) || [];
      rows.push(row);
      lessonsByStudent.set(row.student_id, rows);
    }
  if (fields.some((f) => f.pedagogy))
    for (const row of store.pedagogy
      .filter((p) => !p.archived_at)
      .slice()
      .sort(comparePedagogy))
      if (row.student_id && !latestByStudent.has(row.student_id))
        latestByStudent.set(row.student_id, row);
  const students = store.students
    .filter(
      (s) =>
        canAccess(profile, s.unit_id) &&
        (options.unit === "all" || s.unit_id === options.unit) &&
        (options.classId === "all" ||
          (options.classId === "individual"
            ? s.enrollment_mode === "individual"
            : s.class_id === options.classId)) &&
        (options.status === "all" || s.status === options.status) &&
        (options.includeArchived ||
          (!s.archived_at &&
            !store.units.find((u) => u.id === s.unit_id)?.archived_at &&
            !store.classes.find((c) => c.id === s.class_id)?.archived_at)) &&
        (!options.filterEnrollmentDate ||
          ((!options.from || s.enrollment_date >= options.from) &&
            (!options.to || s.enrollment_date <= options.to))),
    )
    .sort((a, b) =>
      studentDisplayName(a).localeCompare(studentDisplayName(b), "pt-BR"),
    );
  return {
    headers: fields.map((f) => f.label),
    rows: students.map((student) =>
      fields.map((f) =>
        f.value({
          store,
          student,
          attendance: attendanceByStudent.get(student.id) || [],
          lessons: lessonsByStudent.get(student.id) || [],
          latestPedagogy: latestByStudent.get(student.id),
        }),
      ),
    ),
    count: students.length,
  };
}
