import { courseProgress, formatHours } from "@/lib/course-progress";
import { displayDate, type Store, type Student } from "@/lib/domain";
import { classColor } from "@/lib/class-appearance";
export function CourseProgressCard({
  store,
  student,
}: {
  store: Store;
  student: Student;
}) {
  const p = courseProgress(store, student),
    group = store.classes.find((c) => c.id === student.class_id);
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
      {p.totalHours ? (
        <>
          <div
            className="course-progress-track"
            role="progressbar"
            aria-label="Carga horária concluída"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={p.percent!}
            style={
              {
                "--course-progress-color": group
                  ? classColor(group)
                  : "#174b91",
              } as import("react").CSSProperties
            }
          >
            <span style={{ width: `${p.percent}%` }} />
          </div>
          <p className="course-progress-hours">
            <strong>
              {formatHours(p.completedHours)} h de {formatHours(p.totalHours)} h
            </strong>
            <span>
              {p.completed
                ? "Carga horária cumprida"
                : `${formatHours(p.remainingHours!)} h restantes${p.remainingLessons !== null ? ` · cerca de ${p.remainingLessons} aulas com presença` : ""}`}
            </span>
          </p>
        </>
      ) : (
        <p className="course-progress-help">
          Informe a carga horária do curso ou da aula individual para acompanhar
          o progresso.
        </p>
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
            {p.completed ? "Última aula contabilizada" : "Término estimado"}
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
                  ? "Referência pelo prazo de boletos"
                  : p.usesAttendance
                    ? "Ajustada pela assiduidade"
                    : "Baseada nos dias de aula"}
            </small>
          )}
        </div>
        <div>
          <dt>Último boleto</dt>
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
            Sem dias de aula definidos, a previsão usa o intervalo entre o
            início e o vencimento do último boleto. É uma referência de
            planejamento, não comprovação de conclusão.
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
          A data do boleto não gera horas concluídas e atingir 100% não arquiva
          a matrícula automaticamente.
        </p>
      </details>
    </section>
  );
}
