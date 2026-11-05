"use client";
import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { PasswordChange } from "./password-change";
export function PasswordChangeDialog({
  onClose,
  onDone,
}: {
  onClose: () => void;
  onDone: () => void;
}) {
  const container = useRef<HTMLElement>(null),
    [busy, setBusy] = useState(false),
    busyRef = useRef(false);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null,
      overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    container.current?.querySelector("input")?.focus();
    return () => {
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, []);
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopImmediatePropagation();
        if (!busyRef.current) onClose();
      } else if (event.key === "Tab") {
        const controls = Array.from(
          container.current?.querySelectorAll<HTMLElement>(
            "input:not(:disabled),button:not(:disabled)",
          ) || [],
        );
        const first = controls[0],
          last = controls.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", key, true);
    return () => document.removeEventListener("keydown", key, true);
  }, [onClose]);
  return (
    <div
      className="modal-overlay"
      onClick={(event) => {
        if (event.target === event.currentTarget && !busyRef.current) onClose();
      }}
    >
      <section
        ref={container}
        role="dialog"
        aria-modal="true"
        aria-label="Alterar minha senha"
        className="modal password-dialog"
      >
        <button
          type="button"
          className="icon-button password-dialog-close"
          aria-label="Fechar alteração de senha"
          disabled={busy}
          onClick={onClose}
        >
          <X size={20} />
        </button>
        <PasswordChange
          onDone={onDone}
          onCancel={onClose}
          onBusyChange={(value) => {
            busyRef.current = value;
            setBusy(value);
          }}
        />
      </section>
    </div>
  );
}
