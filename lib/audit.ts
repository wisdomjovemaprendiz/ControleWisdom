import { occurrenceOptions } from "./occurrences";
import type { Store } from "./domain";
import { labels, studentDisplayName } from "./domain";
import { weekdays } from "./individual";
export interface AuditEntry {
  id: number;
  actor_name: string;
  actor_id: string | null;
  entity: string;
  entity_id: string;
  operation: string;
  occurred_at: string;
  before_data: Record<string, unknown> | null;
  after_data: Record<string, unknown> | null;
}
export const auditFieldLabels: Record<string, string> = {
  name: "Nome",
  codes: "Ocorrências marcadas",
  lesson_id: "Aula",
  author_name: "Registrado por",
  created_at: "Data do registro",
  updated_at: "Última alteração",
  total_hours: "Carga horária do curso (h)",
  offering_id: "Curso contratado",
  lesson_duration_minutes: "Duração da aula da turma (min)",
  duration_minutes: "Duração da aula registrada (min)",
  lesson_days: "Dias previstos de aula",
  course_start_date: "Início do curso",
  last_installment_date: "Último boleto",
  opening_hours: "Horas anteriores aos registros",
  course_offering_id: "Curso no registro de presença",
  teacher_id: "Professor",
  teacher: "Professor",
  course: "Curso",
  schedule: "Horário",
  capacity: "Vagas",
  date: "Data",
  topic: "Conteúdo da aula",
  closed: "Chamada concluída",
  arrival_time: "Horário de chegada",
  justification: "Justificativa",
  kind: "Tipo",
  skill: "Habilidade",
  level: "Nível",
  notes: "Observações",
  intervention: "Intervenção",
  follow_up: "Acompanhamento",
  reason: "Motivo do contato",
  outcome: "Resultado",
  next_contact: "Próximo contato",
  must_change_password: "Troca de senha exigida",
  class_id: "Turma",
  student_id: "Aluno",
  unit_id: "Unidade",
  status: "Situação",
  archived_at: "Arquivado em",
  archive_reason: "Motivo",
  enrollment_mode: "Modalidade",
  individual_teacher_id: "Professor individual",
  individual_hours: "Carga horária (horas)",
  individual_days: "Dias de aula",
  individual_duration_minutes: "Duração por aula (minutos)",
  offboarding: "Checklist de desligamento",
  role: "Perfil de acesso",
  active: "Ativo",
  label: "Etapa",
  position: "Ordem",
};
export function auditValue(key: string, value: unknown, store: Store): string {
  if (value === null || value === undefined || value === "") return "—";
  if (key === "offering_id" || key === "course_offering_id")
    return store.offerings.find((o) => o.id === value)?.name || String(value);
  if (["course_start_date", "last_installment_date"].includes(key))
    return String(value).split("-").reverse().join("/");
  if (key === "codes" && Array.isArray(value))
    return value
      .map(
        (id) =>
          occurrenceOptions.find(([code]) => code === id)?.[1] || String(id),
      )
      .join("; ");
  if (key === "lesson_id") {
    const lesson = store.lessons.find((l) => l.id === value);
    return lesson ? `${lesson.date} · ${lesson.topic}` : String(value);
  }
  if (key === "class_id")
    return store.classes.find((c) => c.id === value)?.name || String(value);
  if (key === "student_id") {
    const s = store.students.find((s) => s.id === value);
    return s ? studentDisplayName(s) : String(value);
  }
  if (key === "individual_teacher_id" || key === "teacher_id")
    return store.profiles.find((p) => p.id === value)?.name || String(value);
  if (key === "unit_id")
    return store.units.find((u) => u.id === value)?.name || String(value);
  if (["individual_days", "lesson_days"].includes(key) && Array.isArray(value))
    return value.map((d) => weekdays[Number(d)]).join(", ") || "—";
  if (key === "enrollment_mode")
    return value === "individual" ? "Aula individual" : "Turma";
  if (key === "offboarding" && typeof value === "object") {
    const data = value as {
      steps?: { label?: string; completed?: boolean }[];
      completed_at?: string;
    };
    return (
      data.steps
        ?.map(
          (s) =>
            `${s.completed ? "✓" : "Pendente:"} ${s.label || "Etapa concluída"}`,
        )
        .join("\n") || "—"
    );
  }
  if (typeof value === "boolean") return value ? "Sim" : "Não";
  if (key === "archived_at")
    return new Date(String(value)).toLocaleString("pt-BR", {
      timeZone: "America/Sao_Paulo",
    });
  return labels[String(value)] || String(value);
}
export function auditChanges(entry: AuditEntry) {
  return [
    ...new Set([
      ...Object.keys(entry.before_data || {}),
      ...Object.keys(entry.after_data || {}),
    ]),
  ].filter(
    (key) =>
      JSON.stringify(entry.before_data?.[key]) !==
      JSON.stringify(entry.after_data?.[key]),
  );
}
