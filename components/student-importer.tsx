"use client";
import { isManager } from "@/lib/accounts";
import { useState } from "react";
import {
  Upload,
  Download,
  CheckCircle2,
  FileSpreadsheet,
  X,
  AlertTriangle,
} from "lucide-react";
import { type Store, type Profile, type Student } from "@/lib/domain";
import {
  previewStudents,
  importedStudent,
  type ImportCell,
  type ImportRow,
} from "@/lib/student-import";
export function StudentImporter({
  store,
  profile,
  initialUnit,
  onClose,
  onImport,
}: {
  store: Store;
  profile: Profile;
  initialUnit: string;
  onClose: () => void;
  onImport: (students: Student[]) => Promise<boolean>;
}) {
  const units = store.units.filter(
    (u) => isManager(profile.role) || u.id === profile.unit_id,
  );
  const [unit, setUnit] = useState(initialUnit === "all" ? "" : initialUnit),
    [raw, setRaw] = useState<ImportCell[][]>([]),
    [rows, setRows] = useState<ImportRow[]>([]),
    [filename, setFilename] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  function review(data: ImportCell[][], unitId: string) {
    try {
      const next = previewStudents(
        data,
        store.classes,
        store.students,
        profile,
        unitId,
      );
      setRows(next);
      setError("");
    } catch (e) {
      setRows([]);
      setError((e as Error).message);
    }
  }
  async function fileChange(file?: File) {
    if (!file) return;
    setError("");
    setRows([]);
    setRaw([]);
    setFilename("");
    if (!unit) {
      setError("Selecione a unidade antes de abrir o arquivo.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("O limite do arquivo é 5 MB.");
      return;
    }
    if (!/\.xlsx$/i.test(file.name)) {
      setError("Salve sua planilha no formato Excel .xlsx.");
      return;
    }
    setBusy(true);
    try {
      const { readSheet } = await import("read-excel-file/browser");
      const sheet = await readSheet(file);
      const data: ImportCell[][] = sheet.map((row) =>
        row.map((value) =>
          value instanceof Date ||
          typeof value === "string" ||
          typeof value === "number" ||
          typeof value === "boolean"
            ? value
            : null,
        ),
      );
      setRaw(data);
      setFilename(file.name);
      review(data, unit);
    } catch {
      setError(
        "Não foi possível abrir a planilha. Confira se é um arquivo .xlsx válido.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function template() {
    const { default: writeXlsxFile } = await import("write-excel-file/browser");
    const group = store.classes.find((c) => c.unit_id === unit);
    await writeXlsxFile(
      [
        [
          { value: "Nome", fontWeight: "bold" },
          { value: "Turma", fontWeight: "bold" },
          { value: "Data de nascimento", fontWeight: "bold" },
        ],
        [
          null,
          { value: group?.name || "Nome exato da turma cadastrada" },
          null,
        ],
      ],
      {
        columns: [{ width: 35 }, { width: 38 }, { width: 23 }],
      },
    ).toFile("modelo-alunos-wisdom.xlsx");
  }
  const ready = rows.filter((r) => r.status === "ready"),
    duplicates = rows.filter((r) => r.status === "duplicate").length,
    invalid = rows.filter((r) => r.status === "error").length;
  return (
    <div className="modal-overlay">
      <section
        className="modal import-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="import-title"
      >
        <div className="modal-header">
          <div>
            <span className="eyebrow">SECRETARIA / MATRÍCULAS</span>
            <h2 id="import-title">Importar alunos do Excel</h2>
          </div>
          <button
            className="icon-button"
            type="button"
            aria-label="Fechar importação"
            disabled={busy}
            onClick={onClose}
          >
            <X size={21} />
          </button>
        </div>
        <div className="modal-form">
          <p>
            Comece com <strong>Nome</strong> e <strong>Turma</strong>.
            Nascimento é opcional. Os demais dados podem ser completados depois.
            Até 500 alunos por arquivo.
          </p>
          <div className="import-controls">
            <label>
              Unidade da importação
              <select
                aria-label="Unidade da importação"
                value={unit}
                disabled={busy || !isManager(profile.role)}
                onChange={(e) => {
                  setUnit(e.target.value);
                  setRows([]);
                  if (raw.length) review(raw, e.target.value);
                }}
              >
                <option value="" disabled>
                  Selecione a unidade
                </option>
                {units.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="secondary"
              disabled={!unit || busy}
              onClick={() => void template()}
            >
              <Download size={16} /> Baixar modelo Excel
            </button>
          </div>
          <label className={`import-dropzone ${!unit ? "disabled" : ""}`}>
            <FileSpreadsheet size={30} />
            <strong>
              {busy ? "Processando…" : filename || "Escolha sua planilha"}
            </strong>
            <span>Excel .xlsx • primeira aba • até 5 MB</span>
            <input
              aria-label="Arquivo Excel de alunos"
              type="file"
              accept=".xlsx"
              disabled={!unit || busy}
              onChange={(e) => void fileChange(e.target.files?.[0])}
            />
          </label>
          {error && (
            <div className="error" role="alert">
              {error}
            </div>
          )}
          {rows.length > 0 && (
            <>
              <div className="import-summary">
                <span>
                  <CheckCircle2 size={16} />
                  <b>{ready.length}</b> prontos
                </span>
                <span>
                  <b>{duplicates}</b> duplicados
                </span>
                <span>
                  <AlertTriangle size={15} />
                  <b>{invalid}</b> com erro
                </span>
              </div>
              <p className="import-note">
                Somente as linhas marcadas como prontas serão salvas. Duplicados
                e erros serão ignorados. As turmas precisam existir nesta
                unidade; use o nome completo ou o ID da turma.
              </p>
              <div className="table-scroll import-preview">
                <table>
                  <thead>
                    <tr>
                      <th>LINHA</th>
                      <th>ALUNO / TURMA</th>
                      <th>REVISÃO</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.row}>
                        <td>{row.row}</td>
                        <td>
                          <strong>{row.name || "Sem nome"}</strong>
                          <small>{row.className || "Sem turma"}</small>
                        </td>
                        <td>
                          <span
                            className={`badge ${row.status === "ready" ? "green" : row.status === "duplicate" ? "neutral" : "orange"}`}
                          >
                            {row.status === "ready"
                              ? "Pronto"
                              : row.status === "duplicate"
                                ? "Duplicado"
                                : "Revisar"}
                          </span>
                          <small>{row.detail}</small>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
          <div className="modal-footer">
            <button
              className="secondary"
              type="button"
              disabled={busy}
              onClick={onClose}
            >
              Cancelar
            </button>
            <button
              className="primary"
              type="button"
              disabled={busy || !ready.length}
              onClick={async () => {
                setBusy(true);
                setError("");
                try {
                  if (
                    await onImport(
                      ready.map((r) => importedStudent(r, profile)),
                    )
                  )
                    onClose();
                  else
                    setError(
                      "A importação não foi confirmada. Atualize a lista de alunos antes de tentar novamente e confira as vagas. Se persistir, solicite suporte da coordenação.",
                    );
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <Upload size={16} />
              {busy ? "Importando…" : `Importar ${ready.length} alunos`}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
