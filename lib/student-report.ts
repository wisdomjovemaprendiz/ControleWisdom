import {
  attendanceDescription,
  comparePedagogy,
  displayDate,
  labels,
  studentDisplayName,
  today,
  type Store,
  type Student,
} from "./domain";
import { courseProgress, formatHours } from "./course-progress";
import { studentPlacement, weekdays } from "./individual";
import { studentWeekdays, scheduleTimeLabel } from "./school-calendar";
import { studentOccurrences, occurrenceText } from "./occurrences";
import { absenceAlert } from "./absence-alerts";
import { outcomeLabels } from "./pedagogy";
export type StudentReportAudience = "internal" | "family";
export interface StudentReportSection {
  title: string;
  headers: string[];
  rows: string[][];
}
export interface StudentReport {
  audience: StudentReportAudience;
  title: string;
  name: string;
  unit: string;
  date: string;
  filename: string;
  metrics: { label: string; value: string }[];
  sections: StudentReportSection[];
  notice: string;
}
const value = (text?: string | null) => text?.trim() || "Não informado";
const date = (text?: string | null) =>
  text ? displayDate(text) : "Não informado";
export function studentReport(
  store: Store,
  student: Student,
  audience: StudentReportAudience,
  reference = today(),
): StudentReport {
  const internal = audience === "internal";
  const group = store.classes.find((c) => c.id === student.class_id);
  const unit = store.units.find((u) => u.id === student.unit_id);
  const course = store.offerings.find(
    (o) => o.id === (student.offering_id || group?.offering_id),
  );
  const teacher =
    student.enrollment_mode === "individual"
      ? store.profiles.find((p) => p.id === student.individual_teacher_id)?.name
      : group?.teacher;
  const progress = courseProgress(store, student, reference);
  const lessonMap = new Map(
    store.lessons
      .filter(
        (l) =>
          l.closed &&
          !l.archived_at &&
          l.unit_id === student.unit_id &&
          l.date <= reference,
      )
      .map((l) => [l.id, l]),
  );
  const attendance = [
    ...new Map(
      store.attendance
        .filter(
          (a) =>
            a.student_id === student.id &&
            a.unit_id === student.unit_id &&
            !a.archived_at &&
            lessonMap.has(a.lesson_id),
        )
        .map((a) => [a.lesson_id, a]),
    ).values(),
  ].sort((a, b) =>
    lessonMap
      .get(b.lesson_id)!
      .date.localeCompare(lessonMap.get(a.lesson_id)!.date),
  );
  const count = (status: string) =>
    attendance.filter((a) => a.status === status).length;
  const valid = attendance.length - count("justificado");
  const frequency = valid
    ? `${Math.round((100 * (count("presente") + count("atrasado"))) / valid)}%`
    : "Sem registros";
  const records = store.pedagogy
    .filter(
      (p) =>
        !p.archived_at &&
        p.student_id === student.id &&
        p.unit_id === student.unit_id &&
        p.date <= reference,
    )
    .sort(comparePedagogy);
  const contacts = store.contacts
    .filter(
      (c) =>
        !c.archived_at &&
        c.student_id === student.id &&
        c.unit_id === student.unit_id &&
        c.date <= reference,
    )
    .sort((a, b) => b.date.localeCompare(a.date));
  const occurrences = studentOccurrences(store, student.id).filter(
    (o) =>
      o.unit_id === student.unit_id &&
      lessonMap.has(o.lesson_id) &&
      (internal || o.student_id === student.id),
  );
  const sections: StudentReportSection[] = [];
  const fields = (title: string, rows: string[][]) =>
    sections.push({
      title,
      headers: ["Informação", "Dados registrados"],
      rows,
    });
  fields(internal ? "Identificação e contatos" : "Aluno e responsáveis", [
    ["Aluno", studentDisplayName(student)],
    ["Nascimento", date(student.birth_date)],
    ["Responsável", value(student.guardian)],
    ...(internal
      ? [
          ["Telefone do aluno", value(student.phone)],
          ["Telefone do responsável", value(student.guardian_phone)],
          ["E-mail", value(student.email)],
          ["Endereço", value(student.address)],
          ["Identificador do cadastro", student.id],
        ]
      : []),
  ]);
  fields("Matrícula e organização das aulas", [
    ["Unidade", value(unit?.name)],
    ["Curso", value(course?.name || group?.course)],
    ["Modalidade / turma", studentPlacement(store, student)],
    ["Professor(a)", value(teacher)],
    [
      "Dias de aula",
      studentWeekdays(store, student)
        .map((d) => weekdays[d])
        .join(" e ") || "Não definidos",
    ],
    [
      "Horário / duração",
      student.enrollment_mode === "individual"
        ? student.individual_duration_minutes
          ? `${student.individual_duration_minutes} minutos por aula`
          : "Não informado"
        : scheduleTimeLabel(group?.schedule || "") || value(group?.schedule),
    ],
    ["Início do curso informado", date(student.course_start_date)],
    ["Situação", labels[student.status] || student.status],
    ...(internal
      ? [
          ["Data da matrícula", date(student.enrollment_date)],
          [
            "Cadastro",
            {
              pre_enrollment: "Pré-matrícula",
              pending: "Cadastro pendente",
              complete: "Cadastro concluído",
            }[student.registration_stage || "complete"],
          ],
          ["Último boleto previsto", date(student.last_installment_date)],
        ]
      : []),
  ]);
  fields("Percurso e carga horária", [
    [
      "Carga horária do curso",
      progress.totalHours
        ? `${formatHours(progress.totalHours)} h`
        : "Não definida",
    ],
    ["Carga horária realizada", `${formatHours(progress.completedHours)} h`],
    [
      "Carga horária restante",
      progress.remainingHours === null
        ? "Não definida"
        : `${formatHours(progress.remainingHours)} h`,
    ],
    [
      "Conclusão da carga horária",
      progress.percent === null ? "Não calculada" : `${progress.percent}%`,
    ],
    [
      "Previsão de conclusão",
      progress.completed
        ? "Carga horária cumprida"
        : progress.estimatedEnd
          ? `${displayDate(progress.estimatedEnd)} — estimativa`
          : "Dados insuficientes para estimar",
    ],
    [
      "Critério",
      "Horas realizadas consideram presenças, atrasos e o saldo inicial registrado. A previsão pode variar conforme frequência e calendário.",
    ],
    ...(progress.missingDurations
      ? [
          [
            "Limitação do cálculo",
            `${progress.missingDurations} aula(s) sem duração definida; a carga horária pode estar incompleta.`,
          ],
        ]
      : []),
  ]);
  fields("Resumo de frequência", [
    ["Aulas com chamada registrada", String(attendance.length)],
    ["Presenças", String(count("presente"))],
    ["Atrasos", String(count("atrasado"))],
    ["Faltas", String(count("falta"))],
    ["Faltas justificadas", String(count("justificado"))],
    ["Frequência", frequency],
    [
      "Cálculo",
      "Presenças e atrasos contam como comparecimento; justificativas são excluídas do denominador.",
    ],
    ...(() => {
      const alert = absenceAlert(store, student, reference);
      return alert.active
        ? [["Acompanhamento de frequência", alert.label]]
        : [];
    })(),
  ]);
  const months = [
    ...new Set(
      attendance.map((a) => lessonMap.get(a.lesson_id)!.date.slice(0, 7)),
    ),
  ]
    .sort()
    .reverse();
  sections.push({
    title: "Frequência por mês",
    headers: ["Mês", "Presenças", "Atrasos", "Faltas", "Justificadas"],
    rows: months.length
      ? months.map((month) => [
          month.slice(5) + "/" + month.slice(0, 4),
          ...["presente", "atrasado", "falta", "justificado"].map((status) =>
            String(
              attendance.filter(
                (a) =>
                  lessonMap.get(a.lesson_id)!.date.startsWith(month) &&
                  a.status === status,
              ).length,
            ),
          ),
        ])
      : [["Sem chamadas registradas", "—", "—", "—", "—"]],
  });
  const detail = internal
    ? attendance
    : attendance.filter((a) => a.status !== "presente");
  sections.push({
    title: internal
      ? "Histórico de aulas e presença"
      : "Faltas, atrasos e justificativas",
    headers: [
      "Data",
      "Situação",
      internal ? "Conteúdo / registro" : "Detalhes",
    ],
    rows: detail.length
      ? detail.map((a) => [
          displayDate(lessonMap.get(a.lesson_id)!.date),
          attendanceDescription(a),
          internal
            ? value(lessonMap.get(a.lesson_id)!.topic)
            : a.status === "atrasado"
              ? a.arrival_time
                ? `Chegada: ${a.arrival_time}`
                : "Horário de chegada não informado"
              : a.status === "justificado"
                ? value(a.justification)
                : "Ausência registrada na chamada",
        ])
      : [
          [
            "—",
            "Sem registros",
            "Nenhuma situação registrada nesta categoria.",
          ],
        ],
  });
  for (const record of records) {
    const plan = record.support_plan;
    const author = store.profiles.find((p) => p.id === record.author_id)?.name;
    fields(`${displayDate(record.date)} · ${record.kind} · ${record.skill}`, [
      ["Habilidade acompanhada", value(record.skill)],
      ["Observações de aprendizagem", value(record.notes)],
      ["Intervenção / próximo passo", value(record.intervention)],
      ...(plan?.goal ? [["Objetivo registrado", plan.goal]] : []),
      ...(plan?.criteria
        ? [["Critério de acompanhamento", plan.criteria]]
        : []),
      ...(plan?.outcome
        ? [
            [
              "Resultado do acompanhamento",
              outcomeLabels[plan.outcome] || plan.outcome,
            ],
          ]
        : []),
      ...(plan?.evidence ? [["Evidências de evolução", plan.evidence]] : []),
      [
        "Próximo acompanhamento",
        record.follow_up
          ? `${displayDate(record.follow_up)}${record.follow_up < reference && !records.some((next) => next.parent_record_id === record.id) ? " — verificar devolutiva com a equipe" : ""}`
          : "Não agendado",
      ],
      ...(internal
        ? [
            ["Nível registrado (1 a 5)", String(record.level)],
            ["Autor do registro", value(author)],
            ...(plan?.context
              ? [["Contexto de observação", plan.context]]
              : []),
            ...(plan?.baseline ? [["Situação inicial", plan.baseline]] : []),
          ]
        : []),
    ]);
  }
  if (!records.length)
    fields("Aprendizagem e acompanhamento pedagógico", [
      [
        "Registros individuais",
        "Ainda não há observações individuais de aprendizagem registradas. A ausência de registros não permite concluir sobre dificuldades ou evolução.",
      ],
    ]);
  sections.push({
    title: internal
      ? "Ocorrências individuais e contexto da turma"
      : "Situações individuais acompanhadas em aula",
    headers: ["Data", "Contexto", "Registro"],
    rows: occurrences.length
      ? occurrences.map((o) => [
          displayDate(lessonMap.get(o.lesson_id)!.date),
          o.student_id ? "Aluno" : "Turma — contexto coletivo",
          internal
            ? `${occurrenceText(o)}${o.author_name ? ` · ${o.author_name}` : ""}`
            : occurrenceText({ codes: o.codes, notes: "" }) ||
              "Situação individual registrada; consulte a equipe para contextualização.",
        ])
      : [["—", "—", "Nenhuma ocorrência registrada nesta categoria."]],
  });
  if (internal) {
    sections.push({
      title: "Contatos e encaminhamentos da equipe",
      headers: ["Data", "Motivo", "Resultado / retorno"],
      rows: contacts.length
        ? contacts.map((c) => [
            displayDate(c.date),
            value(c.reason),
            `${value(c.outcome)}${c.next_contact ? `\nRetorno: ${displayDate(c.next_contact)}` : ""}`,
          ])
        : [["—", "—", "Nenhum contato registrado."]],
    });
    const missing = [
      [student.name, "nome"],
      [student.birth_date, "nascimento"],
      [student.phone, "telefone do aluno"],
      [student.guardian, "responsável"],
      [student.guardian_phone, "telefone do responsável"],
      [student.course_start_date, "início do curso"],
    ]
      .filter(([v]) => !v)
      .map(([, name]) => name);
    fields("Pendências administrativas e desligamento", [
      [
        "Dados a complementar",
        missing.length ? missing.join(", ") : "Dados básicos preenchidos",
      ],
      [
        "Motivo de desligamento",
        value(student.archive_reason || student.record_archive_reason),
      ],
      ...(student.offboarding
        ? [
            [
              "Checklist de desligamento",
              student.offboarding.steps
                ?.map(
                  (step) =>
                    `${step.completed ? "Concluído" : "Pendente"}: ${step.label || step.id}`,
                )
                .join("\n") || "Sem etapas registradas",
            ],
            [
              "Conclusão do desligamento",
              date(student.offboarding.completed_at?.slice(0, 10)),
            ],
            [
              "Responsável pelo desligamento",
              value(student.offboarding.completed_by_name),
            ],
          ]
        : []),
    ]);
  } else {
    fields("Como a família pode acompanhar", [
      [
        "Rotina de estudo",
        "Converse sobre os conteúdos das aulas e combine uma rotina de estudo compatível com a realidade do aluno.",
      ],
      [
        "Frequência",
        "Acompanhe os dias e horários de aula e comunique à secretaria quando houver necessidade de ausência.",
      ],
      [
        "Parceria com a escola",
        "Converse com a equipe sobre os próximos passos registrados e compartilhe informações que ajudem o acompanhamento do aluno.",
      ],
    ]);
  }
  const slug = studentDisplayName(student)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 100);
  return {
    audience,
    title: internal
      ? "Ficha interna do aluno"
      : "Acompanhamento do aluno — Família",
    name: studentDisplayName(student),
    unit: value(unit?.name),
    date: reference,
    filename: `${slug}-${internal ? "ficha-interna" : "acompanhamento-familia"}-${reference}.pdf`,
    metrics: [
      { label: "Frequência", value: frequency },
      {
        label: "Horas realizadas",
        value: `${formatHours(progress.completedHours)} h`,
      },
      {
        label: "Progresso do curso",
        value:
          progress.percent === null ? "Não calculado" : `${progress.percent}%`,
      },
      { label: "Faltas registradas", value: String(count("falta")) },
    ],
    sections,
    notice: internal
      ? "Uso interno da equipe autorizada. Histórico baseado nos registros disponíveis até a emissão."
      : "Documento de acompanhamento para a família. Registros pedagógicos descrevem observações educacionais e não constituem diagnóstico clínico.",
  };
}
