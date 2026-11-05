"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
export interface OffboardingStep {
  id: string;
  label: string;
  position: number;
  active: boolean;
}
export function OffboardingChecklist({
  required = true,
}: {
  required?: boolean;
}) {
  const [steps, setSteps] = useState<OffboardingStep[]>([]),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true);
  async function load() {
    setLoading(true);
    setError("");
    const result = await supabase
      ?.from("offboarding_steps")
      .select("*")
      .eq("active", true)
      .order("position")
      .order("id");
    if (result?.error || !result)
      setError("Não foi possível carregar o checklist. Tente novamente.");
    else setSteps(result.data);
    setLoading(false);
  }
  useEffect(() => {
    void load();
  }, []);
  return (
    <fieldset className="offboarding-checklist">
      <legend>Checklist de desligamento</legend>
      {loading ? (
        <p role="status">Carregando etapas…</p>
      ) : error ? (
        <p role="alert">
          {error}{" "}
          <button
            type="button"
            className="text-link"
            onClick={() => void load()}
          >
            Tentar novamente
          </button>
        </p>
      ) : !steps.length ? (
        <p>Solicite à coordenação a configuração das etapas de desligamento.</p>
      ) : (
        steps.map((step) => (
          <label key={step.id}>
            <input
              type="checkbox"
              name="offboarding_step"
              value={step.id}
              required={required}
            />
            <span>{step.label}</span>
          </label>
        ))
      )}
      <small>
        Todas as etapas devem estar concluídas para arquivar. Em aulas
        individuais sem grupo, confirme que não há grupo do qual retirar o
        aluno.
      </small>
    </fieldset>
  );
}
export function offboardingFromForm(fd: FormData) {
  return {
    steps: fd
      .getAll("offboarding_step")
      .map((id) => ({ id: String(id), completed: true })),
  };
}
