"use client";
import { useState } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { isManager } from "@/lib/accounts";
import {
  canAccess,
  displayDate,
  today,
  type Store,
  type Profile,
} from "@/lib/domain";
import {
  calendarKinds,
  calendarEventError,
  eventsForDay,
  suggestedDates2027,
  type CalendarEvent,
} from "@/lib/school-calendar";
export function SchoolCalendar({
  store,
  profile,
  initialUnit,
  onSave,
  onDelete,
}: {
  store: Store;
  profile: Profile;
  initialUnit: string;
  onSave: (event: CalendarEvent) => Promise<boolean>;
  onDelete: (event: CalendarEvent) => Promise<boolean>;
}) {
  const [unit, setUnit] = useState(
      initialUnit === "all" ? profile.unit_id : initialUnit,
    ),
    [classId, setClassId] = useState(""),
    [month, setMonth] = useState(today().slice(0, 7));
  const [editing, setEditing] = useState<CalendarEvent | null>(null),
    [title, setTitle] = useState(""),
    [kind, setKind] = useState<CalendarEvent["kind"]>("recess"),
    [start, setStart] = useState(today()),
    [end, setEnd] = useState(today()),
    [scope, setScope] = useState("unit"),
    [rangeStart, setRangeStart] = useState<string | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const canWrite = isManager(profile.role) || profile.role === "secretaria";
  const units = store.units.filter((u) => canAccess(profile, u.id)),
    classes = store.classes.filter((c) => c.unit_id === unit);
  const year = Number(month.slice(0, 4)),
    monthIndex = Number(month.slice(5)) - 1,
    last = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate(),
    offset = (new Date(month + "-01T12:00:00Z").getUTCDay() + 6) % 7;
  const monthEnd = `${month}-${String(last).padStart(2, "0")}`;
  const relevant = store.calendar_events.filter(
    (event) =>
      (!event.unit_id || event.unit_id === unit) &&
      (!event.class_id || event.class_id === classId),
  );
  const list = relevant
    .filter(
      (event) =>
        event.start_date <= monthEnd && event.end_date >= month + "-01",
    )
    .sort(
      (a, b) =>
        a.start_date.localeCompare(b.start_date) ||
        a.title.localeCompare(b.title, "pt-BR"),
    );
  const editable = (event: CalendarEvent) =>
    isManager(profile.role) ||
    (profile.role === "secretaria" && event.unit_id === profile.unit_id);
  function reset() {
    setEditing(null);
    setTitle("");
    setKind("recess");
    setScope(classId || "unit");
    setRangeStart(null);
    setError("");
  }
  function changeMonth(delta: number) {
    const date = new Date(month + "-01T12:00:00Z");
    date.setUTCMonth(date.getUTCMonth() + delta);
    setMonth(date.toISOString().slice(0, 7));
  }
  function selectDay(date: string) {
    if (!canWrite) return;
    if (!rangeStart) {
      setStart(date);
      setEnd(date);
      setRangeStart(date);
    } else {
      setStart(date < rangeStart ? date : rangeStart);
      setEnd(date < rangeStart ? rangeStart : date);
      setRangeStart(null);
    }
  }
  function edit(event: CalendarEvent) {
    setEditing(event);
    setTitle(event.title);
    setKind(event.kind);
    setStart(event.start_date);
    setEnd(event.end_date);
    setScope(!event.unit_id ? "global" : event.class_id || "unit");
    setRangeStart(null);
    setError("");
  }
  async function action(event: CalendarEvent, remove = false) {
    setBusy(true);
    setError("");
    try {
      if (!(await (remove ? onDelete(event) : onSave(event))))
        setError(
          "Não foi possível salvar a alteração. Confira a conexão e tente novamente.",
        );
      else if (editing?.id === event.id) reset();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="school-calendar">
      <section className="panel calendar-panel">
        <div className="panel-header">
          <div>
            <span className="index-label">CALENDÁRIO ESCOLAR</span>
            <h2>Dias sem aula</h2>
          </div>
          <button className="secondary" onClick={() => setMonth("2027-01")}>
            Ver 2027
          </button>
        </div>
        <div className="calendar-filters">
          <label>
            Unidade
            <select
              aria-label="Unidade do calendário"
              value={unit}
              disabled={busy || !isManager(profile.role)}
              onChange={(e) => {
                setUnit(e.target.value);
                setClassId("");
                reset();
                setScope("unit");
              }}
            >
              {units.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Turma
            <select
              aria-label="Turma do calendário"
              value={classId}
              disabled={busy}
              onChange={(e) => {
                setClassId(e.target.value);
                reset();
                setScope(e.target.value || "unit");
              }}
            >
              <option value="">Unidade inteira</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="calendar-month-controls">
          <button
            className="icon-button"
            aria-label="Mês anterior"
            onClick={() => changeMonth(-1)}
          >
            <ChevronLeft size={18} />
          </button>
          <input
            aria-label="Mês do calendário"
            type="month"
            min="1900-01"
            max="2100-12"
            value={month}
            onChange={(e) => {
              if (e.target.value) setMonth(e.target.value);
            }}
          />
          <button
            className="icon-button"
            aria-label="Próximo mês"
            onClick={() => changeMonth(1)}
          >
            <ChevronRight size={18} />
          </button>
        </div>
        <div className="calendar-weekdays" aria-hidden="true">
          {["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map((name) => (
            <span key={name}>{name}</span>
          ))}
        </div>
        <div className="calendar-grid" aria-label="Dias do mês">
          {Array.from({ length: offset }, (_, i) => (
            <span key={`empty${i}`} />
          ))}
          {Array.from({ length: last }, (_, i) => {
            const date = `${month}-${String(i + 1).padStart(2, "0")}`,
              events = eventsForDay(relevant, date, unit, classId || null),
              selected = canWrite && date >= start && date <= end;
            return (
              <button
                key={date}
                type="button"
                className={`calendar-day ${events.length ? (events.some((event) => event.kind === "recess") ? "recess" : "holiday") : ""} ${selected ? "range-selected" : ""}`}
                aria-label={`${displayDate(date)}${events.length ? ` — ${events.map((event) => event.title).join("; ")}` : ""}`}
                aria-pressed={selected}
                disabled={busy || !canWrite}
                onClick={() => selectDay(date)}
              >
                <strong>{i + 1}</strong>
                {events.length > 0 && <span>{events[0].title}</span>}
                {events.length > 1 && <small>+{events.length - 1}</small>}
              </button>
            );
          })}
        </div>
        <div className="calendar-legend">
          <span>
            <i className="holiday" />
            Feriado / sem aula
          </span>
          <span>
            <i className="recess" />
            Recesso
          </span>
        </div>
        {canWrite && (
          <p className="calendar-caption">
            Clique no primeiro e no último dia do período, ou use as datas ao
            lado.
          </p>
        )}
      </section>
      <div className="calendar-side">
        {canWrite && (
          <form
            className="panel calendar-form"
            onSubmit={async (event) => {
              event.preventDefault();
              const record: CalendarEvent = {
                ...editing,
                id: editing?.id || crypto.randomUUID(),
                unit_id: scope === "global" ? null : unit,
                class_id: scope !== "unit" && scope !== "global" ? scope : null,
                title: title.trim(),
                kind,
                start_date: start,
                end_date: end,
                enabled: editing?.enabled ?? true,
              };
              const invalid = calendarEventError(record);
              if (invalid) {
                setError(invalid);
                return;
              }
              setBusy(true);
              setError("");
              try {
                if (await onSave(record)) {
                  setClassId(record.class_id || "");
                  setMonth(record.start_date.slice(0, 7));
                  reset();
                  setScope(record.class_id || "unit");
                } else setError("Não foi possível salvar o período.");
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <header>
              <h2>{editing ? "Editar período" : "Novo período sem aula"}</h2>
              {editing && (
                <button type="button" className="text-link" onClick={reset}>
                  Novo
                </button>
              )}
            </header>
            <fieldset disabled={busy}>
              <label>
                Motivo
                <input
                  aria-label="Motivo do dia sem aula"
                  required
                  maxLength={160}
                  value={title}
                  placeholder="Ex.: Recesso de julho"
                  onChange={(e) => setTitle(e.target.value)}
                />
              </label>
              <div className="form-grid">
                <label>
                  De
                  <input
                    type="date"
                    aria-label="Início do período sem aula"
                    required
                    value={start}
                    onChange={(e) => {
                      setStart(e.target.value);
                      if (e.target.value > end) setEnd(e.target.value);
                    }}
                  />
                </label>
                <label>
                  Até
                  <input
                    type="date"
                    aria-label="Fim do período sem aula"
                    required
                    min={start}
                    value={end}
                    onChange={(e) => setEnd(e.target.value)}
                  />
                </label>
              </div>
              <label>
                Tipo
                <select
                  aria-label="Tipo do dia sem aula"
                  value={kind}
                  onChange={(e) =>
                    setKind(e.target.value as CalendarEvent["kind"])
                  }
                >
                  {Object.entries(calendarKinds).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Aplicar a
                <select
                  aria-label="Abrangência do período"
                  value={scope}
                  onChange={(e) => setScope(e.target.value)}
                >
                  <option value="unit">Toda esta unidade</option>
                  {isManager(profile.role) && (
                    <option value="global">Todas as unidades</option>
                  )}
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
            </fieldset>
            <div className="calendar-form-actions">
              <button
                type="button"
                className="secondary"
                disabled={busy}
                onClick={reset}
              >
                Limpar
              </button>
              <button type="submit" className="primary" disabled={busy}>
                <Plus size={16} />
                {busy ? "Salvando…" : "Salvar período"}
              </button>
            </div>
          </form>
        )}
        {error && (
          <div className="error" role="alert">
            {error}
          </div>
        )}
        <section className="panel calendar-event-list">
          <header>
            <h2>Períodos do mês</h2>
            <span>{list.length}</span>
          </header>
          {list.map((event) => (
            <article
              key={event.id}
              className={event.enabled ? "" : "disabled-event"}
            >
              <div>
                <strong>{event.title}</strong>
                <small>
                  {displayDate(event.start_date)}
                  {event.end_date !== event.start_date
                    ? ` a ${displayDate(event.end_date)}`
                    : ""}
                </small>
                <small>
                  {event.source_key?.startsWith("br-")
                    ? "Feriado nacional"
                    : !event.unit_id
                      ? "Todas as unidades"
                      : event.class_id
                        ? classes.find((c) => c.id === event.class_id)?.name
                        : "Toda a unidade"}
                  {!event.enabled ? " · Não aplicado" : ""}
                </small>
              </div>
              {editable(event) && (
                <div className="calendar-event-actions">
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={`Editar ${event.title}`}
                    disabled={busy}
                    onClick={() => edit(event)}
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    type="button"
                    className="text-link"
                    disabled={busy}
                    onClick={() =>
                      void action({ ...event, enabled: !event.enabled })
                    }
                  >
                    {event.enabled ? "Desativar" : "Ativar"}
                  </button>
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={`Excluir ${event.title}`}
                    disabled={busy}
                    onClick={() => void action(event, true)}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              )}
            </article>
          ))}
          {!list.length && <p>Nenhum período sem aula neste mês.</p>}
        </section>
        {canWrite && (
          <details className="panel calendar-suggestions">
            <summary>Datas locais e facultativas de 2027</summary>
            <p>
              Selecione para preparar o período e confirme se a unidade ficará
              sem aula.
            </p>
            {suggestedDates2027.map((event) => (
              <button
                type="button"
                className="text-link"
                key={event.start}
                onClick={() => {
                  reset();
                  setTitle(event.title);
                  setKind(event.kind);
                  setStart(event.start);
                  setEnd(event.end);
                  setMonth(event.start.slice(0, 7));
                }}
              >
                <CalendarDays size={15} />
                {event.title}
                <small>{displayDate(event.start)}</small>
              </button>
            ))}
          </details>
        )}
      </div>
    </div>
  );
}
