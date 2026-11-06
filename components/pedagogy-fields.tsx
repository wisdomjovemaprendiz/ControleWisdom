"use client";
import { PedagogyGuide } from "./pedagogy-guide";
import { INDIVIDUAL, isIndividual } from "@/lib/individual";
import { studentDisplayName } from "@/lib/domain";
import { useState } from "react";
import { Sparkles, BookOpen } from "lucide-react";
import type { Store, CourseClass, Pedagogy, SupportPlan } from "@/lib/domain";
import { today, displayDate } from "@/lib/domain";
import {
  CATALOGUE_VERSION,
  pedagogySources,
  outcomeLabels,
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
    [goal, setGoal] = useState(parent?.support_plan?.goal || ""),
    [criteria, setCriteria] = useState(parent?.support_plan?.criteria || ""),
    [outcome, setOutcome] = useState(""),
    [evidence, setEvidence] = useState(""),
    [skill, setSkill] = useState(parent?.skill || ""),
    [notes, setNotes] = useState(""),
    [intervention, setIntervention] = useState("");
  const plan: SupportPlan = {
    mode,
    observation_scores: {},
    strategy_ids: [],
    context: "",
    baseline: "",
    goal,
    criteria,
    outcome,
    evidence,
    sources: [],
    catalogue_version: CATALOGUE_VERSION,
  };
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
      {mode === "manual" && (
        <input type="hidden" name="support_plan" value={JSON.stringify(plan)} />
      )}
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
      {mode === "assisted" ? (
        <PedagogyGuide parent={parent} />
      ) : (
        <>
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
              1: apoio contínuo · 2: apoio frequente · 3: apoio em algumas
              etapas · 4: lembretes pontuais · 5: execução independente. Compare
              a mesma habilidade em tarefas equivalentes; a escala é de
              acompanhamento, sem finalidade diagnóstica clínica.
            </p>
          </details>
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
        </>
      )}
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
