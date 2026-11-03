"use client";
import { CalendarClock, ArrowRight } from "lucide-react";
import type { Store, Profile, Pedagogy } from "@/lib/domain";
import { displayDate, studentDisplayName } from "@/lib/domain";
import { pendingPedagogy } from "@/lib/pedagogy";
export function PedagogyAgenda({
  store,
  profile,
  unit,
  onFollowUp,
}: {
  store: Store;
  profile: Profile;
  unit: string;
  onFollowUp: (record: Pedagogy) => void;
}) {
  const items = pendingPedagogy(store, profile, unit);
  return (
    <section className="panel pedagogy-agenda">
      <div className="panel-header">
        <div>
          <span className="index-label">ACOMPANHAMENTO PEDAGÓGICO</span>
          <h2>
            <CalendarClock size={21} />
            Intervenções e retornos
          </h2>
          <p>
            {items.filter((i) => i.state !== "upcoming").length}{" "}
            acompanhamento(s) para hoje ou em atraso.
          </p>
        </div>
      </div>
      <div className="pedagogy-agenda-list">
        {items.map(({ record, state }) => (
          <article key={record.id}>
            <div>
              <span
                className={`badge ${state === "overdue" ? "red" : state === "today" ? "amber" : "neutral"}`}
              >
                {state === "overdue"
                  ? "Em atraso"
                  : state === "today"
                    ? "Hoje"
                    : "Agendado"}{" "}
                · {displayDate(record.follow_up)}
              </span>
              <strong>
                {record.student_id
                  ? studentDisplayName(
                      store.students.find(
                        (s) => s.id === record.student_id,
                      ) || { id: record.student_id, name: "" },
                    )
                  : store.classes.find((c) => c.id === record.class_id)?.name ||
                    "Turma"}
              </strong>
              <p>{record.skill}</p>
            </div>
            <button
              className="secondary"
              disabled={profile.role === "secretaria"}
              onClick={() => onFollowUp(record)}
            >
              {profile.role === "secretaria"
                ? "Somente consulta"
                : "Registrar evolução"}
              <ArrowRight size={16} />
            </button>
          </article>
        ))}
      </div>
      {!items.length && (
        <p className="pedagogy-agenda-empty">
          Nenhuma intervenção aguardando acompanhamento.
        </p>
      )}
    </section>
  );
}
