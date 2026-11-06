"use client";
import { useState, useEffect, type FormEvent } from "react";
import {
  Archive,
  ArchiveRestore,
  Pencil,
  Trash2,
  Search,
  X,
} from "lucide-react";
import {
  OffboardingChecklist,
  offboardingFromForm,
} from "./offboarding-checklist";
import { StudentPlacementFields } from "./student-placement-fields";
import { INDIVIDUAL } from "@/lib/individual";
import { supabase } from "@/lib/supabase";
import type { Store, Student } from "@/lib/domain";
import { labels, studentDisplayName } from "@/lib/domain";
import { StudentAvatar } from "./student-avatar";
import {
  recordTables,
  recordLabels,
  recordFields,
  type RecordTable,
  type ManagedRecord,
} from "@/lib/records";
export function RecordManager({
  store,
  onSaved,
  initialTable = "students",
}: {
  store: Store;
  onSaved: () => Promise<void>;
  initialTable?: RecordTable;
}) {
  const [table, setTable] = useState<RecordTable>(initialTable),
    [editStatus, setEditStatus] = useState(""),
    [query, setQuery] = useState(""),
    [state, setState] = useState("all"),
    [unit, setUnit] = useState("all"),
    [selection, setSelection] = useState<{
      row: ManagedRecord;
      action: string;
    } | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  useEffect(() => {
    setEditStatus(String(selection?.row.status || ""));
  }, [selection]);
  const rows = store[table] as unknown as ManagedRecord[];
  function title(row: ManagedRecord, t: RecordTable = table): string {
    if (t === "students") return studentDisplayName(row as unknown as Student);
    if (row.name) return String(row.name);
    const student = store.students.find((s) => s.id === row.student_id),
      lesson = store.lessons.find((l) => l.id === row.lesson_id),
      course = store.classes.find(
        (c) => c.id === (row.class_id || lesson?.class_id),
      );
    if (t === "attendance")
      return `${student ? studentDisplayName(student) : "Aluno"} · ${lesson?.date || ""}`;
    if (t === "contacts")
      return `${student ? studentDisplayName(student) : "Aluno"} · ${row.reason || "Contato"}`;
    return `${course?.name || student?.name || recordLabels[t]} · ${row.topic || row.skill || row.date || ""}`;
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selection || !supabase) return;
    setBusy(true);
    setError("");
    const data = new FormData(event.currentTarget),
      changes: Record<string, unknown> = {};
    if (selection.action === "edit")
      for (const field of recordFields[table]) {
        let value: unknown = String(data.get(field.key) || "");
        if (field.nullable && value === "") value = null;
        else if (field.type === "number") value = Number(value);
        if (field.key === "active") value = value === "true";
        if (["offering_id", "class_id"].includes(field.key) && value === "")
          value = null;
        if (field.key === "enrollment_date" && value === "") continue;
        changes[field.key] = value;
      }
    if (table === "students" && selection.action === "edit") {
      const placement = String(data.get("class_id") || "");
      changes.class_id = placement === INDIVIDUAL ? null : placement || null;
      changes.enrollment_mode =
        placement === INDIVIDUAL ? "individual" : "class";
      changes.individual_hours =
        placement === INDIVIDUAL
          ? Number(data.get("individual_hours")) || null
          : null;
      changes.individual_duration_minutes =
        placement === INDIVIDUAL
          ? Number(data.get("individual_duration_minutes")) || null
          : null;
      changes.individual_days =
        placement === INDIVIDUAL
          ? data.getAll("individual_days").map(Number)
          : [];
      changes.individual_teacher_id =
        placement === INDIVIDUAL
          ? data.get("individual_teacher_id") || null
          : null;
    }
    try {
      const session = await supabase.auth.getSession();
      if (!session.data.session)
        throw new Error("Sua sessão expirou. Entre novamente.");
      const response = await fetch("/api/records", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.data.session.access_token}`,
        },
        body: JSON.stringify({
          table,
          id: selection.row.id,
          action: selection.action,
          changes:
            table === "students"
              ? { ...changes, offboarding: offboardingFromForm(data) }
              : changes,
          reason: data.get("reason"),
          confirmation: data.get("confirmation"),
        }),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error || "Operação não concluída.");
      const action = selection.action;
      setSelection(null);
      await onSaved();
      setNotice(
        result.warning ||
          {
            edit: "Alterações salvas.",
            archive: "Registro arquivado. O histórico foi preservado.",
            restore:
              "Registro restaurado. Confira a situação cadastral antes de utilizá-lo.",
            delete: "Registro excluído definitivamente.",
          }[action] ||
          "Concluído.",
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const filtered = rows.filter(
    (r) =>
      (state === "all" || Boolean(r.archived_at) === (state === "archived")) &&
      (unit === "all" || (table === "units" ? r.id : r.unit_id) === unit) &&
      title(r)
        .toLocaleLowerCase("pt-BR")
        .includes(query.toLocaleLowerCase("pt-BR")),
  );
  const links = selection
    ? [
        ...store.students
          .filter(
            (s) =>
              s.class_id === selection.row.id ||
              s.offering_id === selection.row.id ||
              s.unit_id === selection.row.id ||
              s.created_by === selection.row.id,
          )
          .map((s) => "Matrícula: " + studentDisplayName(s)),
        ...store.classes
          .filter(
            (c) =>
              c.unit_id === selection.row.id ||
              c.teacher_id === selection.row.id,
          )
          .map((c) => "Turma: " + c.name),
        ...store.profiles
          .filter((p) => p.unit_id === selection.row.id)
          .map((p) => "Usuário: " + p.name),
        ...store.offerings
          .filter((o) => o.unit_id === selection.row.id)
          .map((o) => "Curso: " + o.name),
        ...store.lessons
          .filter(
            (l) =>
              l.class_id === selection.row.id ||
              l.teacher_id === selection.row.id ||
              l.unit_id === selection.row.id,
          )
          .map((l) => "Aula: " + l.date),
        ...store.attendance
          .filter(
            (a) =>
              a.student_id === selection.row.id ||
              a.lesson_id === selection.row.id ||
              a.unit_id === selection.row.id,
          )
          .map(() => "Presença registrada"),
        ...store.pedagogy
          .filter(
            (p) =>
              p.student_id === selection.row.id ||
              p.class_id === selection.row.id ||
              p.author_id === selection.row.id ||
              p.unit_id === selection.row.id,
          )
          .map(() => "Registro pedagógico"),
        ...store.contacts
          .filter(
            (c) =>
              c.student_id === selection.row.id ||
              c.author_id === selection.row.id ||
              c.unit_id === selection.row.id,
          )
          .map(() => "Contato registrado"),
      ]
    : [];
  return (
    <section className="panel record-manager">
      <div className="section-heading">
        <div>
          <span className="eyebrow">ADMINISTRAÇÃO DOS CADASTROS</span>
          <h2>Gestão de registros</h2>
          <p>
            Edite dados, preserve o histórico com arquivamento ou exclua
            cadastros sem vínculos.
          </p>
        </div>
      </div>
      <div className="record-filters">
        <label>
          Tipo de registro
          <select
            aria-label="Tipo de registro"
            value={table}
            onChange={(e) => {
              setTable(e.target.value as RecordTable);
              setQuery("");
              setNotice("");
              setError("");
            }}
          >
            {recordTables.map((t) => (
              <option key={t} value={t}>
                {recordLabels[t]}
              </option>
            ))}
          </select>
        </label>
        <label>
          Situação
          <select
            aria-label="Situação dos registros"
            value={state}
            onChange={(e) => setState(e.target.value)}
          >
            <option value="all">Todos</option>
            <option value="active">Não arquivados</option>
            <option value="archived">Arquivados</option>
          </select>
        </label>
        <label>
          Unidade
          <select value={unit} onChange={(e) => setUnit(e.target.value)}>
            <option value="all">Todas as unidades</option>
            {store.units.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
                {u.archived_at ? " (arquivada)" : ""}
              </option>
            ))}
          </select>
        </label>
        <label>
          Buscar
          <div className="record-search">
            <Search size={18} />
            <input
              aria-label="Buscar registros"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Nome ou conteúdo…"
            />
          </div>
        </label>
      </div>
      {notice && (
        <p role="status" className="record-notice">
          {notice}
        </p>
      )}
      <p className="record-count">
        {filtered.length} registro(s) · Arquivados permanecem disponíveis nesta
        área.
      </p>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Registro</th>
              <th>Unidade</th>
              <th>Situação</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((row) => (
              <tr key={row.id}>
                <td>
                  <div className="record-identity">
                    {table === "students" && (
                      <StudentAvatar student={row as unknown as Student} />
                    )}
                    <div>
                      <strong>{title(row)}</strong>
                      {table === "profiles" && (
                        <small>{String(row.username || "")}</small>
                      )}
                      {row.record_archive_reason && (
                        <small>{row.record_archive_reason}</small>
                      )}
                    </div>
                  </div>
                </td>
                <td>
                  {table === "units"
                    ? "—"
                    : store.units.find((u) => u.id === row.unit_id)?.name ||
                      "—"}
                </td>
                <td>
                  <span
                    className={`badge ${row.archived_at ? "amber" : "green"}`}
                  >
                    {row.archived_at
                      ? "Arquivado"
                      : table === "profiles"
                        ? row.active
                          ? "Ativo"
                          : "Desativado"
                        : labels[String(row.status)] || "Disponível"}
                  </span>
                </td>
                <td>
                  <div className="record-actions">
                    <button
                      className="secondary"
                      aria-label={`Editar ${title(row)}`}
                      onClick={() => {
                        setError("");
                        setSelection({ row, action: "edit" });
                      }}
                    >
                      <Pencil size={16} />
                      Editar
                    </button>
                    <button
                      className="secondary"
                      aria-label={`${row.archived_at ? "Restaurar" : "Arquivar"} ${title(row)}`}
                      onClick={() => {
                        setError("");
                        setSelection({
                          row,
                          action: row.archived_at ? "restore" : "archive",
                        });
                      }}
                    >
                      {row.archived_at ? (
                        <ArchiveRestore size={16} />
                      ) : (
                        <Archive size={16} />
                      )}{" "}
                      {row.archived_at ? "Restaurar" : "Arquivar"}
                    </button>
                    <button
                      className="secondary danger-action"
                      aria-label={`Excluir ${title(row)}`}
                      onClick={() => {
                        setError("");
                        setSelection({ row, action: "delete" });
                      }}
                    >
                      <Trash2 size={16} />
                      Excluir
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!filtered.length && (
          <div className="empty">Nenhum registro encontrado.</div>
        )}
      </div>
      {selection && (
        <div className="modal-overlay">
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="record-title"
          >
            <div className="modal-header">
              <div>
                <span className="eyebrow">{recordLabels[table]}</span>
                <h2 id="record-title">
                  {
                    {
                      edit: "Editar registro",
                      archive: "Arquivar registro",
                      restore: "Restaurar registro",
                      delete: "Excluir definitivamente",
                    }[selection.action]
                  }
                </h2>
                <p>{title(selection.row)}</p>
              </div>
              <button
                type="button"
                className="icon-button"
                aria-label="Fechar gestão do registro"
                disabled={busy}
                onClick={() => setSelection(null)}
              >
                <X />
              </button>
            </div>
            <form className="modal-form" onSubmit={submit}>
              {error && (
                <div className="error" role="alert">
                  {error}
                </div>
              )}
              {selection.action === "edit" && table === "students" && (
                <StudentPlacementFields
                  student={selection.row as unknown as Student}
                  classes={store.classes.filter(
                    (c) =>
                      !c.archived_at && c.unit_id === selection.row.unit_id,
                  )}
                  teachers={store.profiles}
                />
              )}
              {selection.action === "edit" &&
                recordFields[table]
                  .filter(
                    (field) => table !== "students" || field.key !== "class_id",
                  )
                  .map((field) => (
                    <label key={field.key}>
                      {field.label}
                      {field.type === "textarea" ? (
                        <textarea
                          name={field.key}
                          onChange={
                            field.key === "status"
                              ? (e) => setEditStatus(e.target.value)
                              : undefined
                          }
                          defaultValue={String(selection.row[field.key] ?? "")}
                          required={field.required}
                        />
                      ) : field.options || field.relation ? (
                        <select
                          name={field.key}
                          onChange={
                            field.key === "status"
                              ? (e) => setEditStatus(e.target.value)
                              : undefined
                          }
                          defaultValue={String(selection.row[field.key] ?? "")}
                          required={field.required}
                        >
                          {!field.required && field.relation && (
                            <option value="">Não informado</option>
                          )}
                          {field.options?.map((o) => (
                            <option key={o} value={o}>
                              {o === "true"
                                ? "Sim"
                                : o === "false"
                                  ? "Não"
                                  : labels[o] || o}
                            </option>
                          ))}
                          {field.relation &&
                            (
                              store[
                                field.relation
                              ] as unknown as ManagedRecord[]
                            )
                              .filter(
                                (r) =>
                                  (r.id === selection.row[field.key] ||
                                    (!r.archived_at &&
                                      (!r.unit_id ||
                                        r.unit_id ===
                                          selection.row.unit_id))) &&
                                  (field.key !== "teacher_id" ||
                                    ([
                                      "admin",
                                      "coordenacao",
                                      "professor",
                                    ].includes(String(r.role)) &&
                                      r.active !== false)),
                              )
                              .map((r) => (
                                <option key={r.id} value={r.id}>
                                  {title(r, field.relation)}
                                </option>
                              ))}
                        </select>
                      ) : (
                        <input
                          name={field.key}
                          onChange={
                            field.key === "status"
                              ? (e) => setEditStatus(e.target.value)
                              : undefined
                          }
                          type={field.type || "text"}
                          defaultValue={String(selection.row[field.key] ?? "")}
                          required={field.required}
                          min={
                            field.min ??
                            (field.type === "number" ? 1 : undefined)
                          }
                          max={
                            field.max ?? (field.key === "level" ? 5 : undefined)
                          }
                          step={field.step}
                        />
                      )}
                    </label>
                  ))}
              {table === "students" &&
                (selection.action === "archive" ||
                  (selection.action === "edit" &&
                    selection.row.status === "ativo" &&
                    editStatus &&
                    editStatus !== "ativo")) && (
                  <OffboardingChecklist key={selection.row.id} />
                )}
              {selection.action === "archive" && (
                <>
                  <p>
                    O registro sai da operação e permanece disponível para
                    restauração. Ao arquivar unidade ou turma, seus registros
                    também deixam de aparecer na operação, sem serem apagados.
                  </p>
                  <label>
                    Motivo do arquivamento
                    <textarea name="reason" required minLength={3} />
                  </label>
                </>
              )}
              {selection.action === "restore" && (
                <p>
                  O registro voltará a ficar disponível. Alunos mantêm a
                  situação da matrícula; revise e reative quando houver vaga.
                  Registros dependentes arquivados devem ser restaurados
                  separadamente.
                </p>
              )}
              {selection.action === "delete" && (
                <>
                  <div className="record-delete-warning">
                    <strong>Esta ação é permanente.</strong>
                    <p>
                      {links.length
                        ? `Há ${links.length} vínculo(s) encontrado(s). Transfira ou exclua os vínculos antes de excluir este registro. Você também pode arquivá-lo.`
                        : "O banco verificará novamente os vínculos antes de excluir. Não há recuperação pela interface."}
                    </p>
                    {links.length > 0 && (
                      <ul>
                        {links.slice(0, 6).map((l, i) => (
                          <li key={i}>{l}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <label>
                    Digite EXCLUIR para confirmar
                    <input
                      name="confirmation"
                      autoComplete="off"
                      required
                      pattern="EXCLUIR"
                    />
                  </label>
                </>
              )}
              <div className="modal-footer">
                <button
                  className="secondary"
                  type="button"
                  disabled={busy}
                  onClick={() => setSelection(null)}
                >
                  Cancelar
                </button>
                <button
                  className={`primary ${selection.action === "delete" ? "danger-button" : ""}`}
                  disabled={busy}
                >
                  {busy
                    ? "Salvando…"
                    : {
                        edit: "Salvar alterações",
                        archive: "Confirmar arquivamento",
                        restore: "Confirmar restauração",
                        delete: "Excluir definitivamente",
                      }[selection.action]}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </section>
  );
}
