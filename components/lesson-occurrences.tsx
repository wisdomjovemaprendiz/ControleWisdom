"use client";
import { CompactDialog } from "./compact-dialog";
import { StudentAvatar } from "./student-avatar";
import { useState } from "react";
import type { LessonOccurrence, Student, Store } from "@/lib/domain";
import { studentDisplayName, displayDate } from "@/lib/domain";
import { occurrenceOptions, occurrenceText } from "@/lib/occurrences";
export type OccurrenceDraft = Pick<
  LessonOccurrence,
  "id" | "student_id" | "codes" | "notes"
>;
export function OccurrenceFields({
  codes,
  notes,
  onChange,
}: {
  codes: string[];
  notes: string;
  onChange: (codes: string[], notes: string) => void;
}) {
  return (
    <div className="occurrence-body">
      <fieldset>
        <legend>Marque as situações observadas</legend>
        <div className="occurrence-options">
          {occurrenceOptions.map(([code, title]) => (
            <label key={code}>
              <input
                type="checkbox"
                checked={codes.includes(code)}
                onChange={(event) =>
                  onChange(
                    event.target.checked
                      ? [...codes, code]
                      : codes.filter((id) => id !== code),
                    notes,
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
          value={notes}
          onChange={(event) => onChange(codes, event.target.value)}
        />
      </label>
    </div>
  );
}
export function LessonOccurrences({
  value,
  onChange,
}: {
  value: OccurrenceDraft[];
  onChange: (items: OccurrenceDraft[]) => void;
}) {
  const record = value.find((item) => item.student_id === null);
  function update(codes: string[], notes: string) {
    const others = value.filter((item) => item.student_id !== null);
    onChange(
      codes.length || notes.trim()
        ? [
            ...others,
            {
              id: record?.id || crypto.randomUUID(),
              student_id: null,
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
        Ocorrências da turma{" "}
        <span>{record ? "Registro incluído" : "Opcional"}</span>
      </summary>
      <OccurrenceFields
        codes={record?.codes || []}
        notes={record?.notes || ""}
        onChange={update}
      />
      <div className="occurrence-class-footer">
        <small>
          Registro coletivo da sala. As ocorrências individuais ficam no botão
          de cada aluno.
        </small>
        {record && (
          <button
            type="button"
            className="text-link"
            onClick={() => update([], "")}
          >
            Remover ocorrência da turma
          </button>
        )}
      </div>
    </details>
  );
}
export function IndividualOccurrenceDialog({
  student,
  initial,
  onConfirm,
  onClose,
}: {
  student: Student;
  initial?: OccurrenceDraft;
  onConfirm: (item: OccurrenceDraft | null) => void;
  onClose: () => void;
}) {
  const [codes, setCodes] = useState(initial?.codes || []),
    [notes, setNotes] = useState(initial?.notes || "");
  return (
    <CompactDialog
      title="Ocorrência individual"
      className="individual-occurrence-dialog"
      onClose={onClose}
    >
      <div className="occurrence-dialog-student">
        <StudentAvatar student={student} />
        <strong>{studentDisplayName(student)}</strong>
      </div>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onConfirm(
            codes.length || notes.trim()
              ? {
                  id: initial?.id || crypto.randomUUID(),
                  student_id: student.id,
                  codes,
                  notes: notes.trim(),
                }
              : null,
          );
        }}
      >
        <OccurrenceFields
          codes={codes}
          notes={notes}
          onChange={(nextCodes, nextNotes) => {
            setCodes(nextCodes);
            setNotes(nextNotes);
          }}
        />
        <small className="occurrence-dialog-note">
          Fica no histórico e será gravada ao finalizar a chamada. Não entra no
          resumo do grupo.
        </small>
        <footer>
          <button
            type="button"
            className="text-link"
            onClick={() => {
              setCodes([]);
              setNotes("");
            }}
          >
            Limpar
          </button>
          <button type="button" className="secondary" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="primary">
            OK
          </button>
        </footer>
      </form>
    </CompactDialog>
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
