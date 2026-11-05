"use client";
import { INDIVIDUAL, isIndividual } from "@/lib/individual";
import { studentDisplayName } from "@/lib/domain";
import { useState } from "react";
import { Sparkles, BookOpen, Check } from "lucide-react";
import type { Store, CourseClass, Pedagogy, SupportPlan } from "@/lib/domain";
import { today, displayDate } from "@/lib/domain";
import {
  CATALOGUE_VERSION,
  pedagogySources,
  pedagogicalDomains,
  observationOptions,
  strategyOptions,
  scoreLabels,
  outcomeLabels,
  suggestPedagogy,
  pedagogyDraft,
} from "@/lib/pedagogy";
export function PedagogyFields({
  store,
  classes,
  parent,
  individualStudents,
}: {
  store: Store;
  classes: CourseClass[];
  parent?: Pedagogy;
  individualStudents?: Store["students"];
}) {
  const [classId, setClassId] = useState(
      (parent && !parent.class_id ? INDIVIDUAL : parent?.class_id) ||
        classes[0]?.id ||
        INDIVIDUAL,
    ),
    [studentId, setStudentId] = useState(parent?.student_id || ""),
    [mode, setMode] = useState<"manual" | "assisted">("manual"),
    [domain, setDomain] = useState<string>(pedagogicalDomains[0]),
    [description, setDescription] = useState(""),
    [scores, setScores] = useState<Record<string, number>>({}),
    [selected, setSelected] = useState<string[]>([]),
    [context, setContext] = useState(""),
    [baseline, setBaseline] = useState(""),
    [goal, setGoal] = useState(parent?.support_plan?.goal || ""),
    [criteria, setCriteria] = useState(parent?.support_plan?.criteria || ""),
    [outcome, setOutcome] = useState(""),
    [evidence, setEvidence] = useState(""),
    [skill, setSkill] = useState(parent?.skill || ""),
    [notes, setNotes] = useState(""),
    [intervention, setIntervention] = useState(""),
    [hint, setHint] = useState(""),
    [allStrategies, setAllStrategies] = useState(false);
  const sources = [
    ...new Set(
      strategyOptions
        .filter((s) => selected.includes(s.id))
        .flatMap((s) => s.sources),
    ),
  ];
  const plan: SupportPlan = {
    mode,
    observation_scores: scores,
    strategy_ids: selected,
    context,
    baseline,
    goal,
    criteria,
    outcome,
    evidence,
    sources,
    catalogue_version: CATALOGUE_VERSION,
  };
  const suggestions = suggestPedagogy(scores, description);
  function prepare() {
    if (!suggestions.selected.length && !parent) {
      setHint("Marque ao menos uma observação que você realmente identificou.");
      return;
    }
    const draft = pedagogyDraft(plan);
    if (draft.skill) setSkill(draft.skill);
    if (draft.notes) setNotes(draft.notes);
    if (draft.intervention) setIntervention(draft.intervention);
    setHint(
      "Rascunho preparado. Revise as observações, os apoios e as metas antes de salvar.",
    );
  }
  return (
    <>
      {parent && (
        <div className="pedagogy-parent">
          <strong>Acompanhamento de {displayDate(parent.date)}</strong>
          <p>{parent.skill}</p>
          <p>{parent.intervention || parent.notes}</p>
          {parent.support_plan?.goal && (
            <p>
              <b>Objetivo anterior:</b> {parent.support_plan.goal}
            </p>
          )}
          <small>
            O novo relatório ficará vinculado ao registro anterior. Salvar a
            evolução conclui esse lembrete.
          </small>
        </div>
      )}
      <input type="hidden" name="parent_record_id" value={parent?.id || ""} />
      <input type="hidden" name="support_plan" value={JSON.stringify(plan)} />
      <label>
        Turma *
        <select
          name="class_id"
          aria-label="Turma *"
          required
          value={classId}
          disabled={!!parent}
          onChange={(e) => {
            setClassId(e.target.value);
            setStudentId("");
          }}
        >
          <option value={INDIVIDUAL}>Aulas individuais</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        {parent && <input type="hidden" name="class_id" value={classId} />}
      </label>
      <label>
        {classId === INDIVIDUAL
          ? "Aluno da aula individual"
          : "Aluno (opcional)"}
        <select
          name="student_id"
          aria-label={
            classId === INDIVIDUAL
              ? "Aluno da aula individual"
              : "Aluno (opcional)"
          }
          required={classId === INDIVIDUAL}
          value={studentId}
          disabled={!!parent}
          onChange={(e) => setStudentId(e.target.value)}
        >
          <option value="">
            {classId === INDIVIDUAL
              ? "Selecione o aluno"
              : "Registro de toda a turma"}
          </option>
          {(classId === INDIVIDUAL
            ? individualStudents || store.students
            : store.students
          )
            .filter(
              (s) =>
                ((classId === INDIVIDUAL
                  ? isIndividual(s)
                  : s.class_id === classId) &&
                  s.status === "ativo") ||
                s.id === parent?.student_id,
            )
            .map((s) => (
              <option key={s.id} value={s.id}>
                {studentDisplayName(s)}
              </option>
            ))}
        </select>
        {parent && <input type="hidden" name="student_id" value={studentId} />}
      </label>
      <div
        className="pedagogy-mode"
        role="group"
        aria-label="Modo de preenchimento pedagógico"
      >
        <button
          className={mode === "manual" ? "selected" : ""}
          type="button"
          onClick={() => setMode("manual")}
        >
          Preenchimento manual
        </button>
        <button
          className={mode === "assisted" ? "selected" : ""}
          type="button"
          onClick={() => setMode("assisted")}
        >
          <Sparkles size={16} />
          Preenchimento assistido
        </button>
      </div>
      <div className="form-grid">
        <label>
          Tipo
          <select
            name="kind"
            defaultValue={parent ? "Evolução" : "Diagnóstico"}
            disabled={!!parent}
          >
            <option>Diagnóstico</option>
            <option>Evolução</option>
            <option>Intervenção</option>
          </select>
          {parent && <input type="hidden" name="kind" value="Evolução" />}
        </label>
        <label>
          Nível atual (1 a 5)
          <input
            type="number"
            name="level"
            min="1"
            max="5"
            required
            defaultValue={parent?.level || 3}
          />
        </label>
      </div>
      <details className="pedagogy-rubric">
        <summary>Como registrar o nível de autonomia</summary>
        <p>
          1: apoio contínuo · 2: apoio frequente · 3: apoio em algumas etapas ·
          4: lembretes pontuais · 5: execução independente. Compare a mesma
          habilidade em tarefas equivalentes; a escala é de acompanhamento, sem
          finalidade diagnóstica clínica.
        </p>
      </details>
      {mode === "assisted" && (
        <section className="pedagogy-assistant">
          <div className="pedagogy-assistant-title">
            <Sparkles size={20} />
            <div>
              <h3>Observação, apoio e acompanhamento</h3>
              <p>
                Selecione fatos observados. As relações sugeridas são
                possibilidades a verificar, nunca conclusões sobre o aluno.
              </p>
            </div>
          </div>
          <label>
            Descreva a dificuldade para encontrar opções
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ex.: precisa de ajuda para iniciar, perde etapas, evita apresentações…"
            />
          </label>
          <label>
            Área de observação
            <select value={domain} onChange={(e) => setDomain(e.target.value)}>
              {pedagogicalDomains.map((d) => (
                <option key={d}>{d}</option>
              ))}
            </select>
          </label>
          <p className="pedagogy-caption">
            Frequência observada no período que você acompanhou: 0 não observado
            · 1 ocasional · 2 frequente · 3 muito frequente.
          </p>
          <div className="observation-list">
            {observationOptions
              .filter((o) => o.domain === domain)
              .map((o) => (
                <label key={o.id} className="observation-row">
                  <span>{o.label}</span>
                  <select
                    aria-label={`Pontuação: ${o.label}`}
                    value={scores[o.id] || 0}
                    onChange={(e) =>
                      setScores({ ...scores, [o.id]: Number(e.target.value) })
                    }
                  >
                    {scoreLabels.map((text, index) => (
                      <option key={text} value={index}>
                        {index} — {text}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
          </div>
          {suggestions.selected.length > 0 && (
            <div className="selected-observations">
              <strong>
                Observações selecionadas ({suggestions.selected.length})
              </strong>
              {suggestions.selected.map((o) => (
                <div key={o.id}>
                  <span>
                    {o.label} · {scoreLabels[scores[o.id]]}
                  </span>
                  <button
                    type="button"
                    className="text-link"
                    onClick={() => setScores({ ...scores, [o.id]: 0 })}
                  >
                    Remover
                  </button>
                </div>
              ))}
            </div>
          )}
          {!!suggestions.observations.length && (
            <div className="pedagogy-related">
              <h4>Também vale observar</h4>
              <p>
                Confirme apenas se você verificou esse comportamento. Nada é
                incluído automaticamente.
              </p>
              {suggestions.observations.map((o) => (
                <button
                  type="button"
                  className="secondary"
                  key={o.id}
                  onClick={() => {
                    setScores({ ...scores, [o.id]: 1 });
                    setDomain(o.domain);
                  }}
                >
                  <Check size={15} />
                  {o.label}
                </button>
              ))}
            </div>
          )}
          <div className="strategy-heading">
            <h4>Intervenções para considerar</h4>
            <button
              type="button"
              className="text-link"
              onClick={() => setAllStrategies(!allStrategies)}
            >
              {allStrategies
                ? "Mostrar sugestões relacionadas"
                : "Ver todas as estratégias"}
            </button>
          </div>
          <p className="pedagogy-caption">
            A ordem considera as observações e frequências marcadas. Adapte o
            apoio à tarefa, à voz do aluno e às condições da turma.
          </p>
          <div className="strategy-list">
            {(allStrategies ? strategyOptions : suggestions.strategies).map(
              (s) => (
                <article
                  key={s.id}
                  className={selected.includes(s.id) ? "chosen" : ""}
                >
                  <label className="strategy-checkbox">
                    <input
                      type="checkbox"
                      checked={selected.includes(s.id)}
                      onChange={(e) =>
                        setSelected(
                          e.target.checked
                            ? [...selected, s.id]
                            : selected.filter((id) => id !== s.id),
                        )
                      }
                    />
                    <strong>{s.title}</strong>
                  </label>
                  <p>{s.steps}</p>
                  <details>
                    <summary>Por que considerar e como acompanhar</summary>
                    <p>{s.rationale}</p>
                    <p>
                      <b>Evidência a recolher:</b> {s.measure}
                    </p>
                    <p>
                      {pedagogySources
                        .filter((ref) => s.sources.includes(ref.id))
                        .map((ref) => (
                          <a
                            key={ref.id}
                            href={ref.url}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {ref.title}
                          </a>
                        ))}
                    </p>
                  </details>
                </article>
              ),
            )}
          </div>
          {!suggestions.strategies.length && !allStrategies && (
            <p>
              Marque observações para receber sugestões relacionadas, ou
              consulte o catálogo completo.
            </p>
          )}
          <label>
            Contexto e período observado
            <textarea
              value={context}
              onChange={(e) => setContext(e.target.value)}
              placeholder="Atividade, período, apoios disponíveis e condições da observação"
            />
          </label>
          <label>
            Situação inicial / linha de base
            <textarea
              value={baseline}
              onChange={(e) => setBaseline(e.target.value)}
              placeholder="O que o aluno já faz, onde precisa de apoio e quais evidências você recolheu"
            />
          </label>
        </section>
      )}
      <label>
        Objetivo do acompanhamento
        <textarea
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          placeholder="Uma meta específica combinada com o aluno"
        />
      </label>
      <label>
        Critério para avaliar a evolução
        <textarea
          value={criteria}
          onChange={(e) => setCriteria(e.target.value)}
          placeholder="Como comparar tarefas, registros, apoios necessários e percepção do aluno"
        />
      </label>
      {parent && (
        <>
          <label>
            Resultado do acompanhamento *
            <select
              required
              value={outcome}
              onChange={(e) => setOutcome(e.target.value)}
            >
              <option value="">Selecione o que foi observado</option>
              {Object.entries(outcomeLabels).map(([key, text]) => (
                <option key={key} value={key}>
                  {text}
                </option>
              ))}
            </select>
          </label>
          <label>
            Evidências da evolução *
            <textarea
              required
              value={evidence}
              onChange={(e) => setEvidence(e.target.value)}
              placeholder="Descreva o que ocorreu após a intervenção; inclua exemplos reais, inclusive se ainda não houve avanço."
            />
          </label>
        </>
      )}
      {mode === "assisted" && (
        <button
          type="button"
          className="secondary pedagogy-draft"
          onClick={prepare}
        >
          <Sparkles size={17} />
          Preparar rascunho para revisão
        </button>
      )}
      {hint && (
        <p role="status" className="pedagogy-hint">
          {hint}
        </p>
      )}
      <label>
        Habilidade observada *
        <input
          name="skill"
          required
          value={skill}
          onChange={(e) => setSkill(e.target.value)}
          placeholder="Ex.: raciocínio lógico, comunicação…"
        />
      </label>
      <label>
        Observações e evolução *
        <textarea
          name="notes"
          required
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </label>
      <label>
        Intervenção / próximo passo
        <textarea
          name="intervention"
          value={intervention}
          onChange={(e) => setIntervention(e.target.value)}
        />
      </label>
      <label>
        Data para acompanhamento
        <input type="date" name="follow_up" min={today()} />
      </label>
      <details className="pedagogy-sources">
        <summary>
          <BookOpen size={16} />
          Referências e limites das sugestões
        </summary>
        <p>
          Catálogo de apoio ao planejamento pedagógico, adaptado ao contexto de
          cursos e jovem aprendiz. Não é teste padronizado nem diagnóstico de
          transtornos. O professor registra evidências, ajusta as estratégias e
          avalia os resultados; persistindo barreiras, articula o apoio da
          coordenação e dos profissionais responsáveis.
        </p>
        {pedagogySources.map((ref) => (
          <div key={ref.id}>
            <a href={ref.url} target="_blank" rel="noreferrer">
              {ref.title}
            </a>
            <p>{ref.scope}</p>
          </div>
        ))}
        <small>
          Catálogo {CATALOGUE_VERSION}. Relações por critérios explícitos, sem
          envio dos dados do aluno a serviços externos.
        </small>
      </details>
    </>
  );
}
