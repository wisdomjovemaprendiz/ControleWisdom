"use client";
import { useMemo, useState } from "react";
import { CalendarDays, Download } from "lucide-react";
import {
  canAccess,
  displayDate,
  studentDisplayName,
  today,
  type Store,
  type Profile,
} from "@/lib/domain";
import { canTeachIndividual, weekdays } from "@/lib/individual";
import { signatureMonths, studentWeekdays } from "@/lib/school-calendar";
import { StudentAvatar } from "./student-avatar";
import { naturalName } from "@/lib/occurrences";
export function SignatureSheetBuilder({
  store,
  profile,
  unit,
  onCalendar,
}: {
  store: Store;
  profile: Profile;
  unit: string;
  onCalendar: () => void;
}) {
  const [studentId, setStudentId] = useState(""),
    [query, setQuery] = useState(""),
    [from, setFrom] = useState(today().slice(0, 7)),
    [to, setTo] = useState(today().slice(0, 7)),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const students = store.students
    .filter(
      (s) =>
        !s.archived_at &&
        s.status === "ativo" &&
        canAccess(profile, s.unit_id) &&
        (unit === "all" || s.unit_id === unit) &&
        (profile.role !== "professor" ||
          store.classes.some(
            (c) => c.id === s.class_id && c.teacher_id === profile.id,
          ) ||
          canTeachIndividual(profile, s)),
    )
    .sort((a, b) => naturalName(studentDisplayName(a), studentDisplayName(b)));
  const student = students.find((s) => s.id === studentId),
    group = store.classes.find((c) => c.id === student?.class_id);
  const result = useMemo(() => {
    if (!student) return { months: [], error: "" };
    try {
      return { months: signatureMonths(store, student, from, to), error: "" };
    } catch (e) {
      return { months: [], error: (e as Error).message };
    }
  }, [store, student, from, to]);
  const names = students.filter(
    (s) =>
      s.id === studentId ||
      `${s.name} ${store.classes.find((c) => c.id === s.class_id)?.name || ""}`
        .toLocaleLowerCase("pt-BR")
        .includes(query.toLocaleLowerCase("pt-BR")),
  );
  const total = result.months.reduce((n, month) => n + month.days.length, 0),
    closed = result.months.reduce(
      (n, month) => n + month.days.filter((day) => day.closures.length).length,
      0,
    );
  return (
    <section
      className="panel signature-builder"
      aria-label="Emissão da ficha avaliativa"
    >
      <div className="panel-header">
        <div>
          <span className="index-label">PRESENÇA E AVALIAÇÃO</span>
          <h2>Ficha avaliativa do aluno</h2>
        </div>
        <button type="button" className="secondary" onClick={onCalendar}>
          <CalendarDays size={16} />
          Dias sem aula
        </button>
      </div>
      <div className="signature-builder-body">
        <div className="signature-controls">
          <label>
            Buscar aluno
            <input
              aria-label="Buscar aluno para ficha avaliativa"
              placeholder="Nome ou turma"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <label>
            Aluno
            <select
              aria-label="Aluno da ficha avaliativa"
              value={student?.id || ""}
              onChange={(e) => {
                setStudentId(e.target.value);
                setError("");
              }}
            >
              <option value="">Selecione o aluno</option>
              {names.map((s) => (
                <option key={s.id} value={s.id}>
                  {studentDisplayName(s)} ·{" "}
                  {s.enrollment_mode === "individual"
                    ? "Aulas individuais"
                    : store.classes.find((c) => c.id === s.class_id)?.name ||
                      "Sem turma"}
                </option>
              ))}
            </select>
          </label>
          <label>
            Mês inicial
            <input
              type="month"
              min="1900-01"
              max="2100-12"
              aria-label="Mês inicial da ficha"
              value={from}
              onChange={(e) => {
                setFrom(e.target.value);
                if (e.target.value > to) setTo(e.target.value);
              }}
            />
          </label>
          <label>
            Mês final
            <input
              type="month"
              min={from}
              max="2100-12"
              aria-label="Mês final da ficha"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </label>
        </div>
        {student && (
          <div className="signature-student-summary">
            <StudentAvatar student={student} size={40} />
            <div>
              <strong>{studentDisplayName(student)}</strong>
              <small>
                {student.enrollment_mode === "individual"
                  ? "Aulas individuais"
                  : group?.name || "Sem turma"}{" "}
                ·{" "}
                {studentWeekdays(store, student)
                  .map((d) => weekdays[d])
                  .join(" e ") || "Dias de aula não definidos"}
              </small>
              <small>Responsável: {student.guardian || "Não informado"}</small>
            </div>
            <span className="signature-date-count">
              {total} datas · {closed} sem aula
            </span>
          </div>
        )}
        {(error || result.error) && (
          <p className="error" role="alert">
            {error || result.error}
          </p>
        )}
        {!!result.months.length && (
          <details className="signature-schedule-preview">
            <summary>Conferir datas da ficha</summary>
            {result.months.map((month) => (
              <div key={month.month}>
                <h3>{month.label}</h3>
                <ul>
                  {month.days.map((day) => (
                    <li
                      key={day.date}
                      className={day.closures.length ? "closed" : ""}
                    >
                      <time>{displayDate(day.date)}</time>
                      <span>
                        {day.closures.length
                          ? `Sem aula — ${[...new Set(day.closures.map((event) => event.title))].join(" · ")}`
                          : "Conteúdo, assinatura e avaliação em branco"}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </details>
        )}
        <div className="signature-download">
          <small>
            Logo e dados preenchidos. Espaço para assinatura e avaliação à mão.
          </small>
          <button
            type="button"
            className="primary"
            disabled={busy || !student || !!result.error || !total}
            onClick={async () => {
              if (!student) return;
              setBusy(true);
              setError("");
              try {
                const { createSignatureSheetPdf } =
                  await import("@/lib/signature-sheet-pdf");
                const doc = await createSignatureSheetPdf({
                  store,
                  student,
                  from,
                  to,
                });
                doc.save(
                  `ficha-avaliativa-${studentDisplayName(student)
                    .normalize("NFD")
                    .replace(/[\u0300-\u036f]/g, "")
                    .replace(/[^a-zA-Z0-9]+/g, "-")
                    .slice(0, 70)}-${from}-${to}.pdf`,
                );
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <Download size={16} />
            {busy ? "Gerando PDF…" : "Baixar ficha avaliativa PDF"}
          </button>
        </div>
      </div>
    </section>
  );
}
