"use client";
import { useMemo, useState, type ReactNode } from "react";
import {
  AlertCircle,
  ArrowUpRight,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  GraduationCap,
  Phone,
  Plus,
  TrendingUp,
  UserMinus,
  Users,
} from "lucide-react";
import {
  today,
  displayDate,
  studentDisplayName,
  type Store,
  type Profile,
  type Student,
} from "@/lib/domain";
import { managementDashboard } from "@/lib/management-dashboard";
import { studentPlacement } from "@/lib/individual";
import { StudentAvatar } from "./student-avatar";
import { OccupancyBar } from "./occupancy-bar";
import { classFrame } from "@/lib/class-appearance";
interface Props {
  store: Store;
  historyStore: Store;
  profile: Profile;
  unit: string;
  onStudent: (student: Student) => void;
  onAction: (kind: string, student?: Student) => void;
  onPage: (page: string) => void;
}
interface PriorityItem {
  id: string;
  title: string;
  detail: string;
  student?: Student;
  action: () => void;
  actionLabel: string;
  urgent: boolean;
  kind: "absence" | "pedagogy" | "occurrence";
}
function Metric({
  label,
  value,
  detail,
  icon,
  tone,
  onClick,
}: {
  label: string;
  value: number;
  detail: string;
  icon: ReactNode;
  tone: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`management-metric ${tone}`}
      onClick={onClick}
    >
      <span className="management-metric-label">
        {label}
        <span className="management-metric-icon">{icon}</span>
      </span>
      <strong>
        {value}
        <ArrowUpRight size={17} />
      </strong>
      <small>{detail}</small>
    </button>
  );
}
export function ManagementOverview({
  store,
  historyStore,
  profile,
  unit,
  onStudent,
  onAction,
  onPage,
}: Props) {
  const [days, setDays] = useState(30),
    [tab, setTab] = useState("priority");
  const reference = today();
  const data = useMemo(
    () =>
      managementDashboard(store, profile, unit, days, reference, historyStore),
    [store, historyStore, profile, unit, days, reference],
  );
  const absenceItems: PriorityItem[] = data.absentStudents.map((row) => ({
    id: `absence-${row.student.id}`,
    title: studentDisplayName(row.student),
    detail: `${row.count} falta${row.count === 1 ? "" : "s"} no período · última em ${displayDate(row.lastDate)}`,
    student: row.student,
    action: () => onAction("contact", row.student),
    actionLabel: "Registrar contato",
    urgent: row.lastAbsent || row.count >= 3,
    kind: "absence",
  }));
  const interventionItems: PriorityItem[] = data.interventions.map(
    ({ record, state }) => ({
      id: `pedagogy-${record.id}`,
      title: record.student_id
        ? studentDisplayName(
            data.students.find((s) => s.id === record.student_id) || {
              id: record.student_id,
              name: "",
            },
          )
        : data.classes.find((c) => c.id === record.class_id)?.name || "Turma",
      detail: `${state === "overdue" ? "Em atraso" : state === "today" ? "Para hoje" : "Agendado"} · ${displayDate(record.follow_up)} · ${record.skill}`,
      student: data.students.find((s) => s.id === record.student_id),
      action: () =>
        profile.role === "secretaria"
          ? onPage("pedagogy")
          : onAction(`followup:${record.id}`),
      actionLabel:
        profile.role === "secretaria"
          ? "Consultar intervenção"
          : "Registrar evolução",
      urgent: state !== "upcoming",
      kind: "pedagogy",
    }),
  );
  const occurrenceItems: PriorityItem[] = data.recurringOccurrences.map(
    ({ student, count }) => ({
      id: `occurrence-${student.id}`,
      title: studentDisplayName(student),
      detail: `${count} aulas com ocorrências individuais no período`,
      student,
      action: () => onStudent(student),
      actionLabel: "Abrir histórico",
      urgent: true,
      kind: "occurrence",
    }),
  );
  const priority = [
    ...interventionItems.filter((i) => i.urgent),
    ...absenceItems.filter((i) => i.urgent),
    ...occurrenceItems,
  ];
  const list =
    tab === "absence"
      ? absenceItems
      : tab === "pedagogy"
        ? interventionItems
        : priority;
  const visibleStudents = new Set(
    list.flatMap((item) => (item.student ? [item.student.id] : [])),
  ).size;
  const visibleGroups = list.filter((item) => !item.student).length;
  const max = Math.max(1, ...data.trend.map((row) => row.total));
  return (
    <div className="management-overview">
      <div className="management-toolbar">
        <div>
          <span className="management-scope">
            <Users size={15} />
            {data.active.length} alunos ativos
          </span>
          <label className="management-period">
            <CalendarDays size={15} />
            <select
              aria-label="Período do painel"
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
            >
              <option value={7}>Últimos 7 dias</option>
              <option value={30}>Últimos 30 dias</option>
              <option value={90}>Últimos 90 dias</option>
            </select>
          </label>
        </div>
        <div className="management-actions">
          {profile.role !== "secretaria" && (
            <button className="secondary" onClick={() => onPage("attendance")}>
              <ClipboardCheck size={16} />
              Fazer chamada
            </button>
          )}
          <button
            className="secondary"
            aria-label="Abrir relatórios"
            onClick={() => onPage("reports")}
          >
            <ArrowUpRight size={16} />
            Relatórios
          </button>
        </div>
      </div>
      <div className="management-metrics">
        <Metric
          label="Faltas no período"
          value={data.absences.length}
          detail={`${new Set(data.absences.map((a) => a.student_id)).size} ${new Set(data.absences.map((a) => a.student_id)).size === 1 ? "aluno" : "alunos"} · ${data.frequency === null ? "sem frequência calculada" : `${data.frequency}% de frequência`}`}
          icon={<AlertCircle size={18} />}
          tone="attention"
          onClick={() => setTab("absence")}
        />
        <Metric
          label="Intervenções"
          value={data.due.length}
          detail={`${data.due.filter((i) => i.state === "overdue").length} em atraso · prazos até hoje`}
          icon={<GraduationCap size={19} />}
          tone="academic"
          onClick={() => setTab("pedagogy")}
        />
        <Metric
          label="Cancelamentos"
          value={data.cancellations.length}
          detail={`${data.cancellationsInPeriod.length} no período · total no cadastro`}
          icon={<UserMinus size={18} />}
          tone="withdrawal"
          onClick={() => onAction("students:cancelamento")}
        />
        <Metric
          label="Novas matrículas"
          value={data.newEnrollments.length}
          detail={`${data.pendingEnrollments.length} ${data.pendingEnrollments.length === 1 ? "cadastro aguarda" : "cadastros aguardam"} conferência`}
          icon={<TrendingUp size={18} />}
          tone="growth"
          onClick={() => onPage("students")}
        />
      </div>
      <div className="management-main-grid">
        <section
          className="management-card management-priorities"
          aria-label="Prioridades de acompanhamento"
        >
          <header>
            <div>
              <span className="management-kicker">ACOMPANHAR</span>
              <h2>Quem precisa de atenção</h2>
            </div>
            <span className="management-count">
              {visibleStudents} {visibleStudents === 1 ? "aluno" : "alunos"}
              {visibleGroups
                ? ` · ${visibleGroups} ${visibleGroups === 1 ? "turma" : "turmas"}`
                : ""}
            </span>
          </header>
          <div
            className="management-tabs"
            role="group"
            aria-label="Filtrar prioridades do painel"
          >
            {[
              ["priority", "Prioridades", priority.length],
              ["absence", "Faltas", absenceItems.length],
              ["pedagogy", "Intervenções", interventionItems.length],
            ].map(([key, label, count]) => (
              <button
                key={key}
                type="button"
                aria-pressed={tab === key}
                className={tab === key ? "selected" : ""}
                onClick={() => setTab(String(key))}
              >
                {label}
                <b>{count}</b>
              </button>
            ))}
          </div>
          <div className="management-priority-list">
            {list.slice(0, 5).map((item) => (
              <article key={item.id}>
                <span className={`management-priority-mark ${item.kind}`}>
                  {item.student ? (
                    <StudentAvatar student={item.student} size={32} />
                  ) : (
                    <GraduationCap size={20} />
                  )}
                </span>
                <div className="management-priority-person">
                  <button
                    type="button"
                    className="student-link"
                    onClick={() =>
                      item.student ? onStudent(item.student) : item.action()
                    }
                  >
                    {item.title}
                  </button>
                  <small>{item.detail}</small>
                </div>
                <button
                  type="button"
                  className="management-item-action"
                  aria-label={`${item.actionLabel}: ${item.title}`}
                  onClick={item.action}
                >
                  {item.kind === "absence" ? (
                    <Phone size={16} />
                  ) : (
                    <ArrowUpRight size={17} />
                  )}
                  <span>
                    {item.kind === "absence"
                      ? "Contato"
                      : item.kind === "pedagogy"
                        ? "Acompanhar"
                        : "Histórico"}
                  </span>
                </button>
              </article>
            ))}
            {!list.length && (
              <div className="management-empty">
                <CheckCircle2 size={22} />
                <p>
                  {tab === "absence"
                    ? "Nenhuma falta registrada no período."
                    : tab === "pedagogy"
                      ? "Nenhuma intervenção aguardando retorno."
                      : "Nenhum alerta prioritário identificado."}
                </p>
              </div>
            )}
          </div>
          <button
            type="button"
            className="management-card-footer"
            onClick={() => onPage(tab === "pedagogy" ? "pedagogy" : "alerts")}
          >
            {tab === "pedagogy"
              ? "Ver acompanhamento pedagógico"
              : "Abrir central de atenção"}
            <ArrowUpRight size={15} />
          </button>
        </section>
        <section
          className="management-card management-attendance-chart"
          aria-label="Presença e faltas no período"
        >
          <header>
            <div>
              <span className="management-kicker">FREQUÊNCIA</span>
              <h2>Presença e faltas</h2>
            </div>
            <strong>
              {data.frequency === null ? "—" : `${data.frequency}%`}
            </strong>
          </header>
          <div className="management-chart-legend">
            <span>
              <i className="presente" />
              Presença
            </span>
            <span>
              <i className="falta" />
              Falta
            </span>
            <span>
              <i className="atrasado" />
              Atraso
            </span>
            <span>
              <i className="justificado" />
              Justificada
            </span>
          </div>
          <ol
            className="management-bars"
            aria-label={`Registros de ${displayDate(data.start)} a ${displayDate(reference)}`}
          >
            {data.trend.map((row) => (
              <li
                key={row.from}
                aria-label={`${displayDate(row.from)} a ${displayDate(row.to)}: ${row.presente} presentes, ${row.falta} faltas, ${row.atrasado} atrasos e ${row.justificado} justificadas`}
              >
                <b>{row.total}</b>
                <div className="management-bar-track">
                  {(
                    ["presente", "atrasado", "justificado", "falta"] as const
                  ).map((status) => (
                    <span
                      key={status}
                      className={status}
                      style={{ height: `${(row[status] / max) * 100}%` }}
                      title={`${status}: ${row[status]}`}
                    />
                  ))}
                </div>
                <small>{displayDate(row.from).slice(0, 5)}</small>
              </li>
            ))}
          </ol>
          <div className="management-chart-meta">
            <span>{data.marks.length} registros em aulas finalizadas</span>
            <button
              type="button"
              className="text-link"
              onClick={() => onPage("reports")}
            >
              Relatório
              <ArrowUpRight size={14} />
            </button>
          </div>
          {!data.marks.length && (
            <p className="management-chart-empty">
              Sem chamadas finalizadas neste período.
            </p>
          )}
        </section>
      </div>
      <div className="management-secondary-grid">
        <section
          className="management-card management-opportunities"
          aria-label="Oportunidades de matrícula"
        >
          <header>
            <div>
              <span className="management-kicker">COMERCIAL</span>
              <h2>Onde matricular</h2>
            </div>
            <span className="management-count">
              {data.opportunities.reduce((n, r) => n + r.vacancies, 0)} vagas
            </span>
          </header>
          <div className="management-opportunity-list">
            {data.opportunities
              .slice(0, 3)
              .map(({ course, enrolled, vacancies }) => (
                <article key={course.id} style={classFrame(course)}>
                  <div>
                    <strong>{course.name}</strong>
                    <small>
                      {vacancies} vagas · {course.enrollment_priority || 3}ª
                      opção
                    </small>
                    <OccupancyBar
                      enrolled={enrolled}
                      capacity={course.capacity}
                    />
                  </div>
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={`Matricular em ${course.name}`}
                    onClick={() => onAction(`enroll:${course.id}`)}
                  >
                    <Plus size={18} />
                  </button>
                </article>
              ))}
            {!data.opportunities.length && (
              <p className="management-empty-text">
                Nenhuma turma aberta com vagas.
              </p>
            )}
          </div>
          <button
            type="button"
            className="management-card-footer"
            onClick={() => onPage("classes")}
          >
            Ver turmas e prioridades
            <ArrowUpRight size={15} />
          </button>
        </section>
        <section
          className="management-card management-highlights"
          aria-label="Destaques dos alunos"
        >
          <header>
            <div>
              <span className="management-kicker">PEDAGÓGICO</span>
              <h2>Alunos em destaque</h2>
            </div>
            <GraduationCap size={21} />
          </header>
          <div className="management-highlight-list">
            {data.leaders.slice(0, 3).map((row) => (
              <button
                type="button"
                key={row.student.id}
                onClick={() => onStudent(row.student)}
              >
                <StudentAvatar student={row.student} size={32} />
                <span>
                  <strong>{studentDisplayName(row.student)}</strong>
                  <small>{studentPlacement(store, row.student)}</small>
                  <em>
                    {row.outcome === "achieved"
                      ? "Objetivo alcançado"
                      : row.outcome === "progress"
                        ? "Avanço registrado"
                        : `${row.rate}% de frequência · ${row.lessons} aulas`}
                  </em>
                </span>
                <ArrowUpRight size={15} />
              </button>
            ))}
            {!data.leaders.length && (
              <p className="management-empty-text">
                Ainda não há registros suficientes para identificar destaques.
              </p>
            )}
          </div>
          <details className="management-criteria">
            <summary>Critérios dos destaques</summary>
            <p>
              Frequência de pelo menos 90%, com quatro aulas avaliadas, ou
              evolução positiva confirmada pelo professor no período. Não
              representa uma classificação geral dos alunos.
            </p>
          </details>
        </section>
        <section
          className="management-card management-enrollment"
          aria-label="Movimento de matrículas"
        >
          <header>
            <div>
              <span className="management-kicker">RETENÇÃO</span>
              <h2>Matrículas e saídas</h2>
            </div>
            <Users size={20} />
          </header>
          <div className="management-flow">
            <div>
              <span>Entradas no período</span>
              <strong>{data.newEnrollments.length}</strong>
              <i
                className="growth"
                style={{
                  width: `${Math.max(0, (100 * data.newEnrollments.length) / Math.max(1, data.newEnrollments.length, data.departuresInPeriod.length))}%`,
                }}
              />
            </div>
            <div>
              <span>Saídas datadas no período</span>
              <strong>{data.departuresInPeriod.length}</strong>
              <i
                className="withdrawal"
                style={{
                  width: `${Math.max(0, (100 * data.departuresInPeriod.length) / Math.max(1, data.newEnrollments.length, data.departuresInPeriod.length))}%`,
                }}
              />
            </div>
          </div>
          <div className="management-current-status">
            <button type="button" onClick={() => onAction("students:abandono")}>
              Abandono
              <strong>
                {data.departures.filter((s) => s.status === "abandono").length}
              </strong>
            </button>
            <button
              type="button"
              onClick={() => onAction("students:inadimplencia")}
            >
              Inadimplência
              <strong>
                {
                  data.departures.filter((s) => s.status === "inadimplencia")
                    .length
                }
              </strong>
            </button>
          </div>
          <small className="management-departure-note">
            {data.unknownDepartureDates
              ? `${data.unknownDepartureDates} saídas sem data não entram no período.`
              : "Saídas: cancelamento, abandono e inadimplência."}
          </small>
          <button
            type="button"
            className="management-card-footer"
            onClick={() => onPage("alerts")}
          >
            {data.pendingEnrollments.length}{" "}
            {data.pendingEnrollments.length === 1 ? "cadastro" : "cadastros"} em
            conferência
            <ArrowUpRight size={15} />
          </button>
        </section>
      </div>
    </div>
  );
}
