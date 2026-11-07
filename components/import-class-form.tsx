"use client";
import { useState } from "react";
import type { CourseClass, Store } from "@/lib/domain";
import { ClassPlanningFields } from "./course-planning-fields";
export function ImportClassForm({
  store,
  unit,
  onSave,
  onCancel,
}: {
  store: Store;
  unit: string;
  onSave: (course: CourseClass) => Promise<boolean>;
  onCancel: () => void;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <form
      className="import-create-class"
      aria-label="Criar turma na importação"
      onSubmit={async (event) => {
        event.preventDefault();
        const fd = new FormData(event.currentTarget);
        const value = (key: string) => String(fd.get(key) || "").trim();
        const teacher = store.profiles.find(
          (p) =>
            p.id === value("teacher_id") &&
            p.unit_id === unit &&
            p.role === "professor" &&
            p.active !== false,
        );
        if (!teacher) {
          setError("Selecione um professor desta unidade.");
          return;
        }
        setBusy(true);
        setError("");
        try {
          if (
            !(await onSave({
              id: crypto.randomUUID(),
              unit_id: unit,
              name: value("name"),
              course: value("course"),
              offering_id: value("offering_id") || null,
              teacher_id: teacher.id,
              teacher: teacher.name,
              schedule: value("schedule"),
              capacity: Number(value("capacity")),
              whatsapp: "",
              enrollment_open: true,
              enrollment_priority: 3,
              lesson_duration_minutes: value("lesson_hours")
                ? Math.round(Number(value("lesson_hours")) * 60)
                : null,
              lesson_days: fd.getAll("lesson_days").map(Number),
            }))
          )
            setError(
              "Não foi possível criar a turma. Confira os dados e tente novamente.",
            );
        } catch {
          setError("Não foi possível criar a turma. Tente novamente.");
        } finally {
          setBusy(false);
        }
      }}
    >
      <h3>Nova turma</h3>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <fieldset disabled={busy}>
        <div className="form-grid">
          <label>
            Nome da turma
            <input name="name" required maxLength={150} />
          </label>
          <label>
            Professor
            <select
              name="teacher_id"
              aria-label="Professor"
              required
              defaultValue=""
            >
              <option value="" disabled>
                Selecione
              </option>
              {store.profiles
                .filter(
                  (p) =>
                    p.unit_id === unit &&
                    p.role === "professor" &&
                    p.active !== false,
                )
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
            </select>
          </label>
          <label>
            Dias e horário
            <input name="schedule" required />
          </label>
          <label>
            Vagas
            <input
              name="capacity"
              type="number"
              min={1}
              max={1000}
              defaultValue={25}
              required
            />
          </label>
        </div>
        <ClassPlanningFields
          offerings={store.offerings.filter((o) => o.unit_id === unit)}
        />
      </fieldset>
      <div className="import-inline-actions">
        <button
          type="button"
          className="secondary"
          disabled={busy}
          onClick={onCancel}
        >
          Cancelar criação
        </button>
        <button type="submit" className="primary" disabled={busy}>
          {busy ? "Criando…" : "Criar turma e selecionar"}
        </button>
      </div>
    </form>
  );
}
