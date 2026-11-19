import type { CSSProperties } from "react";
import { formatHours, type CourseProgress } from "@/lib/course-progress";
export function CourseProgressBar({
  progress: p,
  color = "#174b91",
  name = "aluno",
}: {
  progress: CourseProgress;
  color?: string;
  name?: string;
}) {
  if (!p.totalHours)
    return (
      <span className="course-progress-help">
        {formatHours(p.completedHours)} h realizadas · carga a definir
      </span>
    );
  const scale = Math.max(p.totalHours, p.completedHours),
    normalWidth = (100 * Math.min(p.completedHours, p.totalHours)) / scale,
    extraWidth = (100 * p.excessHours) / scale;
  return (
    <div className="course-progress-visual">
      <div className="course-progress-value">
        {p.percent?.toLocaleString("pt-BR")}% da carga contratada
      </div>
      <div
        className="course-progress-segmented"
        role="progressbar"
        aria-label={`Carga horária de ${name}`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={p.percent!}
        aria-valuetext={`${formatHours(p.completedHours)} h realizadas de ${formatHours(p.totalHours)} h contratadas${p.excessHours ? `; ${formatHours(p.excessHours)} h excedentes` : ""}`}
        style={{ "--progress-normal": color } as CSSProperties}
      >
        <span className="contracted" style={{ width: `${normalWidth}%` }} />
        {p.excessHours > 0 && (
          <span className="excess" style={{ width: `${extraWidth}%` }} />
        )}
      </div>
      <div className="course-progress-labels">
        <span>
          {formatHours(Math.min(p.completedHours, p.totalHours))} h de{" "}
          {formatHours(p.totalHours)} h contratadas
        </span>
        {p.excessHours > 0 && (
          <strong className="course-excess-label">
            +{formatHours(p.excessHours)} h excedentes
          </strong>
        )}
      </div>
      {!p.completed && p.remainingHours !== null && (
        <small>{formatHours(p.remainingHours)} h restantes</small>
      )}
      {p.excessHours > 0 && (
        <small>
          Total realizado: {formatHours(p.completedHours)} h ·{" "}
          {p.actualPercent?.toLocaleString("pt-BR")}% do contratado
        </small>
      )}
    </div>
  );
}
