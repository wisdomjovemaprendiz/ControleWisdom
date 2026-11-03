import type { Store } from "./domain";
import { today } from "./domain";
export function demoStore(): Store {
  const d = today();
  return {
    offerings: [
      {
        id: "o1",
        unit_id: "u1",
        name: "Jovem Aprendiz • Formação completa",
        kind: "pacote",
        duration_months: 18,
        courses:
          "Informática profissional, Assistente administrativo, Comunicação e empregabilidade",
      },
      {
        id: "o2",
        unit_id: "u1",
        name: "Informática profissional",
        kind: "individual",
        duration_months: 6,
        courses: "Informática profissional",
      },
      {
        id: "o3",
        unit_id: "u2",
        name: "Primeiro emprego",
        kind: "pacote",
        duration_months: 12,
        courses:
          "Informática, Atendimento ao cliente, Preparação para entrevistas",
      },
    ],
    units: [
      {
        id: "u1",
        name: "Unidade Centro",
        address: "Av. Principal, 120 • Centro",
      },
      {
        id: "u2",
        name: "Unidade Vila Nova",
        address: "Rua das Flores, 85 • Vila Nova",
      },
    ],
    profiles: [
      { id: "p1", name: "Marina Costa", role: "coordenacao", unit_id: "u1" },
      { id: "p2", name: "Ana Oliveira", role: "professor", unit_id: "u1" },
      { id: "p3", name: "Lucas Santos", role: "secretaria", unit_id: "u1" },
      { id: "p4", name: "Pedro Lima", role: "professor", unit_id: "u2" },
    ],
    classes: [
      {
        id: "c1",
        unit_id: "u1",
        name: "Informática • Turma 01",
        course: "Informática profissional",
        teacher_id: "p2",
        teacher: "Ana Oliveira",
        schedule: "Seg e Qua • 14h às 16h",
        capacity: 25,
        whatsapp: "",
      },
      {
        id: "c2",
        unit_id: "u1",
        name: "Inglês • Turma 02",
        course: "Inglês essencial",
        teacher_id: "p2",
        teacher: "Ana Oliveira",
        schedule: "Ter e Qui • 09h às 11h",
        capacity: 20,
        whatsapp: "",
      },
      {
        id: "c3",
        unit_id: "u1",
        name: "Administração • Turma 03",
        course: "Assistente administrativo",
        teacher_id: "p2",
        teacher: "Ana Oliveira",
        schedule: "Sexta • 14h às 17h",
        capacity: 25,
        whatsapp: "",
      },
      {
        id: "c4",
        unit_id: "u2",
        name: "Informática • Turma 04",
        course: "Informática profissional",
        teacher_id: "p4",
        teacher: "Pedro Lima",
        schedule: "Seg e Qua • 09h às 11h",
        capacity: 20,
        whatsapp: "",
      },
    ],
    students: [
      "Gabriel Almeida",
      "Isabela Santos",
      "Lucas Ferreira",
      "Maria Eduarda Lima",
      "Pedro Henrique",
      "Sofia Rodrigues",
      "Arthur Oliveira",
      "Helena Costa",
      "Miguel Souza",
      "Alice Martins",
      "Davi Pereira",
      "Laura Nascimento",
      "Rafael Gomes",
      "Valentina Ribeiro",
      "João Vitor",
      "Beatriz Carvalho",
    ].map((name, i) => ({
      id: `s${i + 1}`,
      unit_id: i > 12 ? "u2" : "u1",
      class_id: i > 12 ? "c4" : i < 7 ? "c1" : i < 11 ? "c2" : "c3",
      offering_id: i > 12 ? "o3" : i % 2 ? "o1" : "o2",
      name,
      birth_date:
        i === 0
          ? "2009-" + d.slice(5)
          : i === 1
            ? "2009-" +
              new Date(new Date(d + "T12:00:00Z").getTime() + 2 * 86400000)
                .toISOString()
                .slice(5, 10)
            : "2009-05-14",
      phone: "",
      guardian: ["Patrícia Almeida", "Fernanda Santos", "Roberto Ferreira"][
        i % 3
      ],
      guardian_phone: "",
      email: "",
      address: "",
      created_by: "p3",
      enrollment_date: `2026-${String(6 + (i % 6)).padStart(2, "0")}-05`,
      status: i === 11 ? "abandono" : i === 12 ? "conclusao" : "ativo",
      archive_reason:
        i === 11 ? "Mudança de cidade" : i === 12 ? "Curso concluído" : "",
    })),
    lessons: [
      {
        id: "l1",
        unit_id: "u1",
        class_id: "c1",
        teacher_id: "p2",
        teacher: "Ana Oliveira",
        date: d,
        topic: "Planilhas: fórmulas e organização de dados",
        closed: true,
      },
      {
        id: "l2",
        unit_id: "u1",
        class_id: "c1",
        teacher_id: "p2",
        teacher: "Ana Oliveira",
        date: "2026-10-26",
        topic: "Introdução às planilhas",
        closed: true,
      },
      {
        id: "l3",
        unit_id: "u1",
        class_id: "c1",
        teacher_id: "p2",
        teacher: "Ana Oliveira",
        date: "2026-10-28",
        topic: "Formatação de células",
        closed: true,
      },
    ],
    attendance: [
      ...Array.from({ length: 7 }, (_, i) => ({
        id: `a${i}`,
        unit_id: "u1",
        lesson_id: "l1",
        student_id: `s${i + 1}`,
        status: (i === 2 ? "falta" : i === 4 ? "atrasado" : "presente") as
          "falta" | "atrasado" | "presente",
      })),
      {
        id: "a8",
        unit_id: "u1",
        lesson_id: "l2",
        student_id: "s3",
        status: "falta",
      },
      {
        id: "a9",
        unit_id: "u1",
        lesson_id: "l3",
        student_id: "s3",
        status: "falta",
      },
    ],
    pedagogy: [
      {
        id: "e1",
        unit_id: "u1",
        class_id: "c1",
        student_id: "s1",
        author_id: "p2",
        date: d,
        kind: "Evolução",
        skill: "Raciocínio lógico",
        level: 4,
        notes:
          "Resolve fórmulas com autonomia e ajuda os colegas nas atividades em grupo.",
        intervention: "Propor desafios com funções condicionais.",
        follow_up: "",
      },
      {
        id: "e2",
        unit_id: "u1",
        class_id: "c1",
        student_id: "s3",
        author_id: "p2",
        date: d,
        kind: "Intervenção",
        skill: "Participação e continuidade",
        level: 2,
        notes: "As faltas estão comprometendo a sequência de aprendizagem.",
        intervention:
          "Contato com responsável e plano de recuperação das atividades.",
        follow_up: d,
      },
    ],
    contacts: [],
  };
}
