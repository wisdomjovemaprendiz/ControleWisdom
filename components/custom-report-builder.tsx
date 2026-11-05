"use client";
import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import type { Store, Profile } from "@/lib/domain";
import { labels, today, displayDate } from "@/lib/domain";
import { availableReportFields, buildCustomReport } from "@/lib/custom-reports";
export function CustomReportBuilder({
  store,
  profile,
  unit,
  classId,
  from,
  to,
}: {
  store: Store;
  profile: Profile;
  unit: string;
  classId: string;
  from: string;
  to: string;
}) {
  const [selected, setSelected] = useState([
      "name",
      "phone",
      "guardian",
      "guardian_phone",
      "class",
    ]),
    [status, setStatus] = useState("ativo"),
    [includeArchived, setIncludeArchived] = useState(false),
    [filterEnrollmentDate, setFilterEnrollmentDate] = useState(false),
    [format, setFormat] = useState<"pdf" | "xls" | "xlsx">("xlsx"),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const fields = availableReportFields(profile),
    groups = [...new Set(fields.map((f) => f.group))];
  const result = useMemo(
    () =>
      selected.length
        ? buildCustomReport(store, profile, selected, {
            unit,
            classId,
            from,
            to,
            status,
            includeArchived,
            filterEnrollmentDate,
          })
        : { headers: [], rows: [], count: 0 },
    [
      store,
      profile,
      selected,
      unit,
      classId,
      from,
      to,
      status,
      includeArchived,
      filterEnrollmentDate,
    ],
  );
  async function download() {
    setError("");
    setBusy(true);
    try {
      if (!result.headers.length)
        throw new Error("Marque ao menos uma informação.");
      if (!result.count)
        throw new Error("Nenhum aluno corresponde aos filtros.");
      if (format === "pdf") {
        const { createInstitutionalPdf } = await import("@/lib/pdf");
        const doc = await createInstitutionalPdf({
          title: "Relatório personalizado",
          unit:
            unit === "all"
              ? "Todas as unidades"
              : store.units.find((u) => u.id === unit)?.name || "Unidade",
          author: profile.name,
          lines: [
            `${result.count} aluno(s) · ${result.headers.length} coluna(s) selecionada(s)`,
            `Período da frequência: ${from ? displayDate(from) : "início"} a ${to ? displayDate(to) : displayDate(today())}`,
          ],
          table: {
            headers: result.headers,
            rows: result.rows.map((row) => row.map(String)),
          },
        });
        doc.save(`wisdom-relatorio-personalizado-${today()}.pdf`);
      } else {
        const { createReportExcel } = await import("@/lib/report-excel");
        const bytes = await createReportExcel(
          result.headers,
          result.rows,
          format,
        );
        const blob = new Blob([bytes.buffer as ArrayBuffer], {
          type:
            format === "xls"
              ? "application/vnd.ms-excel"
              : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        });
        const url = URL.createObjectURL(blob),
          link = document.createElement("a");
        link.href = url;
        link.download = `wisdom-relatorio-personalizado-${today()}.${format}`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Não foi possível gerar o relatório.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section
      className="panel custom-report"
      aria-label="Relatório personalizado"
    >
      <div className="panel-header">
        <div>
          <h2>Relatório personalizado</h2>
          <p>
            Escolha as colunas. A prévia e o arquivo usam os mesmos filtros.
          </p>
        </div>
        <div className="custom-report-selection">
          <button
            type="button"
            className="text-link"
            onClick={() => setSelected(fields.map((f) => f.id))}
          >
            Marcar todas
          </button>
          <button
            type="button"
            className="text-link"
            onClick={() => setSelected([])}
          >
            Limpar seleção
          </button>
        </div>
      </div>
      <div className="custom-report-content">
        <div className="custom-report-filters">
          <label>
            Situação dos alunos
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="all">Todas as situações</option>
              {[
                "ativo",
                "conclusao",
                "inadimplencia",
                "abandono",
                "cancelamento",
              ].map((s) => (
                <option key={s} value={s}>
                  {labels[s]}
                </option>
              ))}
            </select>
          </label>
          <label className="report-check">
            <input
              type="checkbox"
              checked={includeArchived}
              onChange={(e) => setIncludeArchived(e.target.checked)}
            />
            Incluir registros arquivados
          </label>
          <label className="report-check">
            <input
              type="checkbox"
              checked={filterEnrollmentDate}
              onChange={(e) => setFilterEnrollmentDate(e.target.checked)}
            />
            Filtrar também pela data de matrícula
          </label>
        </div>
        <div className="custom-report-actions">
          <div>
            <strong>
              {result.count} alunos · {result.headers.length} colunas
            </strong>
            <small>A frequência considera as aulas no período acima.</small>
          </div>
          <label>
            Formato do arquivo
            <select
              aria-label="Formato do arquivo"
              value={format}
              onChange={(e) => setFormat(e.target.value as typeof format)}
            >
              <option value="xlsx">Excel (.xlsx)</option>
              <option value="xls">Excel 97–2003 (.xls)</option>
              <option value="pdf">PDF</option>
            </select>
          </label>
          <button
            type="button"
            className="primary"
            disabled={busy || !result.count || !result.headers.length}
            onClick={() => void download()}
          >
            <Download size={17} />
            {busy ? "Gerando…" : "Baixar relatório"}
          </button>
        </div>
        <div className="custom-field-groups">
          {groups.map((group) => (
            <fieldset key={group}>
              <legend>{group}</legend>
              {fields
                .filter((f) => f.group === group)
                .map((f) => (
                  <label key={f.id} className="report-check">
                    <input
                      type="checkbox"
                      checked={selected.includes(f.id)}
                      onChange={(e) =>
                        setSelected((ids) =>
                          e.target.checked
                            ? [...ids, f.id]
                            : ids.filter((id) => id !== f.id),
                        )
                      }
                    />
                    {f.label}
                  </label>
                ))}
            </fieldset>
          ))}
        </div>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        {!selected.length ? (
          <p className="empty">Marque as informações que deseja exibir.</p>
        ) : (
          <div className="custom-report-preview table-scroll">
            <table>
              <caption>
                Prévia · primeiros {Math.min(10, result.count)} de{" "}
                {result.count} alunos
              </caption>
              <thead>
                <tr>
                  {result.headers.map((header) => (
                    <th key={header}>{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.rows.slice(0, 10).map((row, index) => (
                  <tr key={index}>
                    {row.map((value, column) => (
                      <td key={column}>{value === "" ? "—" : value}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {!result.count && (
              <p className="empty">Nenhum aluno corresponde aos filtros.</p>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
