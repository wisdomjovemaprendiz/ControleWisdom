"use client";
import {
  courseProgress,
  type createProgressIndex,
} from "@/lib/course-progress";
import { classColor } from "@/lib/class-appearance";
import { CourseProgressBar } from "./course-progress-bar";
import { displayDate, studentDisplayName } from "@/lib/domain";
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
  const group = store.classes.find((c) => c.id === student.class_id);
  return (
    <div className="student-list-progress">
      <CourseProgressBar
        progress={p}
        name={studentDisplayName(student)}
        color={group ? classColor(group) : undefined}
      />
      {p.deadlineState !== "none" && !p.inactive && (
        <small className={`course-deadline-label ${p.deadlineState}`}>
          {p.deadlineState === "upcoming"
            ? `Prazo: ${displayDate(p.lastInstallment!)}`
            : p.deadlineState === "due"
              ? "Prazo termina hoje"
              : "Prazo contratual encerrado"}
        </small>
      )}
    </div>
  );
}
