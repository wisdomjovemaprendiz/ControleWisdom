"use client";
import { StudentAvatar } from "./student-avatar";
import { useState } from "react";
import { ArrowRight, Check, ClipboardList, Search } from "lucide-react";
import {
  type Store,
  type Profile,
  type Student,
  type Pedagogy,
  displayDate,
} from "@/lib/domain";
import { followUps } from "@/lib/operations";
export function FollowUpCenter({
  store,
  profile,
  unit,
  onStudent,
  onAction,
  onPedagogy,
}: {
  store: Store;
  profile: Profile;
  unit: string;
  onStudent: (s: Student) => void;
  onAction: (kind: string, s: Student) => void;
  onPedagogy: (record?: Pedagogy) => void;
}) {
  const [filter, setFilter] = useState("all"),
    [search, setSearch] = useState("");
  const tasks = followUps(store, profile, unit);
  const filtered = tasks.filter(
    (t) =>
      (filter === "all" || t.kind === filter) &&
      `${t.student.name} ${t.title}`
        .toLocaleLowerCase("pt-BR")
        .includes(search.toLocaleLowerCase("pt-BR")),
  );
  return (
    <section className="panel follow-up-center">
      <div className="panel-header">
        <div>
          <span className="index-label">FILA DE TRABALHO</span>
          <h2>{tasks.length} acompanhamentos identificados</h2>
          <p>Verifique o histórico antes de combinar um novo encaminhamento.</p>
        </div>
      </div>
      <div className="followup-toolbar">
        <div
          className="board-tabs"
          role="group"
          aria-label="Filtrar acompanhamentos"
        >
          {[
            ["all", "Todos"],
            ["absence", "Faltas"],
            ["registration", "Cadastro"],
            ["contact", "Retornos"],
            ["pedagogy", "Intervenções"],
          ].map(([key, label]) => (
            <button
              key={key}
              className={filter === key ? "selected" : ""}
              onClick={() => setFilter(key)}
            >
              {label}
              <b>
                {key === "all"
                  ? tasks.length
                  : tasks.filter((t) => t.kind === key).length}
              </b>
            </button>
          ))}
        </div>
        <label className="search">
          <Search size={15} />
          <input
            placeholder="Buscar acompanhamento"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
      </div>
      <div className="followup-list">
        {filtered.map((task) => (
          <article key={task.id}>
            <div className={`followup-type ${task.kind}`}>
              <ClipboardList size={19} />
              <span>
                {task.kind === "absence"
                  ? "FREQUÊNCIA"
                  : task.kind === "registration"
                    ? "CADASTRO"
                    : task.kind === "contact"
                      ? "CONTATO"
                      : "PEDAGÓGICO"}
              </span>
            </div>
            <div className="followup-detail">
              <button
                className="student-link with-photo"
                onClick={() => onStudent(task.student)}
              >
                <StudentAvatar student={task.student} size={29} />
                <span>{task.student.name}</span>
              </button>
              <h3>{task.title}</h3>
              <p>{task.detail}</p>
              {task.date && (
                <time>Data do acompanhamento: {displayDate(task.date)}</time>
              )}
            </div>
            <button
              className="secondary"
              onClick={() =>
                task.kind === "pedagogy"
                  ? onPedagogy(
                      store.pedagogy.find((p) => p.id === task.pedagogy_id),
                    )
                  : onAction(
                      task.kind === "registration" ? "student" : "contact",
                      task.student,
                    )
              }
            >
              {task.kind === "registration"
                ? "Completar cadastro"
                : task.kind === "pedagogy"
                  ? "Registrar evolução"
                  : "Registrar contato"}
              <ArrowRight size={15} />
            </button>
          </article>
        ))}
        {!filtered.length && (
          <div className="empty">
            <Check size={25} />
            <p>Nenhum acompanhamento corresponde ao filtro.</p>
          </div>
        )}
      </div>
    </section>
  );
}
