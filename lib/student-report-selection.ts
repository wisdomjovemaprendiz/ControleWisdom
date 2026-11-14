import type { StudentReport, StudentReportSection } from "./student-report";

export const studentReportBlocks = [
  ["summary", "Indicadores de frequência e progresso"],
  ["identification", "Identificação e contatos"],
  ["enrollment", "Matrícula e organização das aulas"],
  ["progress", "Percurso e carga horária"],
  ["frequency", "Resumo de frequência e frequência por mês"],
  ["attendance", "Histórico de aulas, faltas e justificativas"],
  ["pedagogy", "Aprendizagem, intervenções e evolução"],
  ["occurrences", "Ocorrências registradas"],
  ["contacts", "Contatos e encaminhamentos da equipe"],
  ["administration", "Pendências administrativas e desligamento"],
  ["guidance", "Orientações para a família"],
] as const;
export type StudentReportBlock = (typeof studentReportBlocks)[number][0];
const sectionBlocks: Record<string, StudentReportBlock> = {
  "Identificação e contatos": "identification",
  "Aluno e responsáveis": "identification",
  "Matrícula e organização das aulas": "enrollment",
  "Percurso e carga horária": "progress",
  "Resumo de frequência": "frequency",
  "Frequência por mês": "frequency",
  "Histórico de aulas e presença": "attendance",
  "Faltas, atrasos e justificativas": "attendance",
  "Ocorrências individuais e contexto da turma": "occurrences",
  "Situações individuais acompanhadas em aula": "occurrences",
  "Contatos e encaminhamentos da equipe": "contacts",
  "Pendências administrativas e desligamento": "administration",
  "Como a família pode acompanhar": "guidance",
};
export function studentReportSectionBlock(
  section: StudentReportSection,
): StudentReportBlock {
  return sectionBlocks[section.title] || "pedagogy";
}
export function availableStudentReportBlocks(report: StudentReport) {
  const used = new Set<StudentReportBlock>(
    report.sections.map(studentReportSectionBlock),
  );
  if (report.metrics.length) used.add("summary");
  return studentReportBlocks.filter(([id]) => used.has(id));
}
export function selectStudentReportBlocks(
  report: StudentReport,
  selected: readonly StudentReportBlock[],
): StudentReport {
  const included = new Set(selected);
  return {
    ...report,
    metrics: included.has("summary") ? report.metrics : [],
    sections: report.sections.filter((section) =>
      included.has(studentReportSectionBlock(section)),
    ),
  };
}
