"use client";
import { StudentAvatar } from "./student-avatar";
import { BirthdaysPanel } from "./birthdays-panel";
import { useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Check,
  ChevronRight,
  ClipboardCheck,
  Clock,
  Filter,
  Plus,
  Search,
  Users,
} from "lucide-react";
import {
  type Store,
  type Profile,
  type Student,
  type CourseClass,
  type Lesson,
  today,
  displayDate,
  frequency,
  labels,
} from "@/lib/domain";
import { followUps, classLessons } from "@/lib/operations";
interface Props {
  store: Store;
  profile: Profile;
  unit: string;
  classes: CourseClass[];
  onClass: (id: string, date?: string) => void;
  onStudent: (s: Student) => void;
  onAction: (kind: string, s?: Student) => void;
  onPage: (page: string) => void;
  onMessage: (lesson: Lesson) => void;
}
export function OperationsBoard({
  store,
  profile,
  unit,
  classes,
  onClass,
  onStudent,
  onAction,
  onPage,
  onMessage,
}: Props) {
  const [selected, setSelected] = useState(""),
    [tab, setTab] = useState("all"),
    [search, setSearch] = useState(""),
    [date, setDate] = useState(today());
  const scopeClasses = classes.filter(
    (c) => profile.role !== "professor" || c.teacher_id === profile.id,
  );
  const students = store.students.filter((s) =>
      classes.some((c) => c.id === s.class_id),
    ),
    active = students.filter((s) => s.status === "ativo");
  const tasks = followUps(store, profile, unit);
  const list = scopeClasses.filter(
    (c) =>
      (tab === "all" ||
        (tab === "pending"
          ? !store.lessons.some((l) => l.class_id === c.id && l.date === date)
          : active.filter((s) => s.class_id === c.id).length / c.capacity <
            0.4)) &&
      `${c.name} ${c.teacher} ${c.course}`
        .toLocaleLowerCase("pt-BR")
        .includes(search.toLocaleLowerCase("pt-BR")),
  );
  const focus = list.find((c) => c.id === selected) || list[0];
  const focusStudents = active.filter((s) => s.class_id === focus?.id);
  const lessons = focus
    ? classLessons(store, focus.id).slice(0, 6).reverse()
    : [];
  const record = store.lessons.find(
    (l) => l.class_id === focus?.id && l.date === date,
  );
  const ownFrequency = frequency({
    ...store,
    attendance: store.attendance.filter((a) =>
      classes.some((c) => c.unit_id === a.unit_id),
    ),
  });
  const pendingCount = scopeClasses.filter(
    (c) => !store.lessons.some((l) => l.class_id === c.id && l.date === date),
  ).length;
  return (
    <div className="operations-board">
      <div className="register-metrics">
        <div>
          <span>ALUNOS EM FORMAÇÃO</span>
          <strong>
            {active.length.toString().padStart(2, "0")}
            <small>de {students.length} matrículas</small>
          </strong>
        </div>
        <div>
          <span>
            TURMAS {profile.role === "professor" ? "ATRIBUÍDAS" : "NA REDE"}
          </span>
          <strong>
            {scopeClasses.length.toString().padStart(2, "0")}
            <small>
              {scopeClasses.reduce(
                (n, c) =>
                  n +
                  c.capacity -
                  active.filter((s) => s.class_id === c.id).length,
                0,
              )}{" "}
              vagas abertas
            </small>
          </strong>
        </div>
        <div>
          <span>PRESENÇA REGISTRADA</span>
          <strong>
            {ownFrequency === null ? "—" : ownFrequency + "%"}
            <small>atrasos contam como presença</small>
          </strong>
        </div>
        <button
          onClick={() => onPage("alerts")}
          className={
            tasks.some((t) => t.priority <= 1) ? "metric-attention" : ""
          }
        >
          <span>ACOMPANHAMENTOS</span>
          <strong>
            {tasks.length.toString().padStart(2, "0")}
            <small>
              ver fila de trabalho <ArrowUpRight size={14} />
            </small>
          </strong>
        </button>
      </div>
      <div className="board-layout">
        <section className="class-register">
          <div className="section-caption">
            <span className="index-label">01 / OPERAÇÃO</span>
            <span>DIÁRIO DE CLASSE</span>
          </div>
          <div className="register-title">
            <div>
              <h2>
                {profile.role === "professor"
                  ? "Minhas turmas"
                  : "Quadro de turmas"}
              </h2>
              <p>
                Selecione uma turma para consultar o diário ou abrir a chamada.
              </p>
            </div>
            <label className="board-date">
              <span>Data de referência</span>
              <input
                type="date"
                aria-label="Data do quadro"
                value={date}
                max={today()}
                onChange={(e) => setDate(e.target.value)}
              />
            </label>
          </div>
          <div className="register-toolbar">
            <div
              className="board-tabs"
              role="group"
              aria-label="Filtrar quadro de turmas"
            >
              <button
                className={tab === "all" ? "selected" : ""}
                onClick={() => setTab("all")}
              >
                Todas <b>{scopeClasses.length}</b>
              </button>
              <button
                className={tab === "pending" ? "selected" : ""}
                onClick={() => setTab("pending")}
              >
                Sem chamada <b>{pendingCount}</b>
              </button>
              <button
                className={tab === "vacancies" ? "selected" : ""}
                onClick={() => setTab("vacancies")}
              >
                Baixa ocupação
              </button>
            </div>
            <label className="board-search">
              <Search size={16} />
              <input
                aria-label="Buscar turma no quadro"
                placeholder="Turma ou professor"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>
          </div>
          <div className="board-table-wrap">
            <table className="board-table">
              <thead>
                <tr>
                  <th>TURMA / HORÁRIO</th>
                  <th>PROFESSOR</th>
                  <th>ALUNOS</th>
                  <th>CHAMADA NA DATA</th>
                  <th>
                    <span className="sr-only">Selecionar</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {list.map((c, i) => {
                  const count = active.filter(
                      (s) => s.class_id === c.id,
                    ).length,
                    done = store.lessons.some(
                      (l) => l.class_id === c.id && l.date === date,
                    );
                  return (
                    <tr
                      key={c.id}
                      className={focus?.id === c.id ? "focused" : ""}
                    >
                      <td>
                        <button
                          className="class-selector"
                          onClick={() => setSelected(c.id)}
                          aria-pressed={focus?.id === c.id}
                        >
                          <span className="row-number">
                            {String(i + 1).padStart(2, "0")}
                          </span>
                          <span>
                            <strong>{c.name}</strong>
                            <small>{c.schedule}</small>
                          </span>
                        </button>
                      </td>
                      <td>
                        {c.teacher}
                        <small>
                          {store.units.find((u) => u.id === c.unit_id)?.name}
                        </small>
                      </td>
                      <td>
                        <span className="roster-count">
                          {count}
                          <small> / {c.capacity}</small>
                        </span>
                        <span className="capacity-line">
                          <i
                            style={{
                              width:
                                Math.min(100, (count / c.capacity) * 100) + "%",
                            }}
                          />
                        </span>
                      </td>
                      <td>
                        <span
                          className={`attendance-state ${done ? "done" : "pending"}`}
                        >
                          {done ? <Check size={12} /> : <span />}
                          {done ? "Registrada" : "Sem registro"}
                        </span>
                      </td>
                      <td>
                        <button
                          className="icon-button"
                          aria-label={`Selecionar ${c.name}`}
                          onClick={() => setSelected(c.id)}
                        >
                          <ChevronRight size={17} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {!list.length && (
              <div className="empty">
                <Filter size={25} />
                <p>Nenhuma turma corresponde a este filtro.</p>
                <button
                  className="text-link"
                  onClick={() => {
                    setTab("all");
                    setSearch("");
                  }}
                >
                  Limpar filtros
                </button>
              </div>
            )}
          </div>
          {focus && (
            <div className="class-journal">
              <div className="journal-heading">
                <div>
                  <span className="index-label">TURMA SELECIONADA</span>
                  <h3>{focus.name}</h3>
                  <p>
                    {record
                      ? `Conteúdo na data: ${record.topic}`
                      : "Consulte o histórico abaixo. Não há chamada na data selecionada."}
                  </p>
                </div>
                <div className="journal-actions">
                  {record && (
                    <button
                      className="secondary"
                      onClick={() => onMessage(record)}
                    >
                      Resumo da aula <ArrowUpRight size={15} />
                    </button>
                  )}
                  {profile.role !== "secretaria" && (
                    <button
                      className="primary"
                      onClick={() => onClass(focus.id, date)}
                    >
                      <ClipboardCheck size={16} />
                      {record ? "Revisar chamada" : "Fazer chamada"}
                    </button>
                  )}
                </div>
              </div>
              <div className="journal-table-wrap">
                <table className="journal-table">
                  <thead>
                    <tr>
                      <th>ALUNO</th>
                      {lessons.map((l) => (
                        <th key={l.id}>
                          <button
                            onClick={() => onClass(focus.id, l.date)}
                            title={l.topic}
                          >
                            {displayDate(l.date).slice(0, 5)}
                          </button>
                        </th>
                      ))}
                      <th>FREQUÊNCIA</th>
                    </tr>
                  </thead>
                  <tbody>
                    {focusStudents.map((s) => (
                      <tr key={s.id}>
                        <td>
                          <button
                            className="student-link with-photo"
                            onClick={() => onStudent(s)}
                          >
                            <StudentAvatar student={s} size={25} />
                            <span>{s.name}</span>
                          </button>
                        </td>
                        {lessons.map((l) => {
                          const status = store.attendance.find(
                            (a) =>
                              a.lesson_id === l.id && a.student_id === s.id,
                          )?.status;
                          return (
                            <td key={l.id}>
                              <span
                                className={`register-mark ${status || "none"}`}
                                aria-label={`${s.name}, ${displayDate(l.date)}: ${status ? labels[status] : "Sem registro"}`}
                                title={status ? labels[status] : "Sem registro"}
                              >
                                {status
                                  ? {
                                      presente: "P",
                                      falta: "F",
                                      atrasado: "A",
                                      justificado: "J",
                                    }[status]
                                  : "—"}
                              </span>
                            </td>
                          );
                        })}
                        <td className="frequency-value">
                          {frequency(store, s.id) === null
                            ? "—"
                            : frequency(store, s.id) + "%"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!focusStudents.length && (
                <p className="journal-empty">
                  Nenhum aluno ativo. Vincule matrículas a esta turma.
                </p>
              )}
              <div className="journal-legend">
                <span>
                  <b className="register-mark presente">P</b> Presente
                </span>
                <span>
                  <b className="register-mark falta">F</b> Falta
                </span>
                <span>
                  <b className="register-mark atrasado">A</b> Atrasado
                </span>
                <span>
                  <b className="register-mark justificado">J</b> Justificado
                </span>
                <small>
                  {lessons.length
                    ? "Até 6 aulas mais recentes"
                    : "O diário aparecerá após a primeira chamada"}
                </small>
              </div>
            </div>
          )}
        </section>
        <div className="board-side">
          <BirthdaysPanel
            store={store}
            students={students}
            onStudent={onStudent}
          />
          <aside className="work-queue">
            <div className="section-caption">
              <span className="index-label">02 / ACOMPANHAR</span>
              <span className="queue-count">{tasks.length}</span>
            </div>
            <h2>Próximas ações</h2>
            <p className="queue-intro">
              Pendências do cadastro e acompanhamentos que precisam de retorno.
            </p>
            <div className="queue-list">
              {tasks.slice(0, 3).map((task, i) => (
                <article className={`queue-task ${task.kind}`} key={task.id}>
                  <div className="task-top">
                    <span>
                      {task.kind === "absence"
                        ? "FREQUÊNCIA"
                        : task.kind === "registration"
                          ? "SECRETARIA"
                          : task.kind === "contact"
                            ? "RESPONSÁVEL"
                            : "PEDAGÓGICO"}
                    </span>
                    {task.date && <time>{displayDate(task.date)}</time>}
                  </div>
                  <h3>{task.title}</h3>
                  <button
                    className="student-link with-photo"
                    onClick={() => onStudent(task.student)}
                  >
                    <StudentAvatar student={task.student} size={25} />
                    <span>{task.student.name}</span>
                  </button>
                  <p>{task.detail}</p>
                  <button
                    className="task-action"
                    onClick={() =>
                      task.kind === "registration"
                        ? onAction("student", task.student)
                        : task.kind === "pedagogy"
                          ? onPage("pedagogy")
                          : onAction("contact", task.student)
                    }
                  >
                    {task.kind === "registration"
                      ? "Completar cadastro"
                      : task.kind === "pedagogy"
                        ? "Abrir acompanhamento"
                        : "Registrar contato"}
                    <ArrowRight size={15} />
                  </button>
                </article>
              ))}
              {!tasks.length && (
                <div className="empty">
                  <Check size={26} />
                  <p>Sem pendências identificadas nesta unidade.</p>
                </div>
              )}
            </div>
            <button className="queue-footer" onClick={() => onPage("alerts")}>
              Abrir central de acompanhamento <ArrowUpRight size={16} />
            </button>
            <div className="movement-summary">
              <span className="index-label">SITUAÇÃO DAS MATRÍCULAS</span>
              {["conclusao", "cancelamento", "abandono", "inadimplencia"].map(
                (status) => (
                  <div key={status}>
                    <span>{labels[status]}</span>
                    <strong>
                      {students
                        .filter((s) => s.status === status)
                        .length.toString()
                        .padStart(2, "0")}
                    </strong>
                  </div>
                ),
              )}
            </div>
          </aside>
        </div>
      </div>
      <div className="operational-shortcuts">
        <span>ACESSO DIRETO</span>
        <button onClick={() => onAction("student")}>
          <Plus size={17} /> Matrícula expressa <ArrowRight size={16} />
        </button>
        <button onClick={() => onPage("pedagogy")}>
          <BookOpen size={17} /> Registro pedagógico <ArrowRight size={16} />
        </button>
        <button onClick={() => onPage("reports")}>
          <ArrowUpRight size={17} /> Relatórios da unidade{" "}
          <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );
}
