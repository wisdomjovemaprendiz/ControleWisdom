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
  } finally {
    globalThis.fetch = original;
  }
});
