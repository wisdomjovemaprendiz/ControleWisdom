"use client";
import { useState, type FormEvent } from "react";
import { Plus, KeyRound, Pencil, X, ShieldCheck } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { labels, type Profile, type Unit } from "@/lib/domain";
export function TeamManager({
  profiles,
  units,
  actor,
  onSaved,
}: {
  profiles: Profile[];
  units: Unit[];
  actor: Profile;
  onSaved: () => Promise<void>;
}) {
  const [mode, setMode] = useState<"create" | "edit" | "password" | null>(null),
    [selected, setSelected] = useState<Profile | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setError("");
    if (mode !== "edit" && form.get("password") !== form.get("confirm")) {
      setError("As senhas não coincidem.");
      return;
    }
    setBusy(true);
    try {
      const { data } = await supabase!.auth.getSession();
      if (!data.session) throw new Error("Entre novamente para continuar.");
      const body =
        mode === "password"
          ? {
              action: "reset_password",
              id: selected?.id,
              password: form.get("password"),
            }
          : {
              ...(mode === "edit"
                ? { id: selected?.id, active: form.get("active") === "on" }
                : {
                    username: form.get("username"),
                    password: form.get("password"),
                  }),
              name: form.get("name"),
              role: form.get("role"),
              unit_id: form.get("unit_id"),
            };
      const response = await fetch("/api/team", {
        method: mode === "edit" ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${data.session.access_token}`,
        },
        body: JSON.stringify(body),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error || "Operação indisponível.");
      setMode(null);
      setSelected(null);
      setNotice(
        mode === "create"
          ? "Login criado. Informe a senha inicial pessoalmente ao funcionário. Ele deverá alterá-la ao entrar."
          : mode === "password"
            ? "Senha inicial redefinida. O usuário deverá alterá-la ao entrar."
            : "Conta atualizada.",
      );
      await onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <section className="panel">
        <div className="panel-header">
          <div>
            <span className="index-label">ADMINISTRAÇÃO DE ACESSOS</span>
            <h2>Equipe e logins</h2>
            <p>
              Crie o nome de usuário, a senha inicial, o perfil e a unidade de
              cada funcionário.
            </p>
          </div>
          <button
            className="primary"
            onClick={() => {
              setSelected(null);
              setError("");
              setMode("create");
            }}
          >
            <Plus size={17} /> Novo usuário
          </button>
        </div>
        {notice && (
          <div className="team-notice" role="status">
            <ShieldCheck size={18} />
            {notice}
          </div>
        )}
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>FUNCIONÁRIO / LOGIN</th>
                <th>PERFIL</th>
                <th>UNIDADE</th>
                <th>ACESSO</th>
                <th>AÇÕES</th>
              </tr>
            </thead>
            <tbody>
              {profiles.map((p) => (
                <tr key={p.id}>
                  <td>
                    <strong>{p.name}</strong>
                    <small>{p.username || "Login ainda não definido"}</small>
                  </td>
                  <td>
                    <span className="badge neutral">{labels[p.role]}</span>
                  </td>
                  <td>{units.find((u) => u.id === p.unit_id)?.name}</td>
                  <td>
                    <span
                      className={`badge ${p.active === false ? "orange" : "green"}`}
                    >
                      {p.active === false
                        ? "Desativado"
                        : p.must_change_password
                          ? "Troca de senha pendente"
                          : "Ativo"}
                    </span>
                  </td>
                  <td>
                    <div className="row-actions">
                      <button
                        className="icon-button"
                        title={`Editar acesso de ${p.name}`}
                        onClick={() => {
                          setSelected(p);
                          setError("");
                          setMode("edit");
                        }}
                      >
                        <Pencil size={16} />
                      </button>
                      {p.id !== actor.id && (
                        <button
                          className="icon-button"
                          title={`Redefinir senha de ${p.name}`}
                          onClick={() => {
                            setSelected(p);
                            setError("");
                            setMode("password");
                          }}
                        >
                          <KeyRound size={16} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      {mode && (
        <div className="modal-overlay">
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="team-title"
          >
            <div className="modal-header">
              <div>
                <span className="eyebrow">ACESSO DA EQUIPE</span>
                <h2 id="team-title">
                  {mode === "create"
                    ? "Criar usuário"
                    : mode === "edit"
                      ? "Editar acesso"
                      : "Redefinir senha inicial"}
                </h2>
              </div>
              <button
                className="icon-button"
                type="button"
                aria-label="Fechar cadastro de usuário"
                disabled={busy}
                onClick={() => setMode(null)}
              >
                <X size={21} />
              </button>
            </div>
            <form className="modal-form" onSubmit={submit}>
              {error && (
                <div className="error" role="alert">
                  {error}
                </div>
              )}
              {mode !== "password" ? (
                <>
                  <label>
                    Nome completo
                    <input
                      name="name"
                      required
                      maxLength={100}
                      defaultValue={selected?.name}
                    />
                  </label>
                  <label>
                    Nome de login
                    <input
                      name="username"
                      aria-label="Nome de login"
                      required={mode === "create"}
                      disabled={mode === "edit"}
                      pattern="[a-z][a-z0-9._-]{2,31}"
                      autoComplete="off"
                      defaultValue={selected?.username || ""}
                      placeholder="ex.: ana.oliveira"
                    />
                    <small>
                      De 3 a 32 caracteres, sem espaços ou acentos. Não é
                      necessário e-mail.
                    </small>
                  </label>
                  <div className="form-grid">
                    <label>
                      Perfil
                      <select
                        name="role"
                        required
                        defaultValue={selected?.role || "professor"}
                      >
                        {[
                          "comercial",
                          "professor",
                          "secretaria",
                          "coordenacao",
                          "admin",
                        ].map((role) => (
                          <option value={role} key={role}>
                            {labels[role]}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Unidade
                      <select
                        name="unit_id"
                        required
                        defaultValue={selected?.unit_id || units[0]?.id}
                      >
                        {units.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  {mode === "edit" && (
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        name="active"
                        defaultChecked={selected?.active !== false}
                      />{" "}
                      Acesso ativo
                    </label>
                  )}
                </>
              ) : (
                <p>
                  Defina uma nova senha inicial para{" "}
                  <strong>{selected?.name}</strong> ({selected?.username}).
                </p>
              )}
              {mode !== "edit" && (
                <>
                  <label>
                    Senha inicial
                    <input
                      name="password"
                      type="password"
                      required
                      minLength={6}
                      maxLength={128}
                      autoComplete="new-password"
                    />
                  </label>
                  <label>
                    Confirmar senha inicial
                    <input
                      name="confirm"
                      type="password"
                      required
                      minLength={6}
                      maxLength={128}
                      autoComplete="new-password"
                    />
                  </label>
                  <small>
                    Mínimo de 6 caracteres. O funcionário deverá trocar a senha
                    no primeiro acesso. As senhas nunca são exibidas na
                    listagem.
                  </small>
                </>
              )}
              <div className="modal-footer">
                <button
                  type="button"
                  className="secondary"
                  disabled={busy}
                  onClick={() => setMode(null)}
                >
                  Cancelar
                </button>
                <button className="primary" disabled={busy}>
                  {busy
                    ? "Salvando…"
                    : mode === "create"
                      ? "Criar login"
                      : mode === "edit"
                        ? "Salvar acesso"
                        : "Redefinir senha"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </>
  );
}
