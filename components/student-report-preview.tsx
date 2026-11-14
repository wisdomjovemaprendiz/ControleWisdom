"use client";
import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import { CompactDialog } from "./compact-dialog";
import {
  studentReport,
  type StudentReportAudience,
} from "@/lib/student-report";
import type { Store, Student } from "@/lib/domain";
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
          aria-pressed={audience === "internal"}
          onClick={() => setAudience("internal")}
        >
          Uso interno
        </button>
        <button
          type="button"
          className={audience === "family" ? "primary" : "secondary"}
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
      <div className="student-report-metrics">
        {report.metrics.map((metric) => (
          <div key={metric.label}>
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
          </div>
        ))}
      </div>
      <div className="student-report-sections">
        {report.sections.map((section, index) => (
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
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setError("");
            try {
              const { createStudentReportPdf } =
                await import("@/lib/student-report-pdf");
              const photo = await photoForReport(student).catch(() => null);
              const doc = await createStudentReportPdf(report, author, photo);
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
