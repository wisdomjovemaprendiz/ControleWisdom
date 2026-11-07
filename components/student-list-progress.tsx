"use client";
import {
  formatHours,
  courseProgress,
  type createProgressIndex,
} from "@/lib/course-progress";
import type { Store, Student } from "@/lib/domain";
export function StudentListProgress({
  store,
  student,
  index,
}: {
  store: Store;
  student: Student;
  index: ReturnType<typeof createProgressIndex>;
}) {
  const p = courseProgress(store, student, undefined, index);
  return (
    <div className="student-list-progress">
      <span>
        {p.percent === null
          ? `${formatHours(p.completedHours)} h realizadas · carga a definir`
          : `${p.percent}% · ${formatHours(p.completedHours)} h de ${formatHours(p.totalHours!)} h`}
      </span>
      {p.percent !== null && (
        <span
          className="student-list-progress-track"
          role="progressbar"
          aria-label={`Progresso de ${student.name}`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={p.percent}
        >
          <i style={{ width: `${p.percent}%` }} />
        </span>
      )}
    </div>
  );
}
