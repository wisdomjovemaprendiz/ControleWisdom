"use client";
import { isManager } from "@/lib/accounts";
import { useMemo, useState } from "react";
import {
  Upload,
  Download,
  CheckCircle2,
  FileSpreadsheet,
  X,
  AlertTriangle,
  Plus,
  ClipboardPaste,
} from "lucide-react";
import {
  type Store,
  type Profile,
  type Student,
  type CourseClass,
  displayDate,
} from "@/lib/domain";
import {
  previewStudents,
  importedStudent,
  detectImportColumns,
  parsePastedStudents,
  importFields,
  type ImportField,
  type ImportCell,
  type ImportRow,
} from "@/lib/student-import";
import { ImportClassForm } from "./import-class-form";
export function StudentImporter({
  store,
  profile,
  initialUnit,
  onClose,
  onImport,
  onCreateClass,
}: {
  store: Store;
  profile: Profile;
  initialUnit: string;
  onClose: () => void;
  onImport: (students: Student[]) => Promise<boolean>;
  onCreateClass: (course: CourseClass) => Promise<boolean>;
}) {
  const units = store.units.filter(
    (u) => isManager(profile.role) || u.id === profile.unit_id,
  );
  const [unit, setUnit] = useState(initialUnit === "all" ? "" : initialUnit),
    [classId, setClassId] = useState(""),
    [source, setSource] = useState<"excel" | "paste">("excel"),
    [raw, setRaw] = useState<ImportCell[][]>([]),
    [fileRows, setFileRows] = useState<ImportCell[][]>([]),
    [pasted, setPasted] = useState(""),
    [columns, setColumns] = useState<ImportField[]>([]),
    [hasHeader, setHasHeader] = useState(false),
    [filename, setFilename] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [creating, setCreating] = useState(false);
  const classes = store.classes.filter(
    (c) =>
      c.unit_id === unit &&
      (profile.role !== "professor" || c.teacher_id === profile.id),
  );
  function configure(data: ImportCell[][]) {
    setRaw(data);
    setError("");
    try {
      const guessed = detectImportColumns(data, classes);
      setColumns(guessed.columns);
      setHasHeader(guessed.hasHeader);
    } catch (e) {
      setColumns([]);
      setError((e as Error).message);
    }
  }
  function paste(text: string) {
    setPasted(text);
    try {
      configure(parsePastedStudents(text));
    } catch (e) {
      setRaw([]);
      setColumns([]);
      setError((e as Error).message);
    }
  }
  const preview = useMemo(() => {
    if (!raw.length || !unit) return { rows: [] as ImportRow[], error: "" };
    try {
      return {
        rows: previewStudents(
          raw,
          store.classes,
          store.students,
          profile,
          unit,
          { classId, columns, hasHeader },
        ),
        error: "",
      };
    } catch (e) {
      return { rows: [] as ImportRow[], error: (e as Error).message };
    }
  }, [
    raw,
    unit,
    classId,
    columns,
    hasHeader,
    store.classes,
    store.students,
    profile,
  ]);
  const rows = preview.rows,
    ready = rows.filter((r) => r.status === "ready"),
    duplicates = rows.filter((r) => r.status === "duplicate").length,
    invalid = rows.filter((r) => r.status === "error").length;
  async function fileChange(file?: File) {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setError("O limite do arquivo é 5 MB.");
      return;
    }
    if (!/\.xlsx$/i.test(file.name)) {
      setError("Salve sua planilha no formato Excel .xlsx.");
      return;
    }
    setBusy(true);
    setError("");
    setRaw([]);
    setFileRows([]);
    setFilename("");
    try {
      const { readSheet } = await import("read-excel-file/browser");
      const sheet = await readSheet(file);
      const data: ImportCell[][] = sheet.map((row) =>
        row.map((value) =>
          value instanceof Date ||
          ["string", "number", "boolean"].includes(typeof value)
            ? (value as ImportCell)
            : null,
        ),
      );
      setFileRows(data);
      setFilename(file.name);
      configure(data);
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
    await writeXlsxFile(
      [
        [
          { value: "Nome", fontWeight: "bold" },
          { value: "Turma", fontWeight: "bold" },
          { value: "Data de nascimento", fontWeight: "bold" },
        ],
        [
          null,
          {
            value:
              classes.find((c) => c.id === classId)?.name ||
              classes[0]?.name ||
              "Nome exato da turma cadastrada",
          },
          null,
        ],
      ],
      { columns: [{ width: 35 }, { width: 38 }, { width: 23 }] },
    ).toFile("modelo-alunos-wisdom.xlsx");
  }
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
            <h2 id="import-title">Importar alunos em massa</h2>
          </div>
          <button
            className="icon-button"
            type="button"
            aria-label="Fechar importação"
            disabled={busy || creating}
            onClick={onClose}
          >
            <X size={21} />
          </button>
        </div>
        <div className="modal-form">
          <div className="import-destination">
            <label>
              Unidade da importação
              <select
                aria-label="Unidade da importação"
                value={unit}
                disabled={busy || creating || !isManager(profile.role)}
                onChange={(e) => {
                  setUnit(e.target.value);
                  setClassId("");
                  setError("");
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
            <label>
              Turma de destino
              <select
                aria-label="Turma de destino"
                value={classId}
                disabled={!unit || busy || creating}
                onChange={(e) => {
                  setClassId(e.target.value);
                  setError("");
                }}
              >
                <option value="">Usar a coluna Turma da lista</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            {profile.role !== "professor" && (
              <button
                type="button"
                className="secondary"
                disabled={!unit || busy || creating}
                onClick={() => setCreating(true)}
              >
                <Plus size={16} />
                Criar turma
              </button>
            )}
          </div>
          {creating && (
            <ImportClassForm
              store={store}
              unit={unit}
              onCancel={() => setCreating(false)}
              onSave={async (course) => {
                const saved = await onCreateClass(course);
                if (saved) {
                  setClassId(course.id);
                  setCreating(false);
                  setError("");
                }
                return saved;
              }}
            />
          )}
          <div
            className="import-source"
            role="group"
            aria-label="Origem dos alunos"
          >
            {(["excel", "paste"] as const).map((value) => (
              <button
                key={value}
                className={source === value ? "selected" : ""}
                type="button"
                disabled={busy || creating}
                aria-pressed={source === value}
                onClick={() => {
                  setSource(value);
                  if (value === "excel") configure(fileRows);
                  else paste(pasted);
                }}
              >
                {value === "excel" ? (
                  <FileSpreadsheet size={17} />
                ) : (
                  <ClipboardPaste size={17} />
                )}
                {value === "excel" ? "Planilha Excel" : "Copiar e colar"}
              </button>
            ))}
          </div>
          <p className="import-note">
            {classId
              ? "Todos os alunos serão cadastrados na turma selecionada. A coluna Turma pode ser omitida."
              : "Escolha a turma acima para colar somente os nomes, ou use uma coluna Turma para distribuir os alunos."}{" "}
            Até 500 alunos por lote.
          </p>
          {source === "excel" ? (
            <>
              <div className="import-inline-actions">
                <button
                  type="button"
                  className="secondary"
                  disabled={!unit || busy || creating}
                  onClick={() => void template()}
                >
                  <Download size={16} />
                  Baixar modelo Excel
                </button>
              </div>
              <label className={`import-dropzone ${!unit ? "disabled" : ""}`}>
                <FileSpreadsheet size={30} />
                <strong>
                  {busy ? "Processando…" : filename || "Escolha sua planilha"}
                </strong>
                <span>Excel .xlsx · primeira aba · até 5 MB</span>
                <input
                  aria-label="Arquivo Excel de alunos"
                  type="file"
                  accept=".xlsx"
                  disabled={!unit || busy || creating}
                  onChange={(e) => void fileChange(e.target.files?.[0])}
                />
              </label>
            </>
          ) : (
            <label className="import-paste-label">
              Cole a lista de alunos
              <textarea
                aria-label="Lista de alunos para colar"
                rows={7}
                maxLength={200000}
                value={pasted}
                disabled={busy || creating}
                placeholder={
                  "Ana Souza\nPedro Lima\n\nOu copie colunas de nome, nascimento e telefone do Excel."
                }
                onChange={(e) => paste(e.target.value)}
              />
              <small>
                Uma pessoa por linha. Aceita tabelas copiadas e listas com ou
                sem cabeçalho.
              </small>
            </label>
          )}
          {raw.length > 0 && columns.length > 0 && (
            <section
              className="import-mapping"
              aria-label="Identificação das colunas"
            >
              <header>
                <h3>Confira as colunas</h3>
                <label className="import-header-check">
                  <input
                    type="checkbox"
                    checked={hasHeader}
                    disabled={busy || creating}
                    onChange={(e) => setHasHeader(e.target.checked)}
                  />
                  A primeira linha é cabeçalho
                </label>
              </header>
              <div className="import-column-grid">
                {columns.map((field, index) => (
                  <label key={index}>
                    Coluna {index + 1}
                    <small
                      title={String(raw[hasHeader ? 1 : 0]?.[index] ?? "")}
                    >
                      {String(
                        raw[hasHeader ? 1 : 0]?.[index] ?? "Sem exemplo",
                      ).slice(0, 70)}
                    </small>
                    <select
                      aria-label={`Informação da coluna ${index + 1}`}
                      value={field}
                      disabled={busy || creating}
                      onChange={(e) =>
                        setColumns(
                          columns.map((previous, i) =>
                            i === index
                              ? (e.target.value as ImportField)
                              : previous,
                          ),
                        )
                      }
                    >
                      {Object.entries(importFields).map(([key, label]) => (
                        <option key={key} value={key}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
            </section>
          )}
          {(error || preview.error) && (
            <div className="error" role="alert">
              {error || preview.error}
            </div>
          )}
          {!!rows.length && (
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
                Somente os prontos serão salvos. Duplicados e erros serão
                ignorados. Cadastros incompletos continuam sinalizados para a
                secretaria.
              </p>
              <div className="table-scroll import-preview">
                <table>
                  <thead>
                    <tr>
                      <th>LINHA</th>
                      <th>ALUNO / TURMA</th>
                      <th>DADOS IDENTIFICADOS</th>
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
                          <small>
                            {row.birthDate
                              ? displayDate(row.birthDate)
                              : "Nascimento não informado"}
                          </small>
                          <small>{row.phone || "Telefone não informado"}</small>
                          {row.guardian && (
                            <small>Responsável: {row.guardian}</small>
                          )}
                          {row.guardianPhone && (
                            <small>{row.guardianPhone}</small>
                          )}
                          {row.email && <small>{row.email}</small>}
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
              disabled={busy || creating}
              onClick={onClose}
            >
              Cancelar
            </button>
            <button
              className="primary"
              type="button"
              disabled={
                busy || creating || !ready.length || !!error || !!preview.error
              }
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
                      "A importação não foi confirmada. Atualize a lista antes de tentar novamente e confira as vagas.",
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
