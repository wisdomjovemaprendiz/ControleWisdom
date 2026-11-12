"use client";
import { useState } from "react";
import { Check, ChevronLeft, ChevronRight, Minus } from "lucide-react";
import { displayDate } from "@/lib/domain";
import type { SignatureMonth } from "@/lib/school-calendar";

export function SignatureDateCalendar({
  months,
  excludedDates,
  onChange,
}: {
  months: SignatureMonth[];
  excludedDates: string[];
  onChange: (dates: string[]) => void;
}) {
  const [index, setIndex] = useState(0);
  const month = months[Math.min(index, months.length - 1)];
  if (!month) return null;
  const year = Number(month.month.slice(0, 4));
  const monthIndex = Number(month.month.slice(5)) - 1;
  const last = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  const offset = (new Date(month.month + "-01T12:00:00Z").getUTCDay() + 6) % 7;
  const scheduled = new Map(month.days.map((day) => [day.date, day]));
  return (
    <div
      className="signature-date-calendar"
      aria-label="Calendário de datas da ficha"
    >
      <div className="calendar-month-controls">
        <button
          type="button"
          className="icon-button"
          aria-label="Mês anterior da ficha"
          disabled={index === 0}
          onClick={() => setIndex(index - 1)}
        >
          <ChevronLeft size={18} />
        </button>
        <select
          aria-label="Mês das datas da ficha"
          value={month.month}
          onChange={(event) =>
            setIndex(
              months.findIndex((item) => item.month === event.target.value),
            )
          }
        >
          {months.map((item) => (
            <option key={item.month} value={item.month}>
              {item.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="icon-button"
          aria-label="Próximo mês da ficha"
          disabled={index >= months.length - 1}
          onClick={() => setIndex(index + 1)}
        >
          <ChevronRight size={18} />
        </button>
      </div>
      <div className="calendar-weekdays" aria-hidden="true">
        {["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map((day) => (
          <span key={day}>{day}</span>
        ))}
      </div>
      <div className="calendar-grid" aria-label={month.label}>
        {Array.from({ length: offset }, (_, i) => (
          <span key={`empty-${i}`} aria-hidden="true" />
        ))}
        {Array.from({ length: last }, (_, i) => {
          const date = `${month.month}-${String(i + 1).padStart(2, "0")}`;
          const day = scheduled.get(date);
          const selected = !!day && !excludedDates.includes(date);
          const closure =
            day?.closures.map((event) => event.title).join(" · ") || "";
          return (
            <button
              type="button"
              key={date}
              className={`calendar-day signature-calendar-day ${!day ? "unscheduled" : selected ? "included" : "excluded"} ${day?.closures.length ? "closed" : ""}`}
              aria-label={
                day
                  ? `Incluir ${displayDate(date)} na ficha`
                  : `${displayDate(date)} — Sem aula prevista`
              }
              aria-pressed={selected}
              disabled={!day}
              title={
                closure ||
                (day
                  ? selected
                    ? "Incluído na ficha"
                    : "Retirado da ficha"
                  : "Sem aula prevista")
              }
              onClick={() =>
                onChange(
                  selected
                    ? [...excludedDates, date]
                    : excludedDates.filter((item) => item !== date),
                )
              }
            >
              <strong>{i + 1}</strong>
              {!!day &&
                (selected ? (
                  <Check
                    className="signature-day-state"
                    size={14}
                    aria-hidden="true"
                  />
                ) : (
                  <Minus
                    className="signature-day-state"
                    size={14}
                    aria-hidden="true"
                  />
                ))}
              {closure && <span>{closure}</span>}
            </button>
          );
        })}
      </div>
      <div className="calendar-legend signature-calendar-legend">
        <span>
          <i className="included" />
          Incluído
        </span>
        <span>
          <i className="excluded" />
          Retirado
        </span>
        <span>
          <i className="closed" />
          Feriado / recesso
        </span>
      </div>
    </div>
  );
}
