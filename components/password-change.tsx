"use client";
import { useState, type FormEvent } from "react";
import { KeyRound } from "lucide-react";
import { supabase } from "@/lib/supabase";
export function PasswordChange({
  required = false,
  onDone,
}: {
  required?: boolean;
  onDone: () => void;
}) {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    if (data.get("password") !== data.get("confirm")) {
      setError("As senhas não coincidem.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const { data: session } = await supabase!.auth.getSession();
      if (!session.session) throw new Error("Entre novamente para continuar.");
      const response = await fetch("/api/account/password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.session.access_token}`,
        },
        body: JSON.stringify({ password: data.get("password") }),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error || "Não foi possível alterar a senha.");
      await supabase!.auth.signOut({ scope: "local" });
      onDone();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="panel password-change" onSubmit={submit}>
      <span className="circle-icon">
        <KeyRound size={22} />
      </span>
      <h2>{required ? "Defina sua senha pessoal" : "Alterar minha senha"}</h2>
      <p>
        {required
          ? "Sua conta usa uma senha inicial. Escolha uma nova senha para acessar os dados da escola."
          : "Ao concluir, entre novamente com a nova senha."}
      </p>
      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}
      <label>
        Nova senha
        <input
          type="password"
          name="password"
          minLength={6}
          maxLength={128}
          required
          autoComplete="new-password"
        />
      </label>
      <label>
        Confirmar nova senha
        <input
          type="password"
          name="confirm"
          minLength={6}
          maxLength={128}
          required
          autoComplete="new-password"
        />
      </label>
      <small>
        Mínimo de 6 caracteres. Prefira uma senha exclusiva e difícil de
        adivinhar.
      </small>
      <button className="primary" disabled={busy}>
        {busy ? "Alterando…" : "Salvar nova senha e entrar novamente"}
      </button>
      {required && (
        <button
          className="text-link"
          type="button"
          disabled={busy}
          onClick={() => void supabase!.auth.signOut({ scope: "local" })}
        >
          Sair
        </button>
      )}
    </form>
  );
}
