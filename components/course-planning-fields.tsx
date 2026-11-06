"use client";
import { useState } from "react";
import type { Student, Profile, CourseClass, Offering } from "@/lib/domain";
import { weekdays } from "@/lib/individual";
import { scheduleDays } from "@/lib/course-progress";
export function EnrollmentPlanningFields({
  student,
  profile,
}: {
  student?: Student;
  profile: Profile;
}) {
  return (
    <fieldset className="enrollment-planning-fields">
      <legend>Planejamento do curso</legend>
      <div className="form-grid">
        <label>
          Data de início do curso
          <input
            type="date"
            name="course_start_date"
            defaultValue={student?.course_start_date || ""}
          />
        </label>
        <label>
          Vencimento do último boleto
          <input
            type="date"
            name="last_installment_date"
            defaultValue={student?.last_installment_date || ""}
            disabled={profile.role === "professor"}
          />
        </label>
      </div>
      {["admin", "coordenacao", "secretaria"].includes(profile.role) && (
        <label>
          Horas cumpridas antes dos registros do sistema
          <input
            type="number"
            name="opening_hours"
            min="0"
            max="100000"
            step="0.25"
            defaultValue={student?.opening_hours || ""}
          />
          <small>
            Informe apenas horas que não constam nas chamadas, para evitar
            contagem duplicada.
          </small>
        </label>
      )}
      <small>
        Campos opcionais. As datas ajudam na previsão e não encerram a
        matrícula.
      </small>
    </fieldset>
  );
}
export function ClassPlanningFields({
  course,
  offerings,
}: {
  course?: CourseClass;
  offerings: Offering[];
}) {
  const [offeringId, setOfferingId] = useState(course?.offering_id || "");
  const offering = offerings.find((o) => o.id === offeringId);
  return (
    <fieldset className="class-planning-fields">
      <legend>Carga horária e previsão</legend>
      <label>
        Curso ou pacote de referência
        <select
          name="offering_id"
          aria-label="Curso ou pacote de referência"
          value={offeringId}
          onChange={(e) => setOfferingId(e.target.value)}
        >
          <option value="">Definir depois</option>
          {offerings
            .filter((o) => !course || o.unit_id === course.unit_id)
            .map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
                {o.total_hours ? ` · ${o.total_hours} h` : ""}
              </option>
            ))}
        </select>
      </label>
      {offering ? (
        <input type="hidden" name="course" value={offering.name} />
      ) : (
        <label>
          Curso *
          <input name="course" required defaultValue={course?.course || ""} />
        </label>
      )}
      <label>
        Carga horária de cada aula (horas)
        <input
          name="lesson_hours"
          aria-label="Carga horária de cada aula (horas)"
          type="number"
          min="0.25"
          max="8"
          step="0.25"
          placeholder="Ex.: 2"
          defaultValue={
            course?.lesson_duration_minutes
              ? course.lesson_duration_minutes / 60
              : ""
          }
        />
        <small>
          A duração será gravada nas chamadas. Ao configurar pela primeira vez,
          também será usada nas chamadas antigas sem duração.
        </small>
      </label>
      <fieldset className="weekday-options">
        <legend>Dias de aula para a previsão</legend>
        {weekdays.map((day, index) => (
          <label key={day}>
            <input
              type="checkbox"
              name="lesson_days"
              value={index}
              defaultChecked={(course?.lesson_days?.length
                ? course.lesson_days
                : scheduleDays(course?.schedule || "")
              ).includes(index)}
            />
            {day}
          </label>
        ))}
      </fieldset>
    </fieldset>
  );
}
