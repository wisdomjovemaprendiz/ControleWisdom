"use client";
import { useState } from "react";
import {
  Users,
  UserPlus,
  ArrowUpRight,
  QrCode,
  Phone,
  Target,
  CheckCircle2,
} from "lucide-react";
import type { Store, Profile, Student, CourseClass } from "@/lib/domain";
import { studentDisplayName, absenceCount, displayDate } from "@/lib/domain";
import {
  classSalesRows,
  enrollmentStage,
  needsAbsenceOutreach,
  lastAbsence,
} from "@/lib/sales";
import { StudentAvatar } from "./student-avatar";
export function SalesDashboard({
  store,
  profile,
  onEnroll,
  onGroup,
  onStudent,
  onContact,
}: {
  store: Store;
  profile: Profile;
  onEnroll: (course?: CourseClass) => void;
  onGroup: (course: CourseClass) => void;
  onStudent: (student: Student) => void;
  onContact: (student: Student) => void;
}) {
  const [search, setSearch] = useState(""),
    [sort, setSort] = useState("priority");
  const allRows = classSalesRows(store, profile);
  const rows = allRows
    .filter(
      (r) =>
        r.open &&
        r.vacancies > 0 &&
        `${r.course.name} ${r.course.course}`
          .toLocaleLowerCase("pt-BR")
          .includes(search.toLocaleLowerCase("pt-BR")),
    )
    .sort((a, b) =>
      sort === "occupancy"
        ? a.enrolled - b.enrolled || a.priority - b.priority
        : a.priority - b.priority || a.enrolled - b.enrolled,
    );
  const own = store.students.filter(
      (s) =>
        s.unit_id === profile.unit_id &&
        s.created_by === profile.id &&
        !s.archived_at,
    ),
    pending = own.filter((s) => enrollmentStage(s) !== "complete"),
    absent = store.students.filter(
      (s) =>
        s.unit_id === profile.unit_id &&
        s.status === "ativo" &&
        needsAbsenceOutreach(store, s),
    );
  return (
    <div className="sales-workspace">
      <div className="sales-metrics">
        {[
          { icon: UserPlus, label: "Minhas matrículas", value: own.length },
          {
            icon: CheckCircle2,
            label: "Aguardando secretaria",
            value: pending.length,
          },
          {
            icon: Users,
            label: "Vagas em turmas abertas",
            value: allRows
              .filter((r) => r.open && r.vacancies > 0)
              .reduce((n, r) => n + r.vacancies, 0),
          },
          {
            icon: Phone,
            label: "Alunos para contato por faltas",
            value: absent.length,
          },
        ].map((item) => (
          <div key={item.label}>
            <item.icon size={20} />
            <strong>{item.value}</strong>
            <span>{item.label}</span>
          </div>
        ))}
      </div>
      <section className="panel sales-classes">
        <div className="panel-header">
          <div>
            <h2>Turmas com vagas</h2>
          </div>
        </div>
        <div className="sales-filters">
          <label>
            Buscar turma ou curso
            <input
              aria-label="Buscar turmas para venda"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Nome da turma ou curso…"
            />
          </label>
          <label>
            Ordenar por
            <select
              aria-label="Ordenar oportunidades"
              value={sort}
              onChange={(e) => setSort(e.target.value)}
            >
              <option value="priority">Prioridade da secretaria</option>
              <option value="occupancy">Menor número de alunos</option>
            </select>
          </label>
        </div>
        <div className="sales-class-grid">
          {rows.map((row) => (
            <article key={row.course.id}>
              <div className="sales-card-top">
                <span
                  className={`badge ${row.priority === 1 ? "red" : row.priority === 2 ? "amber" : "neutral"}`}
                >
                  {row.priority}ª opção
                </span>
                <span>{row.vacancies} vagas</span>
              </div>
              <h3>{row.course.name}</h3>
              <p>{row.course.course}</p>
              <small>
                {row.course.schedule} · {row.course.teacher}
              </small>
              <div className="sales-capacity">
                <div>
                  <span>
                    {row.enrolled} de {row.course.capacity} alunos
                  </span>
                  <strong>{row.occupancy}%</strong>
                </div>
                <progress max="100" value={row.occupancy} />
              </div>
              <div className="sales-card-actions">
                <button
                  className="primary"
                  onClick={() => onEnroll(row.course)}
                >
                  <UserPlus size={16} />
                  Pré-matricular nesta turma
                </button>
                <button
                  className="secondary"
                  onClick={() => onGroup(row.course)}
                >
                  <QrCode size={16} />
                  Grupo
                </button>
              </div>
            </article>
          ))}
        </div>
        {!rows.length && (
          <div className="empty">
            Nenhuma turma aberta com vagas para este filtro. Consulte a
            secretaria.
          </div>
        )}
      </section>
      <div className="sales-bottom">
        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>Minhas pré-matrículas</h2>
            </div>
          </div>
          {own
            .slice()
            .sort((a, b) => b.enrollment_date.localeCompare(a.enrollment_date))
            .slice(0, 12)
            .map((s) => (
              <button
                className="sales-student-row"
                key={s.id}
                onClick={() => onStudent(s)}
              >
                <StudentAvatar student={s} />
                <span className="sales-student-identity">
                  <strong>{studentDisplayName(s)}</strong>
                  <small>
                    {store.classes.find((c) => c.id === s.class_id)?.name ||
                      "Turma a definir"}
                  </small>
                </span>
                <span
                  className={`sales-student-status badge ${enrollmentStage(s) === "complete" ? "green" : "amber"}`}
                >
                  {enrollmentStage(s) === "complete"
                    ? "Concluído"
                    : "Aguardando secretaria"}
                </span>
                <ArrowUpRight size={16} />
              </button>
            ))}
          {!own.length && <div className="empty">Nenhuma pré-matrícula.</div>}
        </section>
        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>Alertas de faltas</h2>
            </div>
          </div>
          {absent.slice(0, 12).map((s) => (
            <div className="sales-absence" key={s.id}>
              <button
                className="student-link with-photo"
                onClick={() => onStudent(s)}
              >
                <StudentAvatar student={s} />
                <span>{studentDisplayName(s)}</span>
              </button>
              <p>
                {absenceCount(store, s.id)} falta(s) acumulada(s)
                {lastAbsence(store, s)
                  ? ` · Última ausência: ${displayDate(lastAbsence(store, s)!.date)}`
                  : ""}
              </p>
              <button className="secondary" onClick={() => onContact(s)}>
                <Phone size={16} />
                Registrar contato
              </button>
            </div>
          ))}
          {!absent.length && (
            <div className="empty">
              <Target size={22} />
              Nenhum alerta de faltas neste momento.
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
