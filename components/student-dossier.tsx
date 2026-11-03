"use client";
import { comparePedagogy } from "@/lib/domain";
import { outcomeLabels } from "@/lib/pedagogy";
import { StudentAvatar } from "./student-avatar";
import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, Download, MessageCircle, Pencil, X } from "lucide-react";
import {
  type Store,
  type Student,
  frequency,
  absenceCount,
  displayDate,
  labels,
} from "@/lib/domain";
export function StudentDossier({
  student: s,
  store,
  onClose,
  onEdit,
  onMessage,
  onPdf,
}: {
  student: Student;
  store: Store;
  onClose: () => void;
  onEdit: () => void;
  onMessage: () => void;
  onPdf: () => void;
}) {
  const dialogRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const dialog = dialogRef.current;
    const focusable = () =>
      Array.from(
        dialog?.querySelectorAll<HTMLElement>(
          'button:not([disabled]),a[href],input,select,textarea,[tabindex="0"]',
        ) || [],
      ).filter((e) => e.getClientRects().length > 0);
    focusable()[0]?.focus();
    function handle(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
      if (event.key === "Tab") {
        const nodes = focusable(),
          first = nodes[0],
          last = nodes[nodes.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    }
    document.addEventListener("keydown", handle);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener("keydown", handle);
      previous?.focus();
    };
  }, []);
  const [tab, setTab] = useState("summary");
  const lessons = store.lessons
    .filter((l) =>
      store.attendance.some(
        (a) => a.lesson_id === l.id && a.student_id === s.id,
      ),
    )
    .sort((a, b) => b.date.localeCompare(a.date));
  const records = store.pedagogy
    .filter((p) => p.student_id === s.id)
    .sort(comparePedagogy);
  const contacts = store.contacts
    .filter((c) => c.student_id === s.id)
    .sort((a, b) => b.date.localeCompare(a.date));
  return (
    <div
      className="dossier-overlay"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <section
        className="dossier"
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="dossier-title"
      >
        <header>
          <span className="index-label">FICHA DO ALUNO</span>
          <button
            className="icon-button"
            aria-label="Fechar ficha"
            onClick={onClose}
          >
            <X size={22} />
          </button>
        </header>
        <div className="dossier-identity">
          <div className="dossier-photo">
            <StudentAvatar student={s} size={68} />
          </div>
          <span
            className={`attendance-state ${s.status === "ativo" ? "done" : "pending"}`}
          >
            {labels[s.status]}
          </span>
          <h2 id="dossier-title">{s.name}</h2>
          <p>
            {store.classes.find((c) => c.id === s.class_id)?.name} /{" "}
            {store.units.find((u) => u.id === s.unit_id)?.name}
          </p>
        </div>
        <div className="dossier-stats">
          <div>
            <span>FREQUÊNCIA</span>
            <strong>
              {frequency(store, s.id) === null
                ? "—"
                : frequency(store, s.id) + "%"}
            </strong>
          </div>
          <div>
            <span>FALTAS</span>
            <strong>{absenceCount(store, s.id)}</strong>
          </div>
          <div>
            <span>MATRÍCULA</span>
            <strong>{displayDate(s.enrollment_date)}</strong>
          </div>
        </div>
        <div
          className="dossier-tabs"
          role="tablist"
          aria-label="Seções da ficha"
        >
          {[
            ["summary", "Cadastro"],
            ["attendance", "Frequência"],
            ["pedagogy", "Pedagógico"],
            ["contacts", "Contatos"],
          ].map(([key, name]) => (
            <button
              role="tab"
              key={key}
              aria-selected={tab === key}
              onClick={() => setTab(key)}
            >
              {name}
            </button>
          ))}
        </div>
        <div className="dossier-content" role="tabpanel">
          {tab === "summary" && (
            <>
              <dl className="student-details">
                {[
                  [
                    "Formação contratada",
                    store.offerings.find((o) => o.id === s.offering_id)?.name,
                  ],
                  ["Data de nascimento", displayDate(s.birth_date)],
                  ["Responsável", s.guardian],
                  ["WhatsApp do responsável", s.guardian_phone],
                  ["Telefone do aluno", s.phone],
                  ["E-mail", s.email],
                  ["Endereço", s.address],
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd>{value || "Não informado"}</dd>
                  </div>
                ))}
              </dl>
              {s.archive_reason && (
                <div className="dossier-note">
                  <strong>Motivo do arquivamento</strong>
                  <p>{s.archive_reason}</p>
                </div>
              )}
            </>
          )}
          {tab === "attendance" && (
            <div className="dossier-timeline">
              {lessons.map((l) => {
                const status = store.attendance.find(
                  (a) => a.student_id === s.id && a.lesson_id === l.id,
                )!.status;
                return (
                  <article key={l.id}>
                    <time>{displayDate(l.date)}</time>
                    <span className={`register-mark ${status}`}>
                      {labels[status]}
                    </span>
                    <h3>{l.topic}</h3>
                    <p>{l.teacher}</p>
                  </article>
                );
              })}
              {!lessons.length && (
                <p className="dossier-empty">
                  Nenhuma chamada registrada para este aluno.
                </p>
              )}
            </div>
          )}
          {tab === "pedagogy" && (
            <div className="dossier-timeline">
              {records.map((p) => (
                <article key={p.id}>
                  <time>
                    {displayDate(p.date)} / {p.kind}
                  </time>
                  <h3>
                    {p.skill} <small>Nível {p.level}/5</small>
                  </h3>
                  <p>{p.notes}</p>
                  {p.parent_record_id && (
                    <small>Evolução vinculada ao registro anterior</small>
                  )}
                  {p.support_plan?.goal && (
                    <p>
                      <strong>Objetivo:</strong> {p.support_plan.goal}
                    </p>
                  )}
                  {p.support_plan?.criteria && (
                    <p>
                      <strong>Critério:</strong> {p.support_plan.criteria}
                    </p>
                  )}
                  {p.support_plan?.outcome && (
                    <p>
                      <strong>Resultado:</strong>{" "}
                      {outcomeLabels[p.support_plan.outcome] ||
                        p.support_plan.outcome}
                    </p>
                  )}
                  {p.support_plan?.evidence && (
                    <p>
                      <strong>Evidência:</strong> {p.support_plan.evidence}
                    </p>
                  )}

                  {p.intervention && (
                    <div className="dossier-note">
                      <strong>Intervenção</strong>
                      <p>{p.intervention}</p>
                      {p.follow_up && (
                        <small>Revisão: {displayDate(p.follow_up)}</small>
                      )}
                    </div>
                  )}
                </article>
              ))}
              {!records.length && (
                <p className="dossier-empty">
                  Nenhum registro pedagógico individual.
                </p>
              )}
            </div>
          )}
          {tab === "contacts" && (
            <div className="dossier-timeline">
              {contacts.map((c) => (
                <article key={c.id}>
                  <time>{displayDate(c.date)}</time>
                  <h3>{c.reason}</h3>
                  <p>{c.outcome}</p>
                  {c.next_contact && (
                    <div className="dossier-note">
                      Retorno combinado: {displayDate(c.next_contact)}
                    </div>
                  )}
                </article>
              ))}
              {!contacts.length && (
                <p className="dossier-empty">Nenhum contato registrado.</p>
              )}
            </div>
          )}
        </div>
        <footer>
          <button className="secondary" onClick={onEdit}>
            <Pencil size={15} /> Editar matrícula
          </button>
          <button className="secondary" onClick={onPdf}>
            <Download size={15} /> PDF
          </button>
          <button className="primary" onClick={onMessage}>
            <MessageCircle size={16} /> Evolução ao responsável
          </button>
        </footer>
      </section>
    </div>
  );
}
