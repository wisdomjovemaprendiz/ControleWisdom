"use client";
import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/lib/supabase";
import type { OffboardingStep } from "./offboarding-checklist";
import {
  auditChanges,
  auditValue,
  auditFieldLabels,
  type AuditEntry,
} from "@/lib/audit";
import { recordLabels } from "@/lib/records";
export function LifecycleSettings({
  store,
}: {
  store: import("@/lib/domain").Store;
}) {
  const [steps, setSteps] = useState<OffboardingStep[]>([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [audit, setAudit] = useState<AuditEntry[]>([]),
    [page, setPage] = useState(0),
    [entity, setEntity] = useState("students"),
    [loading, setLoading] = useState(false),
    [studentId, setStudentId] = useState("");
  async function loadSteps() {
    const r = await supabase!
      .from("offboarding_steps")
      .select("*")
      .order("position")
      .order("id");
    if (r.error) setError(r.error.message);
    else setSteps(r.data);
  }
  useEffect(() => {
    void loadSteps();
  }, []);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    void (async () => {
      let query = supabase!
        .from("audit_log")
        .select(
          "id,actor_name,actor_id,entity,entity_id,operation,occurred_at,before_data,after_data",
        )
        .eq("entity", entity)
        .order("id", { ascending: false })
        .range(page * 25, page * 25 + 24);
      if (entity === "students" && studentId)
        query = query.eq("entity_id", studentId);
      const r = await query;
      if (active) {
        if (r.error) setError("Não foi possível carregar a auditoria.");
        else setAudit(r.data);
        setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [page, entity, studentId]);
  async function add(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const label = String(new FormData(form).get("label") || "").trim();
    setBusy(true);
    const r = await supabase!.from("offboarding_steps").insert({
      label,
      position: Math.max(-1, ...steps.map((s) => s.position)) + 1,
    });
    if (r.error) setError(r.error.message);
    else {
      form.reset();
      await loadSteps();
    }
    setBusy(false);
  }
  async function update(
    step: OffboardingStep,
    changes: Partial<OffboardingStep>,
  ) {
    setBusy(true);
    setError("");
    const r = await supabase!
      .from("offboarding_steps")
      .update(changes)
      .eq("id", step.id);
    if (r.error) setError(r.error.message);
    await loadSteps();
    setBusy(false);
  }
  return (
    <div className="lifecycle-settings">
      <section className="panel">
        <div className="panel-header">
          <h2>Checklist de desligamento</h2>
        </div>
        <div className="lifecycle-content">
          <p>
            Alterações valem para os próximos desligamentos. O histórico mantém
            as etapas concluídas na época.
          </p>
          {steps.map((s) => (
            <form
              className="checklist-setting-row"
              key={`${s.id}-${s.label}`}
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                void update(s, {
                  label: String(fd.get("label")),
                  position: Number(fd.get("position")),
                });
              }}
            >
              <label>
                Etapa
                <textarea
                  rows={2}
                  name="label"
                  aria-label={`Etapa ${s.position + 1}`}
                  required
                  minLength={3}
                  maxLength={180}
                  defaultValue={s.label}
                />
              </label>
              <label>
                Ordem
                <input
                  name="position"
                  type="number"
                  min="0"
                  defaultValue={s.position}
                />
              </label>
              <button className="secondary" disabled={busy}>
                Salvar etapa
              </button>
              <button
                type="button"
                className="text-link"
                disabled={busy}
                onClick={() => void update(s, { active: !s.active })}
              >
                {s.active ? "Desativar" : "Reativar"}
              </button>
            </form>
          ))}
          <form onSubmit={add} className="checklist-add">
            <label>
              Nova etapa
              <input name="label" required minLength={3} maxLength={180} />
            </label>
            <button className="primary" disabled={busy}>
              Adicionar etapa
            </button>
          </form>
        </div>
      </section>
      <section className="panel">
        <div className="panel-header">
          <h2>Auditoria de alterações</h2>
          <label>
            Tipo de registro
            <select
              value={entity}
              onChange={(e) => {
                setEntity(e.target.value);
                setPage(0);
              }}
            >
              {Object.entries({
                ...recordLabels,
                offboarding_steps: "Checklist de desligamento",
              }).map(([key, value]) => (
                <option key={key} value={key}>
                  {value}
                </option>
              ))}
            </select>
          </label>
        </div>
        {entity === "students" && (
          <div className="lifecycle-content">
            <label>
              Filtrar histórico do aluno
              <select
                value={studentId}
                onChange={(e) => {
                  setStudentId(e.target.value);
                  setPage(0);
                }}
              >
                <option value="">Todos os alunos</option>
                {store.students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name || `Cadastro ${s.id.slice(0, 6)}`}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <div className="lifecycle-content">
          {loading ? (
            <p role="status">Carregando histórico…</p>
          ) : !audit.length ? (
            <p>Nenhuma alteração nesta página.</p>
          ) : (
            audit.map((a) => (
              <article className="audit-entry" key={a.id}>
                <strong>
                  {a.actor_name || "Usuário anterior"} ·{" "}
                  {(
                    {
                      INSERT: "Cadastro",
                      UPDATE: "Alteração",
                      DELETE: "Exclusão",
                      MANAGE_EDIT: "Edição administrativa",
                      MANAGE_ARCHIVE: "Arquivamento",
                      MANAGE_RESTORE: "Restauração",
                      MANAGE_DELETE: "Exclusão administrativa",
                    } as Record<string, string>
                  )[a.operation] || a.operation}
                </strong>
                <time>
                  {new Date(a.occurred_at).toLocaleString("pt-BR", {
                    timeZone: "America/Sao_Paulo",
                  })}
                </time>
                <span>
                  {String(a.after_data?.name || a.before_data?.name || "")}
                </span>
                <small>Registro: {a.entity_id}</small>
                <details>
                  <summary>Ver dados anteriores e posteriores</summary>
                  <div className="table-scroll">
                    <table className="audit-changes">
                      <thead>
                        <tr>
                          <th>Campo</th>
                          <th>Antes</th>
                          <th>Depois</th>
                        </tr>
                      </thead>
                      <tbody>
                        {auditChanges(a).map((key) => (
                          <tr key={key}>
                            <th>{auditFieldLabels[key] || key}</th>
                            <td>
                              {auditValue(key, a.before_data?.[key], store)}
                            </td>
                            <td>
                              {auditValue(key, a.after_data?.[key], store)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </details>
              </article>
            ))
          )}
          <div className="audit-pagination">
            <button
              className="secondary"
              disabled={page === 0 || loading}
              onClick={() => setPage((p) => p - 1)}
            >
              Anterior
            </button>
            <span>Página {page + 1}</span>
            <button
              className="secondary"
              disabled={audit.length < 25 || loading}
              onClick={() => setPage((p) => p + 1)}
            >
              Próxima
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
