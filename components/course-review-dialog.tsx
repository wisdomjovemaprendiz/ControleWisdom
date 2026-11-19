"use client";
import { useState } from "react";
import { CompactDialog } from "./compact-dialog";
import { courseReviewState } from "@/lib/course-alerts";
import { formatHours } from "@/lib/course-progress";
import {
  today,
  displayDate,
  type Store,
  type Student,
  type Profile,
  type Contact,
} from "@/lib/domain";
export function CourseReviewDialog({
  store,
  student,
  profile,
  onSave,
  onClose,
}: {
  store: Store;
  student: Student;
  profile: Profile;
  onSave: (record: Contact) => Promise<boolean>;
  onClose: () => void;
}) {
  const review = courseReviewState(store, student),
    p = review.progress;
  const [notes, setNotes] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <CompactDialog
      title="Análise de prazo e carga horária"
      onClose={onClose}
      className="course-review-dialog"
    >
      <strong>{student.name}</strong>
      <p>
        {formatHours(p.completedHours)} h realizadas ·{" "}
        {p.totalHours
          ? `${formatHours(p.totalHours)} h contratadas`
          : "Carga não definida"}
        {p.excessHours > 0
          ? ` · +${formatHours(p.excessHours)} h excedentes`
          : ""}
      </p>
      <p>
        Prazo contratual:{" "}
        {p.lastInstallment ? displayDate(p.lastInstallment) : "Não informado"}
      </p>
      {review.messages.map((message) => (
        <p key={message} className="course-deadline-label">
          {message}
        </p>
      ))}
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          setBusy(true);
          setError("");
          try {
            const record: Contact = {
              id: crypto.randomUUID(),
              unit_id: student.unit_id,
              student_id: student.id,
              author_id: profile.id,
              date: today(),
              created_at: new Date().toISOString(),
              reason: "Análise de prazo e carga horária",
              outcome: notes.trim(),
              next_contact: "",
              course_review: {
                offering_id: p.offeringId,
                contracted_hours: p.totalHours,
                completed_hours: p.completedHours,
                deadline: p.lastInstallment,
                deadline_state: p.deadlineState,
                start_date: p.startDate,
              },
            };
            if (await onSave(record)) onClose();
            else
              setError(
                "Não foi possível salvar a análise. Confira o aviso do sistema e tente novamente.",
              );
          } catch {
            setError("Não foi possível salvar a análise. Tente novamente.");
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          Motivo / observação e encaminhamento
          <textarea
            aria-label="Motivo da análise do curso"
            required
            minLength={3}
            maxLength={2000}
            rows={4}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />
        </label>
        <small>
          A análise ficará no histórico do aluno com autor, data, horas
          realizadas e prazo. Novas horas excedentes ou mudança da etapa do
          prazo geram um novo alerta.
        </small>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <footer>
          <button type="button" className="secondary" onClick={onClose}>
            Cancelar
          </button>
          <button
            type="submit"
            className="primary"
            disabled={busy || notes.trim().length < 3}
          >
            {busy ? "Salvando…" : "Salvar análise"}
          </button>
        </footer>
      </form>
    </CompactDialog>
  );
}
