import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { Table } from "jspdf-autotable";
import { createInstitutionalPdf } from "../lib/pdf";
test("relatório institucional inclui imagem da marca, tabelas e paginação de todos os registros", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async (input) =>
    new Response(
      readFileSync(new URL("../public" + String(input), import.meta.url)),
    );
  try {
    const doc = await createInstitutionalPdf({
      title: "Frequência e faltas",
      unit: "Unidade Centro",
      author: "Equipe de teste",
      lines: [
        "Período: 01/01/2026 a 03/11/2026",
        ...Array.from(
          { length: 100 },
          (_, i) =>
            `Aluno ${String(i).padStart(3, "0")} | Turma A | Presenças: 8 | Faltas: 1 | Atrasos: 1 | Justificadas: 0`,
        ),
      ],
    });
    assert.ok(doc.getNumberOfPages() > 1);
    const raw = doc.output();
    assert.match(raw, /\/Subtype \/Image/);
    assert.match(raw, /\/FontFile2/);
    const table = (doc as typeof doc & { lastAutoTable: Table }).lastAutoTable;
    assert.equal(table.body.length, 100);
    assert.equal((table.body[99].raw as string[])[0], "Aluno 099");
    assert.ok(table.pageNumber > 1);
    const portrait = new Uint8Array(
      readFileSync(new URL("../public/wisdom-logo.jpg", import.meta.url)),
    );
    const photographed = await createInstitutionalPdf({
      title: "Resumo da aula",
      unit: "Unidade Centro",
      author: "Equipe de teste",
      lines: ["Aluno com foto | Presente", "Aluno sem foto | Atrasado"],
      photos: [{ id: "s1", name: "Aluno com foto", data: portrait }],
    });
    const picturedTable = (
      photographed as typeof photographed & { lastAutoTable: Table }
    ).lastAutoTable;
    assert.equal(picturedTable.body[0].cells[0].styles.minCellHeight, 11);
    assert.notEqual(picturedTable.body[1].cells[0].styles.minCellHeight, 11);
    assert.ok(
      (photographed.output().match(/\/Subtype \/Image/g) || []).length >= 2,
    );
    const custom = await createInstitutionalPdf({
      title: "Relatório personalizado",
      unit: "Centro",
      author: "Equipe",
      lines: [],
      table: {
        headers: ["Telefone do responsável"],
        rows: [["0011999999999"], ["Texto | com: símbolos"]],
      },
    });
    const customTable = (custom as typeof custom & { lastAutoTable: Table })
      .lastAutoTable;
    assert.deepEqual(customTable.head[0].raw, ["Telefone do responsável"]);
    assert.deepEqual(
      customTable.body.map((r) => r.raw),
      [["0011999999999"], ["Texto | com: símbolos"]],
    );
  } finally {
    globalThis.fetch = original;
  }
});
