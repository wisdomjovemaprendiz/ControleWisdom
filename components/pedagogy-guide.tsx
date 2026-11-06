"use client";
import { useState, useRef, useEffect } from "react";
import type { Pedagogy } from "@/lib/domain";
import { today, displayDate } from "@/lib/domain";
import {
  observationOptions,
  pedagogicalDomains,
  scoreLabels,
  outcomeLabels,
  suggestPedagogy,
} from "@/lib/pedagogy";
import {
  guideContexts,
  guideGoals,
  guideEvidence,
  guidedPedagogyDraft,
  guideFollowUp,
} from "@/lib/pedagogy-guide";

const steps = [
  "Área",
  "Observação",
  "Contexto",
  "Intervenção",
  "Acompanhamento",
  "Revisão",
];
const autonomy = [
  "Apoio contínuo",
  "Apoio frequente",
  "Apoio em algumas etapas",
  "Lembretes pontuais",
  "Execução independente",
];
export function PedagogyGuide({ parent }: { parent?: Pedagogy }) {
  const [step, setStep] = useState(0),
    [domain, setDomain] = useState(""),
    [observation, setObservation] = useState(""),
    [related, setRelated] = useState<string[]>([]),
    [frequency, setFrequency] = useState(0),
    [context, setContext] = useState(""),
    [level, setLevel] = useState(parent?.level || 3),
    [strategies, setStrategies] = useState<string[]>([]),
    [goal, setGoal] = useState(guideGoals[0]),
    [outcome, setOutcome] = useState(""),
    [evidence, setEvidence] = useState(""),
    [delay, setDelay] = useState(7),
    [kind, setKind] = useState(parent ? "Evolução" : "Diagnóstico"),
    [reviewed, setReviewed] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
  }, [step]);
  const main = observationOptions.find((o) => o.id === observation);
  const scores = Object.fromEntries(
    [observation, ...related].filter(Boolean).map((id) => [id, frequency]),
  );
  const suggestions = suggestPedagogy(scores);
  const draft = guidedPedagogyDraft({
    scores,
    strategyIds: strategies,
    context,
    level,
    goal,
    outcome,
    evidence,
  });
  const followUp = guideFollowUp(today(), delay);
  const complete = [
    !!domain,
    !!main && frequency > 0,
    !!context,
    draft.plan.strategy_ids.length > 0,
    !parent || (!!outcome && !!evidence),
    true,
  ];
  function move(next: number) {
    setReviewed(false);
    setStep(next);
  }
  function resetObservation(id: string) {
    setObservation(id);
    setRelated([]);
    setFrequency(0);
    setStrategies([]);
    setReviewed(false);
  }
  function choice(label: string, selected: boolean, onClick: () => void) {
    return (
      <button
        key={label}
        type="button"
        className={`guide-choice ${selected ? "selected" : ""}`}
        aria-pressed={selected}
        onClick={onClick}
      >
        {selected && <span aria-hidden="true">✓ </span>}
        {label}
      </button>
    );
  }
  return (
    <section
      className="pedagogy-guide"
      aria-label="Guia de registro pedagógico"
    >
      <input
        type="hidden"
        name="support_plan"
        value={JSON.stringify(draft.plan)}
      />
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="level" value={level} />
      <input type="hidden" name="skill" value={draft.skill} />
      <input type="hidden" name="notes" value={draft.notes} />
      <input type="hidden" name="intervention" value={draft.intervention} />
      <input type="hidden" name="follow_up" value={followUp} />
      <div
        className="guide-progress"
        aria-label={`Etapa ${step + 1} de ${steps.length}`}
      >
        {steps.map((name, index) => (
          <span
            key={name}
            className={index === step ? "current" : index < step ? "done" : ""}
          >
            <b>{index + 1}</b>
            <span>{name}</span>
          </span>
        ))}
      </div>
      <h3 ref={heading} tabIndex={-1}>
        {step + 1}. {steps[step]}
      </h3>
      {step === 0 && (
        <>
          <label>
            Tipo
            <select
              aria-label="Tipo"
              value={kind}
              disabled={!!parent}
              onChange={(e) => setKind(e.target.value)}
            >
              <option>Diagnóstico</option>
              <option>Evolução</option>
              <option>Intervenção</option>
            </select>
          </label>
          <p>Qual área você observou?</p>
          <div className="guide-choices">
            {pedagogicalDomains.map((value) =>
              choice(value, domain === value, () => {
                if (domain !== value) {
                  setDomain(value);
                  resetObservation("");
                }
              }),
            )}
          </div>
        </>
      )}
      {step === 1 && (
        <>
          <p>{domain} · O que ocorreu?</p>
          <div className="guide-choices">
            {observationOptions
              .filter((o) => o.domain === domain)
              .map((o) =>
                choice(o.label, observation === o.id, () => {
                  if (observation !== o.id) resetObservation(o.id);
                }),
              )}
          </div>
          {main && (
            <>
              <fieldset>
                <legend>Com que frequência?</legend>
                <div className="guide-choices compact">
                  {scoreLabels
                    .slice(1)
                    .map((label, index) =>
                      choice(label, frequency === index + 1, () =>
                        setFrequency(index + 1),
                      ),
                    )}
                </div>
              </fieldset>
              {frequency > 0 && (
                <fieldset>
                  <legend>Também observou? (opcional)</legend>
                  <div className="guide-choices">
                    {observationOptions
                      .filter((o) => main.related.includes(o.id))
                      .map((o) => (
                        <label className="guide-check" key={o.id}>
                          <input
                            type="checkbox"
                            checked={related.includes(o.id)}
                            onChange={(e) => {
                              setRelated(
                                e.target.checked
                                  ? [...related, o.id]
                                  : related.filter((id) => id !== o.id),
                              );
                              setStrategies([]);
                            }}
                          />
                          {o.label}
                        </label>
                      ))}
                  </div>
                </fieldset>
              )}
            </>
          )}
        </>
      )}
      {step === 2 && (
        <>
          <p>Em qual situação?</p>
          <div className="guide-choices">
            {guideContexts.map((value) =>
              choice(value, context === value, () => setContext(value)),
            )}
          </div>
          <label>
            Nível de autonomia
            <select
              aria-label="Nível de autonomia"
              value={level}
              onChange={(e) => setLevel(Number(e.target.value))}
            >
              {autonomy.map((label, i) => (
                <option key={label} value={i + 1}>
                  {i + 1} — {label}
                </option>
              ))}
            </select>
          </label>
        </>
      )}
      {step === 3 && (
        <>
          <p>Selecione o apoio que você pretende aplicar.</p>
          <div className="guide-choices">
            {suggestions.strategies.map((s) => (
              <div
                className={`guide-strategy ${strategies.includes(s.id) ? "selected" : ""}`}
                key={s.id}
              >
                <label className="guide-check">
                  <input
                    type="checkbox"
                    checked={strategies.includes(s.id)}
                    onChange={(e) =>
                      setStrategies(
                        e.target.checked
                          ? [...strategies, s.id]
                          : strategies.filter((id) => id !== s.id),
                      )
                    }
                  />
                  <strong>{s.title}</strong>
                </label>
                <details>
                  <summary>Como aplicar e acompanhar</summary>
                  <p>{s.steps}</p>
                  <p>{s.measure}</p>
                  <p>{s.rationale}</p>
                </details>
              </div>
            ))}
          </div>
          <label>
            Objetivo do acompanhamento
            <select
              aria-label="Objetivo do acompanhamento"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
            >
              {guideGoals.map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </label>
        </>
      )}
      {step === 4 && (
        <>
          {parent && (
            <>
              <label>
                Resultado do acompanhamento
                <select
                  aria-label="Resultado do acompanhamento"
                  value={outcome}
                  onChange={(e) => {
                    setOutcome(e.target.value);
                    setEvidence("");
                  }}
                >
                  <option value="">Selecione</option>
                  {Object.entries(outcomeLabels).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              {outcome && (
                <fieldset>
                  <legend>O que você verificou?</legend>
                  <div className="guide-choices">
                    {guideEvidence[outcome].map((value) =>
                      choice(value, evidence === value, () =>
                        setEvidence(value),
                      ),
                    )}
                  </div>
                </fieldset>
              )}
            </>
          )}
          <fieldset>
            <legend>Quando acompanhar novamente?</legend>
            <div className="guide-choices compact">
              {[7, 14, 30, 0].map((days) =>
                choice(
                  days ? `Em ${days} dias` : "Sem novo lembrete",
                  delay === days,
                  () => setDelay(days),
                ),
              )}
            </div>
          </fieldset>
          {followUp && (
            <p className="guide-date">Acompanhar em {displayDate(followUp)}</p>
          )}
        </>
      )}
      {step === 5 && (
        <div className="guide-review">
          <h4>{draft.skill}</h4>
          <p>{draft.notes}</p>
          <h4>Intervenção e acompanhamento</h4>
          <p>{draft.intervention}</p>
          {followUp && (
            <p>
              <strong>Retomar em {displayDate(followUp)}</strong>
            </p>
          )}
          <small>
            As sugestões apoiam o planejamento pedagógico. Não constituem
            diagnóstico clínico.
          </small>
        </div>
      )}
      <div className="guide-navigation">
        <button
          type="button"
          className="secondary"
          disabled={step === 0}
          onClick={() => move(step - 1)}
        >
          Voltar
        </button>
        {step < 5 && (
          <button
            type="button"
            className="primary"
            disabled={!complete[step]}
            onClick={() => move(step + 1)}
          >
            {step === 4 ? "Revisar relatório" : "Continuar"}
          </button>
        )}
      </div>
      <label className="guide-check guide-confirm">
        <input
          type="checkbox"
          required
          aria-label="Revisei e confirmo o registro pedagógico"
          checked={reviewed && step === 5}
          onChange={(e) => {
            if (step === 5) setReviewed(e.target.checked);
          }}
        />
        {step === 5
          ? "Revisei e confirmo o registro pedagógico"
          : "Confirme o relatório após a etapa de revisão."}
      </label>
    </section>
  );
}
