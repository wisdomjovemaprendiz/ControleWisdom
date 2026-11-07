"use client";
import { useState } from "react";
import type { LessonOccurrence, Student, Store } from "@/lib/domain";
import { studentDisplayName, displayDate } from "@/lib/domain";
import { occurrenceOptions, occurrenceText } from "@/lib/occurrences";
export type OccurrenceDraft = Pick<
  LessonOccurrence,
  "id" | "student_id" | "codes" | "notes"
>;
export function LessonOccurrences({
  students,
  value,
  onChange,
  individual,
}: {
  students: Student[];
  value: OccurrenceDraft[];
  onChange: (items: OccurrenceDraft[]) => void;
  individual: boolean;
}) {
  const [target, setTarget] = useState(
    individual ? students[0]?.id || "" : "class",
  );
  const targetId = individual ? students[0]?.id : target;
  const selected = targetId === "class" ? null : targetId || null;
  const record = value.find((item) => item.student_id === selected);
  function update(codes: string[], notes: string) {
    const others = value.filter((item) => item.student_id !== selected);
    onChange(
      codes.length || notes.trim()
        ? [
            ...others,
            {
              id: record?.id || crypto.randomUUID(),
              student_id: selected,
              codes,
              notes,
            },
          ]
        : others,
    );
  }
  return (
    <details className="panel occurrence-editor">
      <summary>
        Ocorrências da aula{" "}
        <span>{value.length ? `${value.length} registro(s)` : "Opcional"}</span>
      </summary>
      <div className="occurrence-body">
        <label>
          Registrar ocorrência para
          <select
            aria-label="Registrar ocorrência para"
            value={targetId || ""}
            onChange={(e) => setTarget(e.target.value)}
          >
            {!individual && <option value="class">Toda a turma</option>}
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {studentDisplayName(s)}
              </option>
            ))}
          </select>
        </label>
        <fieldset>
          <legend>Marque as situações observadas</legend>
          <div className="occurrence-options">
            {occurrenceOptions.map(([code, title]) => (
              <label key={code}>
                <input
                  type="checkbox"
                  checked={record?.codes.includes(code) || false}
                  onChange={(e) =>
                    update(
                      e.target.checked
                        ? [...(record?.codes || []), code]
                        : (record?.codes || []).filter((id) => id !== code),
                      record?.notes || "",
                    )
                  }
                />
                {title}
              </label>
            ))}
          </div>
        </fieldset>
        <label>
          Outra ocorrência ou detalhes (opcional)
          <textarea
            aria-label="Outra ocorrência ou detalhes"
            rows={3}
            maxLength={2000}
            value={record?.notes || ""}
            onChange={(e) => update(record?.codes || [], e.target.value)}
          />
        </label>
        <small>
          Registros internos, disponíveis no histórico e no acompanhamento ao
          responsável. Não entram no resumo do grupo.
        </small>
        {!!value.length && (
          <ul className="occurrence-draft-list">
            {value.map((item) => (
              <li key={item.id}>
                <strong>
                  {item.student_id
                    ? students.find((s) => s.id === item.student_id)?.name ||
                      "Aluno do histórico"
                    : "Turma"}
                </strong>
                <p>{occurrenceText(item)}</p>
                <button
                  type="button"
                  className="text-link"
                  onClick={() =>
                    onChange(value.filter((other) => other.id !== item.id))
                  }
                >
                  Remover registro
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </details>
  );
}
export function OccurrenceHistory({
  store,
  records,
}: {
  store: Store;
  records: LessonOccurrence[];
}) {
  return (
    <div className="occurrence-history">
      {records.map((item) => {
        const lesson = store.lessons.find((l) => l.id === item.lesson_id);
        return (
          <article key={item.id}>
            <small>
              {lesson ? displayDate(lesson.date) : "Aula anterior"} ·{" "}
              {item.student_id
                ? `Individual · ${store.students.find((s) => s.id === item.student_id)?.name || "Aluno do histórico"}`
                : "Contexto da turma"}
            </small>
            <p>{occurrenceText(item)}</p>
            <small>{item.author_name}</small>
          </article>
        );
      })}
      {!records.length && <p>Nenhuma ocorrência registrada.</p>}
    </div>
  );
}
