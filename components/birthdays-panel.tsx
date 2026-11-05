"use client";
import { studentPlacement } from "@/lib/individual";
import { studentDisplayName } from "@/lib/domain";
import { StudentAvatar } from "./student-avatar";
import { useState } from "react";
import { Cake, ArrowRight } from "lucide-react";
import { type Store, type Student, displayDate } from "@/lib/domain";
import { birthdaysThisWeek } from "@/lib/birthdays";
export function BirthdaysPanel({
  students,
  store,
  onStudent,
}: {
  students: Student[];
  store: Store;
  onStudent: (s: Student) => void;
}) {
  const [filter, setFilter] = useState("week");
  const birthdays = birthdaysThisWeek(students),
    today = birthdays.filter((b) => b.isToday),
    list = filter === "today" ? today : birthdays;
  return (
    <section id="birthdays" className="birthdays-panel">
      <div className="birthday-heading">
        <span className="birthday-icon">
          <Cake size={21} />
        </span>
        <div>
          <h2>Aniversariantes</h2>
          <p>
            {today.length
              ? `${today.length} ${today.length === 1 ? "aluno faz" : "alunos fazem"} aniversário hoje`
              : "Nenhum aniversário hoje."}
          </p>
        </div>
      </div>
      <div className="birthday-tabs">
        <button
          aria-pressed={filter === "today"}
          onClick={() => setFilter("today")}
        >
          Hoje <b>{today.length}</b>
        </button>
        <button
          aria-pressed={filter === "week"}
          onClick={() => setFilter("week")}
        >
          Esta semana <b>{birthdays.length}</b>
        </button>
      </div>
      <div className="birthday-list">
        {list.map((b) => (
          <button
            key={b.student.id}
            className="birthday-student"
            onClick={() => onStudent(b.student)}
          >
            <span className={`birthday-date ${b.isToday ? "is-today" : ""}`}>
              <strong>{displayDate(b.date).slice(0, 2)}</strong>
              <small>
                {b.isToday
                  ? "HOJE"
                  : new Date(b.date + "T12:00:00")
                      .toLocaleDateString("pt-BR", { weekday: "short" })
                      .replace(".", "")}
              </small>
            </span>
            <StudentAvatar student={b.student} size={28} />
            <span className="birthday-name">
              <strong>{studentDisplayName(b.student)}</strong>
              <small>{studentPlacement(store, b.student)}</small>
            </span>
            <ArrowRight size={14} />
          </button>
        ))}
        {!list.length && (
          <p className="birthday-empty">
            {filter === "today"
              ? "Nenhum aniversário hoje."
              : "Nenhum aniversário cadastrado nesta semana."}
          </p>
        )}
      </div>
      <small className="birthday-footer">
        {students.filter((s) => s.status === "ativo" && !s.birth_date).length}{" "}
        alunos ativos sem nascimento informado
      </small>
    </section>
  );
}
