import { test, expect } from "@playwright/test";
test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Operação das unidades" }),
  ).toBeVisible();
});
test("matrícula expressa persiste e busca encontra aluno", async ({ page }) => {
  await page
    .getByRole("button", { name: "Nova matrícula", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Nome completo").fill("Teste Matrícula");
  await dialog.getByLabel("Turma *").selectOption("c1");
  await dialog.getByLabel("WhatsApp do responsável").fill("5511999999999");
  await dialog.getByRole("button", { name: "Salvar registro" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page
    .locator("nav")
    .getByRole("button", { name: "Alunos", exact: true })
    .click();
  await page
    .getByPlaceholder("Buscar aluno ou responsável…")
    .fill("Teste Matrícula");
  await expect(
    page.getByRole("cell", { name: /Teste Matrícula/ }).first(),
  ).toBeVisible();
  await page.reload();
  await page
    .locator("nav")
    .getByRole("button", { name: "Alunos", exact: true })
    .click();
  await expect(
    page.getByText("Teste Matrícula", { exact: true }),
  ).toBeVisible();
});
test("chamada exige marcações e prepara resumo completo", async ({ page }) => {
  await page
    .locator("nav")
    .getByRole("button", { name: "Chamada", exact: true })
    .click();
  await page.getByLabel("Data da aula").fill("2026-10-20");
  await page
    .getByLabel("Conteúdo trabalhado")
    .fill("Preparação para entrevista");
  await page
    .getByRole("button", { name: "Finalizar chamada e gerar resumo" })
    .click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Registre a situação" }),
  ).toContainText("Registre a situação");
  await page.getByRole("button", { name: "Todos presentes" }).click();
  await page
    .getByRole("button", { name: "Finalizar chamada e gerar resumo" })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByLabel("Mensagem para WhatsApp")).toHaveValue(
    /Preparação para entrevista/,
  );
  await expect(page.getByLabel("Mensagem para WhatsApp")).toHaveValue(
    /Marina Costa/,
  );
  await expect(
    page.getByRole("link", { name: "Abrir WhatsApp" }),
  ).toHaveAttribute("href", /https:\/\/wa.me\//);
});
test("filtro de unidade e perfil restringem dados na interface", async ({
  page,
}) => {
  await page.getByLabel("Filtrar unidade").selectOption("u2");
  await page
    .locator("nav")
    .getByRole("button", { name: "Alunos", exact: true })
    .click();
  await expect(page.getByText("Gabriel Almeida", { exact: true })).toHaveCount(
    0,
  );
  await expect(
    page.getByText("Valentina Ribeiro", { exact: true }),
  ).toBeVisible();
  await page
    .locator("nav")
    .getByRole("button", { name: "Equipe e acesso", exact: true })
    .click();
  await page.getByRole("button", { name: /Ana Oliveira Professor/ }).click();
  await expect(page.getByLabel("Filtrar unidade")).toBeDisabled();
  await expect(
    page.locator("nav").getByRole("button", { name: "Unidades", exact: true }),
  ).toHaveCount(0);
});
test("gera PDF e registra acompanhamento pedagógico", async ({ page }) => {
  await page
    .locator("nav")
    .getByRole("button", { name: "Pedagógico", exact: true })
    .click();
  await page.getByRole("button", { name: "Novo registro" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Aluno (opcional)").selectOption("s1");
  await dialog.getByLabel("Habilidade observada").fill("Comunicação");
  await dialog
    .getByLabel("Observações e evolução")
    .fill("Apresentou seu currículo com clareza.");
  await dialog.getByRole("button", { name: "Salvar registro" }).click();
  await expect(
    page.getByText("Apresentou seu currículo com clareza."),
  ).toBeVisible();
  await page
    .locator("nav")
    .getByRole("button", { name: "Relatórios", exact: true })
    .click();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Exportar PDF" }).first().click();
  expect((await download).suggestedFilename()).toMatch(/\.pdf$/);
});
test("layout funciona em celular sem rolagem horizontal", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    page.getByRole("heading", { name: "Operação das unidades" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Abrir menu" }).click();
  await page
    .locator("nav")
    .getByRole("button", { name: "Turmas", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Turmas", exact: true }),
  ).toBeVisible();
});

test("quadro filtra chamadas e abre a turma e data corretas", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Sem chamada" }).click();
  await expect(page.locator(".board-table tbody tr")).toHaveCount(3);
  await page
    .getByRole("button", { name: "Todas", exact: false })
    .filter({ hasText: "Todas" })
    .first()
    .click();
  await page.getByLabel("Buscar turma no quadro").fill("Inglês");
  await expect(page.locator(".board-table tbody tr")).toHaveCount(1);
  await expect(page.locator(".journal-heading h3")).toHaveText(
    "Inglês • Turma 02",
  );
  await page
    .getByRole("button", { name: "Fazer chamada", exact: true })
    .click();
  await expect(page.getByLabel("Turma", { exact: true })).toHaveValue("c2");
});
test("ficha reúne cadastro, chamadas, pedagógico e edição do aluno", async ({
  page,
}) => {
  await page
    .locator(".journal-table")
    .getByRole("button", { name: "Gabriel Almeida", exact: true })
    .click();
  const dossier = page.getByRole("dialog", { name: "Gabriel Almeida" });
  await expect(
    dossier.getByText("Patrícia Almeida", { exact: true }),
  ).toBeVisible();
  await dossier.getByRole("tab", { name: "Frequência", exact: true }).click();
  await expect(
    dossier.getByRole("heading", {
      name: "Planilhas: fórmulas e organização de dados",
    }),
  ).toBeVisible();
  await dossier.getByRole("tab", { name: "Pedagógico", exact: true }).click();
  await expect(
    dossier.getByText(/Resolve fórmulas com autonomia/),
  ).toBeVisible();
  await dossier.getByRole("button", { name: "Editar matrícula" }).click();
  await expect(page.getByLabel("Nome completo")).toHaveValue("Gabriel Almeida");
});
test("central separa pendências cadastrais e alertas de faltas", async ({
  page,
}) => {
  await page
    .locator("nav")
    .getByRole("button", { name: /Central de atenção/ })
    .click();
  await page.getByRole("button", { name: /^Cadastro/ }).click();
  await expect(page.locator(".followup-list article").first()).toContainText(
    "Completar matrícula",
  );
  await page.getByRole("button", { name: /^Faltas/ }).click();
  await expect(page.locator(".followup-list article")).toHaveCount(1);
  await expect(page.locator(".followup-list article")).toContainText(
    "Lucas Ferreira",
  );
  await page
    .locator(".followup-list")
    .getByRole("button", { name: "Registrar contato" })
    .click();
  await expect(page.getByRole("dialog")).toContainText("Lucas Ferreira");
});
test("filtros do cadastro combinam situação e turma", async ({ page }) => {
  await page
    .locator("nav")
    .getByRole("button", { name: "Alunos", exact: true })
    .click();
  await page.getByLabel("Filtrar situação da matrícula").selectOption("ativo");
  await page.getByLabel("Filtrar turma dos alunos").selectOption("c1");
  await expect(page.locator(".table-scroll tbody tr")).toHaveCount(7);
  await page
    .getByLabel("Filtrar situação da matrícula")
    .selectOption("conclusao");
  await expect(page.getByText("Nenhum aluno encontrado.")).toBeVisible();
  await page.getByLabel("Filtrar turma dos alunos").selectOption("all");
  await expect(page.locator(".table-scroll tbody tr")).toHaveCount(1);
});

test("ficha fecha por Escape e devolve o foco ao aluno", async ({ page }) => {
  const source = page
    .locator(".journal-table")
    .getByRole("button", { name: "Gabriel Almeida", exact: true });
  await source.click();
  await expect(
    page.getByRole("button", { name: "Fechar ficha" }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(source).toBeFocused();
});
