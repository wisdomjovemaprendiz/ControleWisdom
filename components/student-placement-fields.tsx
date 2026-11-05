"use client";
import { useState } from "react";
import type { Student, CourseClass, Profile } from "@/lib/domain";
import { weekdays, INDIVIDUAL, isIndividual } from "@/lib/individual";
export function StudentPlacementFields({
  student,
  classes,
  teachers,
  preset,
}: {
  student?: Student;
  classes: CourseClass[];
  teachers: Profile[];
  preset?: string;
}) {
  const [placement, setPlacement] = useState(
    isIndividual(student || {})
      ? INDIVIDUAL
      : student?.class_id || preset || "",
  );
  return (
    <>
      <label>
        Turma
        <select
          name="class_id"
          aria-label="Turma"
          value={placement}
          onChange={(e) => setPlacement(e.target.value)}
        >
          <option value="">Selecionar turma depois</option>
          <option value={INDIVIDUAL}>Aula individual</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      {placement === INDIVIDUAL && (
        <fieldset className="individual-fields">
          <legend>Aula individual</legend>
          <div className="form-row">
            <label>
              Carga horária total (horas)
              <input
                name="individual_hours"
                type="number"
                min="0.5"
                max="10000"
                step="0.5"
                defaultValue={student?.individual_hours || ""}
              />
            </label>
            <label>
              Duração de cada aula (minutos)
              <input
                name="individual_duration_minutes"
                type="number"
                min="5"
                max="480"
                step="1"
                defaultValue={student?.individual_duration_minutes || ""}
              />
            </label>
          </div>
          <label>
            Professor das aulas individuais
            <select
              name="individual_teacher_id"
              defaultValue={student?.individual_teacher_id || ""}
            >
              <option value="">Definir depois</option>
              {teachers
                .filter(
                  (p) =>
                    p.active !== false &&
                    ["admin", "coordenacao", "professor"].includes(p.role) &&
                    (!student || p.unit_id === student.unit_id),
                )
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
            </select>
          </label>
          <fieldset className="weekday-options">
            <legend>Dias de aula</legend>
            {weekdays.map((day, index) => (
              <label key={day}>
                <input
                  type="checkbox"
                  name="individual_days"
                  value={index}
                  defaultChecked={student?.individual_days?.includes(index)}
                />
                {day}
              </label>
            ))}
          </fieldset>
        </fieldset>
      )}
    </>
  );
}
