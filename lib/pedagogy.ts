import { canTeachIndividual } from "./individual";
import type { Pedagogy, Profile, Store, SupportPlan } from "./domain";
import { canAccess, today } from "./domain";
export const CATALOGUE_VERSION = "wisdom-pedagogy-2026.11-v1";
export const pedagogySources = [
  {
    id: "cast",
    title: "CAST — Universal Design for Learning Guidelines 3.0 (2024)",
    url: "https://udlguidelines.cast.org/",
    scope:
      "Acessibilidade, participação, organização, metas e monitoramento. Diretrizes de desenho do ensino, sem classificação clínica.",
  },
  {
    id: "wwc",
    title:
      "IES / What Works Clearinghouse — Organizing Instruction and Study to Improve Student Learning (2007)",
    url: "https://ies.ed.gov/ncee/wwc/PracticeGuide/1",
    scope:
      "Exemplos resolvidos, prática distribuída, recuperação de conhecimentos, representações e perguntas explicativas. Evidência varia entre recomendações.",
  },
  {
    id: "casel",
    title: "CASEL — Framework for Social and Emotional Learning",
    url: "https://casel.org/fundamentals-of-sel/what-is-the-casel-framework/",
    scope:
      "Autoconhecimento, autorregulação, relações e decisões responsáveis, em contextos educativos.",
  },
] as const;
export const pedagogicalDomains = [
  "Atenção e início da tarefa",
  "Organização e autonomia",
  "Leitura e compreensão",
  "Escrita e registro",
  "Raciocínio matemático",
  "Memória e revisão",
  "Comunicação oral",
  "Participação e colaboração",
  "Autorregulação emocional",
  "Prática digital e profissional",
] as const;
export interface ObservationOption {
  id: string;
  domain: string;
  label: string;
  related: string[];
  strategyIds: string[];
}
export interface StrategyOption {
  id: string;
  title: string;
  steps: string;
  measure: string;
  rationale: string;
  sources: string[];
}
export const observationOptions: ObservationOption[] = [
  {
    id: "attention_start",
    domain: pedagogicalDomains[0],
    label: "Demora a iniciar após a orientação coletiva",
    related: ["steps_lost", "task_planning"],
    strategyIds: ["chunk_steps", "start_check"],
  },
  {
    id: "attention_return",
    domain: pedagogicalDomains[0],
    label: "Necessita de lembretes para retomar a atividade",
    related: ["task_planning", "memory_recall"],
    strategyIds: ["chunk_steps", "self_check"],
  },
  {
    id: "task_planning",
    domain: pedagogicalDomains[1],
    label: "Tem dificuldade para planejar a sequência da tarefa",
    related: ["steps_lost", "writing_structure"],
    strategyIds: ["plan_checklist", "worked_example"],
  },
  {
    id: "steps_lost",
    domain: pedagogicalDomains[1],
    label: "Perde etapas de instruções com várias ações",
    related: ["reading_instructions", "memory_recall"],
    strategyIds: ["chunk_steps", "visual_verbal"],
  },
  {
    id: "reading_instructions",
    domain: pedagogicalDomains[2],
    label: "Precisa de apoio para compreender os enunciados",
    related: ["reading_vocab", "oral_explain"],
    strategyIds: ["read_restate", "vocabulary"],
  },
  {
    id: "reading_vocab",
    domain: pedagogicalDomains[2],
    label: "Vocabulário do conteúdo dificulta a compreensão",
    related: ["reading_instructions", "writing_clarity"],
    strategyIds: ["vocabulary", "visual_verbal"],
  },
  {
    id: "writing_structure",
    domain: pedagogicalDomains[3],
    label: "Precisa de apoio para organizar ideias por escrito",
    related: ["task_planning", "oral_explain"],
    strategyIds: ["writing_scaffold", "plan_checklist"],
  },
  {
    id: "writing_clarity",
    domain: pedagogicalDomains[3],
    label: "O registro escrito ainda não comunica a ideia com clareza",
    related: ["reading_vocab", "oral_explain"],
    strategyIds: ["writing_scaffold", "specific_feedback"],
  },
  {
    id: "math_concrete",
    domain: pedagogicalDomains[4],
    label: "Precisa relacionar cálculos a situações concretas",
    related: ["math_steps", "reading_instructions"],
    strategyIds: ["concrete_math", "worked_example"],
  },
  {
    id: "math_steps",
    domain: pedagogicalDomains[4],
    label: "Encontra dificuldade para explicar os passos de uma resolução",
    related: ["task_planning", "oral_explain"],
    strategyIds: ["worked_example", "explain_reasoning"],
  },
  {
    id: "memory_recall",
    domain: pedagogicalDomains[5],
    label: "Tem dificuldade para recuperar conteúdo estudado anteriormente",
    related: ["memory_review", "attention_return"],
    strategyIds: ["retrieval", "spaced_review"],
  },
  {
    id: "memory_review",
    domain: pedagogicalDomains[5],
    label: "Ainda não utiliza uma rotina de revisão",
    related: ["task_planning", "memory_recall"],
    strategyIds: ["spaced_review", "self_check"],
  },
  {
    id: "oral_explain",
    domain: pedagogicalDomains[6],
    label: "Precisa de apoio para explicar ideias oralmente",
    related: ["writing_structure", "participation_speaking"],
    strategyIds: ["rehearse_pair", "explain_reasoning"],
  },
  {
    id: "oral_listen",
    domain: pedagogicalDomains[6],
    label: "Precisa praticar a escuta e a alternância de turnos",
    related: ["team_roles", "emotion_pause"],
    strategyIds: ["dialogue_roles", "restorative_check"],
  },
  {
    id: "participation_speaking",
    domain: pedagogicalDomains[7],
    label: "Participa pouco de apresentações e discussões coletivas",
    related: ["oral_explain", "emotion_error"],
    strategyIds: ["rehearse_pair", "participation_choice"],
  },
  {
    id: "team_roles",
    domain: pedagogicalDomains[7],
    label: "Precisa de apoio para assumir e concluir uma função no grupo",
    related: ["task_planning", "oral_listen"],
    strategyIds: ["dialogue_roles", "plan_checklist"],
  },
  {
    id: "emotion_error",
    domain: pedagogicalDomains[8],
    label: "Diante de erros, interrompe ou evita novas tentativas",
    related: ["emotion_pause", "participation_speaking"],
    strategyIds: ["specific_feedback", "emotion_routine"],
  },
  {
    id: "emotion_pause",
    domain: pedagogicalDomains[8],
    label: "Precisa de apoio para retomar a tarefa após frustração",
    related: ["emotion_error", "oral_listen"],
    strategyIds: ["emotion_routine", "restorative_check"],
  },
  {
    id: "digital_sequence",
    domain: pedagogicalDomains[9],
    label: "Precisa de apoio na sequência de uma tarefa digital",
    related: ["steps_lost", "task_planning"],
    strategyIds: ["digital_model", "chunk_steps"],
  },
  {
    id: "professional_transfer",
    domain: pedagogicalDomains[9],
    label: "Precisa relacionar o conteúdo a situações do trabalho",
    related: ["math_concrete", "oral_explain"],
    strategyIds: ["work_scenario", "explain_reasoning"],
  },
];
export const strategyOptions: StrategyOption[] = [
  {
    id: "chunk_steps",
    title: "Dividir a tarefa em etapas observáveis",
    steps:
      "Apresentar uma etapa por vez, confirmar a compreensão e reduzir os lembretes conforme a autonomia observada.",
    measure:
      "Registrar etapas concluídas e quantidade de lembretes na mesma atividade.",
    rationale:
      "Reduzir barreiras de organização e graduar o apoio pode facilitar a participação; ajustar ao contexto do aluno.",
    sources: ["cast"],
  },
  {
    id: "start_check",
    title: "Combinar um início de tarefa claro",
    steps:
      "Explicitar o objetivo, mostrar o primeiro passo e pedir ao aluno que diga como começará; combinar uma checagem breve.",
    measure:
      "Comparar o tempo para iniciar e os apoios necessários em tarefas equivalentes.",
    rationale: "Metas claras e antecipação de desafios apoiam o planejamento.",
    sources: ["cast"],
  },
  {
    id: "self_check",
    title: "Usar autoavaliação com critérios simples",
    steps:
      "Combinar dois ou três critérios com o aluno; ao final, comparar a autoavaliação com um exemplo de trabalho.",
    measure:
      "Guardar a tarefa e registrar quais critérios foram atendidos com e sem ajuda.",
    rationale:
      "Monitorar o próprio progresso orienta a escolha de apoios e revisão.",
    sources: ["cast", "wwc"],
  },
  {
    id: "plan_checklist",
    title: "Planejar com uma lista curta de ações",
    steps:
      "Construir uma lista de preparação, execução e revisão; marcar as ações realizadas e discutir uma dificuldade específica.",
    measure:
      "Contar ações concluídas de forma independente e revisar a lista junto ao aluno.",
    rationale:
      "Organizar informação e recursos favorece o desenvolvimento de estratégias.",
    sources: ["cast"],
  },
  {
    id: "worked_example",
    title: "Alternar exemplo resolvido e tentativa própria",
    steps:
      "Modelar o raciocínio em um exemplo, pedir uma tentativa semelhante e oferecer outro exemplo quando necessário.",
    measure:
      "Comparar resoluções e tipos de erro em exercícios de dificuldade equivalente.",
    rationale:
      "Alternar exemplos resolvidos e problemas é uma recomendação específica do guia WWC.",
    sources: ["wwc"],
  },
  {
    id: "visual_verbal",
    title: "Combinar orientação verbal e apoio visual",
    steps:
      "Usar um esquema simples junto à explicação; solicitar ao aluno que relacione imagem e instrução, sem acrescentar estímulos irrelevantes.",
    measure:
      "Registrar se consegue reconstruir a sequência ou explicar o conceito com os apoios.",
    rationale:
      "Combinação coerente de representações e linguagem pode ampliar o acesso ao conteúdo.",
    sources: ["cast", "wwc"],
  },
  {
    id: "read_restate",
    title: "Ler, reformular e conferir o enunciado",
    steps:
      "Destacar o objetivo e os dados relevantes; pedir uma reformulação com as próprias palavras antes de iniciar.",
    measure:
      "Comparar compreensão dos enunciados com e sem reformulação em itens equivalentes.",
    rationale:
      "Clarificação de linguagem e perguntas explicativas apoiam a compreensão.",
    sources: ["cast", "wwc"],
  },
  {
    id: "vocabulary",
    title: "Trabalhar vocabulário do conteúdo em contexto",
    steps:
      "Selecionar poucos termos essenciais, apresentar significado e exemplo e pedir aplicação em outra situação.",
    measure:
      "Anotar termos compreendidos e usados adequadamente em exemplos novos.",
    rationale:
      "Clarificar vocabulário e conectar representações reduz barreiras linguísticas.",
    sources: ["cast"],
  },
  {
    id: "writing_scaffold",
    title: "Apoiar o planejamento e a revisão da escrita",
    steps:
      "Oferecer organizador com ideia principal, exemplos e conclusão; retirar partes do apoio de acordo com a autonomia.",
    measure:
      "Usar a mesma rubrica curta em dois textos: organização, clareza e revisão.",
    rationale:
      "Ferramentas de composição e prática com apoio graduado favorecem expressão.",
    sources: ["cast"],
  },
  {
    id: "specific_feedback",
    title: "Dar devolutiva específica e oportunidade de revisão",
    steps:
      "Apontar um aspecto já alcançado e um próximo passo verificável; permitir que o aluno revise a produção.",
    measure:
      "Comparar versões da tarefa e registrar se a orientação foi aplicada.",
    rationale:
      "Feedback orientado à ação oferece um caminho para melhorar a produção.",
    sources: ["cast"],
  },
  {
    id: "concrete_math",
    title: "Relacionar representações concretas e abstratas",
    steps:
      "Usar uma situação de orçamento, tempo ou medida; conectar o exemplo à representação numérica e ao procedimento.",
    measure:
      "Pedir a solução de uma situação semelhante e a explicação da relação entre representações.",
    rationale:
      "Conectar representações concretas e abstratas é recomendado pelo WWC.",
    sources: ["wwc"],
  },
  {
    id: "explain_reasoning",
    title: "Solicitar explicações sobre o raciocínio",
    steps:
      "Perguntar como chegou à resposta, por que um passo foi escolhido e em que outra situação ele poderia ser usado.",
    measure:
      "Registrar explicações e comparar a justificativa em uma segunda tarefa.",
    rationale:
      "Perguntas explicativas aprofundadas são uma recomendação do guia de estudo e instrução.",
    sources: ["wwc"],
  },
  {
    id: "retrieval",
    title: "Recuperar conhecimentos com baixo risco",
    steps:
      "Propor perguntas curtas sem consulta, oferecer correção explicativa e retomar os pontos que precisam de estudo.",
    measure:
      "Comparar respostas em pequenos conjuntos equivalentes, sem usar a atividade como exposição pública.",
    rationale:
      "Recuperação por perguntas e quizzes é recomendada para reexposição ao conteúdo.",
    sources: ["wwc"],
  },
  {
    id: "spaced_review",
    title: "Distribuir pequenas revisões ao longo do tempo",
    steps:
      "Retomar conceitos em aulas posteriores e alternar revisão com aplicações, em vez de concentrar tudo em uma única sessão.",
    measure:
      "Registrar recuperação dos mesmos conceitos em momentos posteriores.",
    rationale:
      "Espaçar o estudo é uma recomendação do WWC; intervalos precisam ser adaptados ao curso.",
    sources: ["wwc"],
  },
  {
    id: "rehearse_pair",
    title: "Ensaiar a comunicação em dupla",
    steps:
      "Permitir preparação individual e ensaio com um colega antes da apresentação; combinar um objetivo de comunicação.",
    measure:
      "Comparar participação e clareza usando critérios combinados e a percepção do próprio aluno.",
    rationale:
      "Opções de participação e desenvolvimento das relações podem apoiar o engajamento.",
    sources: ["cast", "casel"],
  },
  {
    id: "participation_choice",
    title: "Oferecer formas graduais de participação",
    steps:
      "Combinar contribuição por escrito, em dupla ou oralmente; ampliar o desafio com consentimento e apoio.",
    measure:
      "Registrar oportunidades e participações, distinguindo barreira de acesso e recusa.",
    rationale:
      "Múltiplas formas de expressão e pertencimento são princípios do UDL.",
    sources: ["cast"],
  },
  {
    id: "dialogue_roles",
    title: "Combinar papéis e turnos em uma tarefa coletiva",
    steps:
      "Distribuir funções claras, modelar escuta e estabelecer turnos; revisar ao final como o grupo colaborou.",
    measure:
      "Observar cumprimento do papel, escuta e pedidos de ajuda em situações definidas.",
    rationale:
      "Competências relacionais e colaboração podem ser ensinadas de forma explícita.",
    sources: ["cast", "casel"],
  },
  {
    id: "emotion_routine",
    title: "Combinar uma rotina breve para retomar a atividade",
    steps:
      "Conversar em momento tranquilo sobre sinais de dificuldade, combinar pausa e retorno e oferecer apoio sem exposição.",
    measure:
      "Registrar contexto, estratégia escolhida pelo aluno e condições de retomada.",
    rationale:
      "Autoconhecimento e autorregulação são competências educativas do framework CASEL.",
    sources: ["casel", "cast"],
  },
  {
    id: "restorative_check",
    title: "Fazer escuta individual e combinar reparação",
    steps:
      "Ouvir as versões sem rotular o aluno, identificar o impacto da situação e combinar uma ação de cuidado ou reparação.",
    measure:
      "Registrar acordos, sua realização e a percepção do aluno sobre o apoio.",
    rationale:
      "Empatia, relações e práticas restaurativas são consideradas no UDL e CASEL.",
    sources: ["cast", "casel"],
  },
  {
    id: "digital_model",
    title: "Modelar a tarefa digital e praticar com apoio reduzido",
    steps:
      "Demonstrar o procedimento em um arquivo de exercício, oferecer roteiro visual e permitir repetição independente.",
    measure:
      "Registrar passos executados com autonomia e tipos de ajuda solicitados.",
    rationale:
      "Modelagem, organização de recursos e apoio graduado são adaptações instrucionais.",
    sources: ["cast", "wwc"],
  },
  {
    id: "work_scenario",
    title: "Aplicar o conteúdo a um cenário de jovem aprendiz",
    steps:
      "Propor situação simulada de agenda, atendimento ou organização; explicitar como o conteúdo ajuda a resolver a tarefa.",
    measure:
      "Usar uma rubrica de aplicação, justificativa e autonomia em uma segunda situação.",
    rationale:
      "Relevância, transferência e explicação do raciocínio orientam a adaptação ao contexto profissional.",
    sources: ["cast", "wwc"],
  },
];
export const scoreLabels = [
  "Não observado",
  "Ocasional",
  "Frequente",
  "Muito frequente",
];
export const outcomeLabels: Record<string, string> = {
  not_assessed: "Ainda não foi possível avaliar",
  progress: "Avanço parcial",
  achieved: "Objetivo alcançado",
  unchanged: "Sem mudança observável",
  review: "É necessário rever o plano",
};
export function suggestPedagogy(scores: Record<string, number>, query = "") {
  const selected = observationOptions.filter((o) => (scores[o.id] || 0) > 0);
  const normalized = query
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  const keywordDomains: [RegExp, string][] = [
    [/distra|atenc|foco|iniciar/, pedagogicalDomains[0]],
    [/organiz|etapas|planej|autonom/, pedagogicalDomains[1]],
    [/leitur|enunciad|compreen|vocab/, pedagogicalDomains[2]],
    [/escrit|escrev|texto/, pedagogicalDomains[3]],
    [/matemat|calcul|numer|raciocin/, pedagogicalDomains[4]],
    [/memoria|lembr|esquec|revis/, pedagogicalDomains[5]],
    [/comunic|oral|fala|explic/, pedagogicalDomains[6]],
    [/particip|grupo|colabor/, pedagogicalDomains[7]],
    [/frustr|emoc|erro|irrit/, pedagogicalDomains[8]],
    [/digital|comput|trabalh/, pedagogicalDomains[9]],
  ];
  const matchedDomains = keywordDomains
    .filter(([pattern]) => pattern.test(normalized))
    .map(([, domain]) => domain);
  const hints = observationOptions.filter(
    (o) =>
      !selected.includes(o) &&
      (matchedDomains.includes(o.domain) ||
        selected.some((s) => s.related.includes(o.id)) ||
        (normalized.length > 3 &&
          o.label
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase()
            .split(/\W+/)
            .some((word) => word.length > 4 && normalized.includes(word)))),
  );
  const weights = new Map<string, number>();
  for (const o of selected)
    for (const id of o.strategyIds)
      weights.set(id, (weights.get(id) || 0) + (scores[o.id] || 0));
  return {
    observations: hints.slice(0, 8),
    strategies: strategyOptions
      .filter((s) => weights.has(s.id))
      .sort((a, b) => weights.get(b.id)! - weights.get(a.id)!),
    selected,
  };
}
export function pedagogyDraft(plan: SupportPlan) {
  const options = observationOptions.filter(
      (o) => (plan.observation_scores[o.id] || 0) > 0,
    ),
    strategies = strategyOptions.filter((s) =>
      plan.strategy_ids.includes(s.id),
    );
  const notes = [
    plan.context && `Contexto observado: ${plan.context}`,
    plan.baseline && `Situação inicial / evidência: ${plan.baseline}`,
    ...options.map(
      (o) =>
        `${o.label}: ${scoreLabels[plan.observation_scores[o.id]]} (${plan.observation_scores[o.id]}/3).`,
    ),
    plan.outcome &&
      `Avaliação do acompanhamento: ${outcomeLabels[plan.outcome] || plan.outcome}.`,
    plan.evidence && `Evidência registrada pelo professor: ${plan.evidence}`,
  ]
    .filter(Boolean)
    .join("\n");
  const intervention = [
    ...strategies.map(
      (s) => `${s.title}: ${s.steps}\nComo acompanhar: ${s.measure}`,
    ),
    plan.goal && `Objetivo combinado: ${plan.goal}`,
    plan.criteria && `Critério de acompanhamento: ${plan.criteria}`,
  ]
    .filter(Boolean)
    .join("\n\n");
  return {
    skill: [...new Set(options.map((o) => o.domain))].join("; "),
    notes,
    intervention,
    sources: [...new Set(strategies.flatMap((s) => s.sources))],
  };
}
export function pendingPedagogy(
  store: Store,
  profile: Profile,
  unit = "all",
  asOf = today(),
) {
  if (profile.role === "comercial") return [];
  const completed = new Set(
    store.pedagogy
      .filter((p) => !p.archived_at && p.parent_record_id)
      .map((p) => p.parent_record_id),
  );
  return store.pedagogy
    .filter(
      (p) =>
        !p.archived_at &&
        p.follow_up &&
        !completed.has(p.id) &&
        canAccess(profile, p.unit_id) &&
        (unit === "all" || unit === p.unit_id) &&
        (profile.role !== "professor" ||
          store.classes.some(
            (c) => c.id === p.class_id && c.teacher_id === profile.id,
          ) ||
          store.students.some(
            (s) => s.id === p.student_id && canTeachIndividual(profile, s),
          )),
    )
    .map((p) => ({
      record: p,
      state:
        p.follow_up < asOf
          ? "overdue"
          : p.follow_up === asOf
            ? "today"
            : "upcoming",
    }))
    .sort((a, b) => a.record.follow_up.localeCompare(b.record.follow_up));
}
export function pedagogicalReportLines(p: Pedagogy) {
  const plan = p.support_plan;
  return [
    `${p.date} — ${p.kind}: ${p.skill}`,
    `Observações: ${p.notes}`,
    `Intervenção: ${p.intervention || "Não informada"}`,
    p.follow_up && `Acompanhar em: ${p.follow_up}`,
    p.parent_record_id && "Evolução vinculada a uma intervenção anterior",
    plan?.goal && `Objetivo: ${plan.goal}`,
    plan?.criteria && `Critério: ${plan.criteria}`,
    plan?.outcome &&
      `Resultado informado: ${outcomeLabels[plan.outcome] || plan.outcome}`,
    plan?.evidence && `Evidência: ${plan.evidence}`,
    plan?.sources?.length &&
      `Referências do plano: ${pedagogySources
        .filter((s) => plan.sources.includes(s.id))
        .map((s) => s.title)
        .join("; ")}`,
  ].filter(Boolean) as string[];
}
