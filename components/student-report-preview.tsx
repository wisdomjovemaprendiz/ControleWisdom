"use client";
import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import { CompactDialog } from "./compact-dialog";
import {
  studentReport,
  type StudentReportAudience,
} from "@/lib/student-report";
import type { Store, Student } from "@/lib/domain";
import {
  availableStudentReportBlocks,
  selectStudentReportBlocks,
  type StudentReportBlock,
} from "@/lib/student-report-selection";
import { photoForReport } from "@/lib/photos";

export function StudentReportPreview({
  store,
  student,
  initialAudience,
  author,
  onClose,
}: {
  store: Store;
  student: Student;
  initialAudience: StudentReportAudience;
  author: string;
  onClose: () => void;
}) {
  const [audience, setAudience] = useState(initialAudience),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const report = useMemo(
    () => studentReport(store, student, audience),
    [store, student, audience],
  );
  const [excluded, setExcluded] = useState<
    Record<StudentReportAudience, StudentReportBlock[]>
  >({ internal: [], family: [] });
  const blocks = availableStudentReportBlocks(report);
  const selected = blocks
    .filter(([id]) => !excluded[audience].includes(id))
    .map(([id]) => id);
  const selectedReport = selectStudentReportBlocks(report, selected);
  function setExcludedBlocks(ids: StudentReportBlock[]) {
    setExcluded((previous) => ({ ...previous, [audience]: ids }));
  }
  return (
    <CompactDialog
      title="Emitir ficha do aluno"
      onClose={onClose}
      className="student-report-dialog"
    >
      <div
        className="student-report-audiences"
        role="group"
        aria-label="Versão da ficha"
      >
        <button
          type="button"
          className={audience === "internal" ? "primary" : "secondary"}
          disabled={busy}
          aria-pressed={audience === "internal"}
          onClick={() => setAudience("internal")}
        >
          Uso interno
        </button>
        <button
          type="button"
          className={audience === "family" ? "primary" : "secondary"}
          disabled={busy}
          aria-pressed={audience === "family"}
          onClick={() => setAudience("family")}
        >
          Para a família
        </button>
      </div>
      <h3>{report.name}</h3>
      <p className="student-report-caption">
        {audience === "internal"
          ? "Histórico acadêmico, acompanhamento e pendências da equipe."
          : "Confira as observações pedagógicas antes de compartilhar com a família."}
      </p>
      <fieldset className="student-report-blocks" disabled={busy}>
        <legend>Blocos do PDF</legend>
        <div className="student-report-block-actions">
          <button
            type="button"
            className="text-link"
            onClick={() => setExcludedBlocks([])}
          >
            Marcar todos
          </button>
          <button
            type="button"
            className="text-link"
            onClick={() => setExcludedBlocks(blocks.map(([id]) => id))}
          >
            Desmarcar todos
          </button>
          <span aria-live="polite">
            {selected.length} de {blocks.length} blocos selecionados
          </span>
        </div>
        <div className="student-report-block-grid">
          {blocks.map(([id, label]) => (
            <label key={id}>
              <input
                type="checkbox"
                checked={selected.includes(id)}
                onChange={(event) =>
                  setExcludedBlocks(
                    event.target.checked
                      ? excluded[audience].filter((block) => block !== id)
                      : [...excluded[audience], id],
                  )
                }
              />
              {label}
            </label>
          ))}
        </div>
        <small>
          Nome do aluno, unidade e identificação da emissão permanecem no
          cabeçalho.
        </small>
      </fieldset>
      {!selected.length && (
        <p className="student-report-caption" role="status">
          Selecione pelo menos um bloco para gerar o PDF.
        </p>
      )}
      {!!selectedReport.metrics.length && (
        <div className="student-report-metrics">
          {selectedReport.metrics.map((metric) => (
            <div key={metric.label}>
              <span>{metric.label}</span>
              <strong>{metric.value}</strong>
            </div>
          ))}
        </div>
      )}
      <div className="student-report-sections">
        {selectedReport.sections.map((section, index) => (
          <details key={index} open={index < 2}>
            <summary>{section.title}</summary>
            <div className="student-report-table">
              <table>
                <thead>
                  <tr>
                    {section.headers.map((header) => (
                      <th key={header}>{header}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {section.rows.map((row, i) => (
                    <tr key={i}>
                      {row.map((cell, j) => (
                        <td key={j}>{cell}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        ))}
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <footer>
        <button type="button" className="secondary" onClick={onClose}>
          Voltar à ficha
        </button>
        <button
          type="button"
          className="primary"
          disabled={busy || !selected.length}
          onClick={async () => {
            setBusy(true);
            setError("");
            try {
              const { createStudentReportPdf } =
                await import("@/lib/student-report-pdf");
              const photo = await photoForReport(student).catch(() => null);
              const doc = await createStudentReportPdf(
                selectedReport,
                author,
                photo,
              );
              doc.save(report.filename);
            } catch (error) {
              setError((error as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <Download size={16} />
          {busy
            ? "Gerando PDF…"
            : audience === "internal"
              ? "Baixar ficha interna PDF"
              : "Baixar ficha para família PDF"}
        </button>
      </footer>
    </CompactDialog>
  );
}
