import { courseProgress, formatHours } from "@/lib/course-progress";
import {
  displayDate,
  studentDisplayName,
  type Store,
  type Student,
} from "@/lib/domain";
import { classColor } from "@/lib/class-appearance";
import { CourseProgressBar } from "./course-progress-bar";
import { courseReviewState } from "@/lib/course-alerts";
export function CourseProgressCard({
  store,
  student,
  onReview,
}: {
  store: Store;
  student: Student;
  onReview?: () => void;
}) {
  const p = courseProgress(store, student),
    group = store.classes.find((c) => c.id === student.class_id);
  const review = courseReviewState(store, student, undefined, p);
  return (
    <section className="course-progress-card" aria-label="Progresso do curso">
      <div className="course-progress-heading">
        <div>
          <h3>Progresso do curso</h3>
          <span>{p.offeringName}</span>
        </div>
        <strong>
          {p.percent === null ? "—" : `${p.percent.toLocaleString("pt-BR")}%`}
        </strong>
      </div>
      <CourseProgressBar
        progress={p}
        name={studentDisplayName(student)}
        color={group ? classColor(group) : undefined}
      />
      {review.messages.length > 0 && !p.inactive && (
        <div className="course-review-warning">
          {review.messages.map((message) => (
            <p key={message}>{message}</p>
          ))}
        </div>
      )}
      {review.latest && (
        <div className="course-review-latest">
          <strong>
            Última análise · {displayDate(review.latest!.date)} ·{" "}
            {store.profiles.find(
              (profile) => profile.id === review.latest!.author_id,
            )?.name || "Equipe"}
          </strong>
          <p>{review.latest!.outcome}</p>
        </div>
      )}
      {onReview &&
        (p.excessHours > 0 || p.completed || p.deadlineState !== "none") && (
          <button type="button" className="secondary" onClick={onReview}>
            Registrar análise do curso
          </button>
        )}
      <dl className="course-progress-dates">
        <div>
          <dt>Início do curso</dt>
          <dd>{p.startDate ? displayDate(p.startDate) : "A definir"}</dd>
          {p.startDate && p.startFromEnrollment && (
            <small>Data da matrícula como referência</small>
          )}
        </div>
        <div>
          <dt>Horas por aula</dt>
          <dd>
            {p.lessonMinutes
              ? `${formatHours(p.lessonMinutes / 60)} h`
              : "A definir"}
          </dd>
          {p.weekdays.length > 0 && (
            <small>{p.weekdays.length} dia(s) de aula por semana</small>
          )}
        </div>
        <div>
          <dt>
            {p.completed
              ? "Última aula contabilizada"
              : p.estimateBasis === "billing"
                ? "Prazo contratual de término"
                : "Término estimado"}
          </dt>
          <dd>
            {p.completed
              ? p.completedOn
                ? displayDate(p.completedOn)
                : "Carga cumprida"
              : p.estimatedEnd
                ? displayDate(p.estimatedEnd)
                : p.inactive
                  ? "Matrícula inativa"
                  : "Dados insuficientes"}
          </dd>
          {!p.completed && p.estimatedEnd && (
            <small>
              {p.noRecentPresence
                ? "Supõe retorno às aulas"
                : p.estimateBasis === "billing"
                  ? "Prazo contratual, sem agenda para estimar"
                  : p.usesAttendance
                    ? "Ajustada pela assiduidade"
                    : "Baseada nos dias de aula"}
            </small>
          )}
        </div>
        <div>
          <dt>Prazo contratual de término (último boleto)</dt>
          <dd>
            {p.lastInstallment
              ? displayDate(p.lastInstallment)
              : "Não informado"}
          </dd>
        </div>
      </dl>
      {p.billingGap !== null && (
        <p
          className={`course-billing-comparison ${p.billingGap > 0 ? "after-billing" : ""}`}
        >
          {p.billingGap === 0
            ? "Previsão coincide com o último boleto."
            : `Previsão ${Math.abs(p.billingGap)} dias ${p.billingGap > 0 ? "após o" : "antes do"} último boleto.`}
        </p>
      )}
      <details className="course-progress-method">
        <summary>Como a estimativa é calculada</summary>
        <p>
          Presenças e atrasos somam horas. Faltas e justificativas não somam.
          Feriados e aulas futuras ainda não registradas não são conhecidos pelo
          sistema.
        </p>
        {p.estimateBasis === "schedule" && (
          <p>
            A previsão usa os dias de aula e a carga horária restante
            {p.usesAttendance
              ? " ajustada pela assiduidade das últimas 20 chamadas."
              : ". O ajuste de assiduidade começa após quatro chamadas."}
          </p>
        )}
        {p.estimateBasis === "billing" && (
          <p>
            Sem dias de aula definidos, a referência exibida é a data limite do
            contrato. Não há extensão automática do prazo, nem comprovação de
            conclusão.
          </p>
        )}
        {p.noRecentPresence && (
          <p>
            Não há presenças nas chamadas recentes. A previsão supõe retorno com
            frequência integral.
          </p>
        )}
        {p.missingDurations > 0 && (
          <p>
            {p.missingDurations} chamada(s) sem duração definida. Configure a
            carga horária da turma para completar o cálculo.
          </p>
        )}
        {p.legacyCalls > 0 && (
          <p>
            {p.legacyCalls} chamada(s) anterior(es) usam os cadastros atuais
            como referência.
          </p>
        )}
        {p.openingHours > 0 && (
          <p>
            {formatHours(p.openingHours)} h informadas de períodos anteriores
            estão incluídas.
          </p>
        )}
        <p>
          O prazo contratual é a data limite para concluir o curso. Ele não gera
          horas concluídas, e atingir 100% não arquiva a matrícula
          automaticamente.
        </p>
      </details>
    </section>
  );
}
