import type { Store, LessonOccurrence } from "./domain";
export const occurrenceOptions = [
  ["phone", "Uso excessivo do celular"],
  ["talk", "Conversa excessiva"],
  ["lateness", "Atrasos recorrentes"],
  ["interruption", "Interrupções durante a explicação"],
  ["task", "Não realizou a atividade proposta"],
  ["materials", "Ausência de material necessário"],
  ["respect", "Dificuldade em respeitar os combinados"],
  ["conflict", "Conflito entre colegas"],
  ["participation", "Baixa participação na atividade"],
  ["equipment", "Uso inadequado de equipamentos"],
  ["support", "Necessidade de apoio para retomar a atividade"],
  ["collaboration", "Colaboração e participação positiva"],
] as const;
export function occurrenceText(
  item: Pick<LessonOccurrence, "codes" | "notes">,
) {
  return [
    ...item.codes.map(
      (code) => occurrenceOptions.find(([id]) => id === code)?.[1] || code,
    ),
    item.notes,
  ]
    .filter(Boolean)
    .join("; ");
}
export function studentOccurrences(store: Store, studentId: string) {
  return store.occurrences
    .filter((item) => {
      const lesson = store.lessons.find((l) => l.id === item.lesson_id);
      return (
        lesson &&
        !lesson.archived_at &&
        (item.student_id === studentId ||
          (!item.student_id &&
            store.attendance.some(
              (a) =>
                a.lesson_id === item.lesson_id &&
                a.student_id === studentId &&
                !a.archived_at &&
                ["presente", "atrasado"].includes(a.status),
            )))
      );
    })
    .sort((a, b) =>
      (
        store.lessons.find((l) => l.id === b.lesson_id)?.date || ""
      ).localeCompare(
        store.lessons.find((l) => l.id === a.lesson_id)?.date || "",
      ),
    );
}
export function naturalName(a: string, b: string) {
  return a.localeCompare(b, "pt-BR", { numeric: true, sensitivity: "base" });
}
export function studentChatUrl(phone: string) {
  let digits = phone.replace(/\D/g, "");
  if ([10, 11].includes(digits.length)) digits = "55" + digits;
  return `https://web.whatsapp.com/send?phone=${digits}`;
}
