"use client";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import type { Student } from "@/lib/domain";
import { studentDisplayName } from "@/lib/domain";
import { studentPhotoUrl } from "@/lib/photos";
export function PhotoZoom({
  url,
  student,
  size,
  onClose,
}: {
  url: string;
  student: Pick<Student, "id" | "name">;
  size: number;
  onClose: () => void;
}) {
  const close = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    close.current?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
      if (e.key === "Tab") {
        e.preventDefault();
        close.current?.focus();
      }
    };
    document.addEventListener("keydown", key, true);
    return () => {
      document.removeEventListener("keydown", key, true);
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, [onClose]);
  return createPortal(
    <div
      className="photo-zoom-overlay"
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Foto de ${studentDisplayName(student)} ampliada 2 vezes`}
        className="photo-zoom-dialog"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          ref={close}
          type="button"
          className="icon-button"
          aria-label="Fechar foto ampliada"
          onClick={onClose}
        >
          <X size={20} />
        </button>
        <img
          src={url}
          alt={studentDisplayName(student)}
          style={{ width: size * 2, height: size * 2 }}
        />
        <strong>{studentDisplayName(student)}</strong>
        <small>Foto ampliada · 2×</small>
      </div>
    </div>,
    document.body,
  );
}
export function StudentAvatar({
  student,
  size = 32,
}: {
  student: Student;
  size?: number;
}) {
  const [url, setUrl] = useState<string | null>(null),
    [zoom, setZoom] = useState(false),
    [zoomSize, setZoomSize] = useState(size);
  useEffect(() => {
    let current = true;
    setUrl(null);
    setZoom(false);
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
  const open = (e: React.SyntheticEvent) => {
    if (!url) return;
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as HTMLElement).focus();
    setZoomSize(e.currentTarget.getBoundingClientRect().width);
    setZoom(true);
  };
  return (
    <>
      <span
        className={`student-avatar ${url ? "student-avatar-zoomable" : ""}`}
        style={{ width: size, height: size, minWidth: size }}
        role={url ? "button" : undefined}
        tabIndex={url ? 0 : undefined}
        aria-label={
          url ? `Ampliar foto de ${studentDisplayName(student)}` : undefined
        }
        aria-hidden={url ? undefined : true}
        onClick={open}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") open(e);
        }}
      >
        {url ? (
          <img
            src={url}
            alt=""
            onError={() => {
              setUrl(null);
              setZoom(false);
            }}
          />
        ) : (
          student.name
            .trim()
            .split(/\s+/)
            .slice(0, 2)
            .map((n) => n[0])
            .join("") || "?"
        )}
      </span>
      {zoom && url && (
        <PhotoZoom
          url={url}
          student={student}
          size={zoomSize}
          onClose={() => setZoom(false)}
        />
      )}
    </>
  );
}
