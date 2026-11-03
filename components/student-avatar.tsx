"use client";
import { useEffect, useState } from "react";
import type { Student } from "@/lib/domain";
import { studentPhotoUrl } from "@/lib/photos";
export function StudentAvatar({
  student,
  size = 32,
}: {
  student: Student;
  size?: number;
}) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let current = true;
    setUrl(null);
    const path = student.photo_path;
    if (!path) return;
    const refresh = () =>
      void studentPhotoUrl(path).then((value) => {
        if (current) setUrl(value);
      });
    refresh();
    const timer = setInterval(refresh, 240000);
    return () => {
      current = false;
      clearInterval(timer);
    };
  }, [student.photo_path]);
  return (
    <span
      className="student-avatar"
      aria-hidden="true"
      style={{ width: size, height: size, minWidth: size }}
    >
      {url ? (
        <img src={url} alt="" onError={() => setUrl(null)} />
      ) : (
        student.name
          .trim()
          .split(/\s+/)
          .slice(0, 2)
          .map((n) => n[0])
          .join("") || "?"
      )}
    </span>
  );
}
