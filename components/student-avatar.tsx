"use client";
import { useEffect, useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { Student } from "@/lib/domain";
import { studentDisplayName } from "@/lib/domain";
import { studentPhotoUrl } from "@/lib/photos";
export function PhotoZoom({
  url,
  student,
  anchor,
  onClose,
}: {
  url: string;
  student: Pick<Student, "id" | "name">;
  anchor: HTMLElement;
  onClose: () => void;
}) {
  const [bounds, setBounds] = useState(() => anchor.getBoundingClientRect());
  useLayoutEffect(() => {
    const reposition = () => {
      const next = anchor.getBoundingClientRect();
      if (
        !anchor.isConnected ||
        next.bottom <= 0 ||
        next.top >= innerHeight ||
        next.right <= 0 ||
        next.left >= innerWidth
      ) {
        onClose();
        return;
      }
      setBounds((previous) =>
        previous.x === next.x &&
        previous.y === next.y &&
        previous.width === next.width &&
        previous.height === next.height
          ? previous
          : next,
      );
    };
    reposition();
    window.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);
    return () => {
      window.removeEventListener("scroll", reposition, true);
      window.removeEventListener("resize", reposition);
    };
  }, [anchor, onClose]);
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopImmediatePropagation();
        onClose();
      } else if (event.key === "Tab") onClose();
    };
    document.addEventListener("keydown", key, true);
    return () => document.removeEventListener("keydown", key, true);
  }, [onClose]);
  return createPortal(
    <div
      className="photo-zoom-overlay"
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onClose();
      }}
    >
      <img
        className="photo-zoom-image"
        src={url}
        alt={`Foto de ${studentDisplayName(student)} ampliada 2 vezes`}
        style={{
          width: bounds.width * 2,
          height: bounds.height * 2,
          left: Math.max(
            0,
            Math.min(
              bounds.left - bounds.width / 2,
              window.innerWidth - bounds.width * 2,
            ),
          ),
          top: Math.max(
            0,
            Math.min(
              bounds.top - bounds.height / 2,
              window.innerHeight - bounds.height * 2,
            ),
          ),
        }}
      />
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
    [zoom, setZoom] = useState<HTMLElement | null>(null);
  useEffect(() => {
    let current = true;
    setUrl(null);
    setZoom(null);
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
    setZoom(e.currentTarget as HTMLElement);
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
              setZoom(null);
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
          anchor={zoom}
          onClose={() => setZoom(null)}
        />
      )}
    </>
  );
}
