import { test, expect } from "@playwright/test";
import { installSchoolApi, login } from "../support/supabase";
let schoolApi: Awaited<ReturnType<typeof installSchoolApi>>;
test.beforeEach(async ({ page }) => {
  schoolApi = await installSchoolApi(page);
  await page.goto("/");
  await login(page);
  await page.addLocatorHandler(
    page.getByRole("dialog", { name: "Aniversariantes da aula", exact: true }),
    async (dialog) => {
      await dialog
        .getByRole("button", { name: "Continuar chamada", exact: true })
        .click();
    },
  );
});
test("matrícula expressa persiste e busca encontra aluno", async ({ page }) => {
  await page
    .getByRole("button", { name: "Nova matrícula", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Nome completo").fill("Teste Matrícula");
  await dialog.getByLabel("Turma", { exact: true }).selectOption("c1");
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
  await page.getByTitle("Sair", { exact: true }).click();
  await login(page, "ana.oliveira");
  await expect(page.getByLabel("Filtrar unidade")).toHaveCount(0);
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
  await page.locator(".operational-class-directory > summary").click();
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
    .locator(".class-journal")
    .getByRole("button", { name: "Fazer chamada", exact: true })
    .click();
  await expect(page.getByLabel("Turma", { exact: true })).toHaveValue("c2");
});
test("ficha reúne cadastro, chamadas, pedagógico e edição do aluno", async ({
  page,
}) => {
  await page.locator(".operational-class-directory > summary").click();
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
  await page.locator(".operational-class-directory > summary").click();
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

test("Excel importa nomes e turmas com revisão e mantém cadastro incompleto", async ({
  page,
}) => {
  const { default: writeXlsxFile } = await import("write-excel-file/node");
  const buffer = await writeXlsxFile([
    ["Nome", "Turma", "Data de nascimento"],
    ["Aluno Excel Um", "Informática • Turma 01", "14/05/2009"],
    ["Aluno Excel Dois", "Inglês • Turma 02", ""],
    ["Gabriel Almeida", "Informática • Turma 01", ""],
    ["Sem Turma", "Turma inexistente", ""],
  ]).toBuffer();
  await page
    .locator("nav")
    .getByRole("button", { name: "Alunos", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Importar alunos", exact: true })
    .click();
  const dialog = page.getByRole("dialog", { name: "Importar alunos em massa" });
  await dialog.getByLabel("Unidade da importação").selectOption("u1");
  await dialog.getByLabel("Arquivo Excel de alunos").setInputFiles({
    name: "alunos.xlsx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer,
  });
  await expect(
    dialog.getByRole("button", { name: "Importar 2 alunos", exact: true }),
  ).toBeEnabled();
  await expect(
    dialog.locator(".badge").filter({ hasText: "Duplicado" }),
  ).toHaveCount(1);
  await expect(
    dialog.locator(".badge").filter({ hasText: "Revisar" }),
  ).toHaveCount(1);
  await dialog
    .getByRole("button", { name: "Importar 2 alunos", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  await page
    .getByPlaceholder("Buscar aluno ou responsável…")
    .fill("Aluno Excel");
  await expect(page.locator(".table-scroll tbody tr")).toHaveCount(2);
  await page
    .getByRole("button", { name: "Aluno Excel Um", exact: true })
    .click();
  const dossier = page.getByRole("dialog", { name: "Aluno Excel Um" });
  await expect(dossier.getByText("14/05/2009", { exact: true })).toBeVisible();
  await expect(
    dossier.getByText("Não informado", { exact: true }).first(),
  ).toBeVisible();
});
test("modelo Excel baixado contém cabeçalhos de importação", async ({
  page,
}) => {
  const { readSheet } = await import("read-excel-file/node");
  await page
    .locator("nav")
    .getByRole("button", { name: "Alunos", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Importar alunos", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Unidade da importação").selectOption("u1");
  const pending = page.waitForEvent("download");
  await dialog.getByRole("button", { name: "Baixar modelo Excel" }).click();
  const download = await pending;
  expect(download.suggestedFilename()).toBe("modelo-alunos-wisdom.xlsx");
  const data = await readSheet((await download.path())!);
  expect(data[0]).toEqual(["Nome", "Turma", "Data de nascimento"]);
});
test("aniversários de hoje e da semana respeitam o filtro de unidade", async ({
  page,
}) => {
  await page.locator(".operational-birthdays > summary").click();
  const panel = page.locator(".birthdays-panel");
  await panel.getByRole("button", { name: /^Hoje/ }).click();
  await expect(panel.locator(".birthday-student")).toHaveCount(1);
  await expect(panel.locator(".birthday-student")).toContainText(
    "Gabriel Almeida",
  );
  await page.getByLabel("Filtrar unidade").selectOption("u2");
  await expect(panel.locator(".birthday-student")).toHaveCount(0);
  await expect(panel).toContainText("Nenhum aniversário hoje.");
});
test("chamada salva mantém botão do grupo e mensagem com dois nomes e estados", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page
    .locator("nav")
    .getByRole("button", { name: "Chamada", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Compartilhar chamada no grupo", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.locator(".whatsapp-bubble")).toContainText(
    "Maria Eduarda — Presente",
  );
  await expect(dialog.locator(".whatsapp-bubble")).toContainText(
    "Pedro Henrique — Atrasado",
  );
  await expect(dialog.locator(".whatsapp-bubble")).not.toContainText(
    "Maria Eduarda Lima",
  );
  await expect(dialog.locator(".whatsapp-bubble")).toContainText(
    "Lucas Ferreira — Falta",
  );
  await expect(dialog.locator(".whatsapp-bubble")).toContainText("AUSENTES");
  await dialog
    .getByRole("button", { name: "Copiar texto", exact: true })
    .click();
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied).toContain("*WISDOM CURSOS*");
  expect(copied).toContain("Maria Eduarda — Presente");
  await dialog.getByRole("button", { name: "Fechar mensagem" }).click();
  await expect(
    page.getByRole("button", {
      name: "Compartilhar chamada no grupo",
      exact: true,
    }),
  ).toBeVisible();
});

test("alterações não salvas exigem finalizar novamente antes de compartilhar", async ({
  page,
}) => {
  await page
    .locator("nav")
    .getByRole("button", { name: "Chamada", exact: true })
    .click();
  await page
    .getByLabel("Conteúdo trabalhado")
    .fill("Conteúdo atualizado para o grupo");
  await expect(
    page.getByRole("button", {
      name: "Compartilhar chamada no grupo",
      exact: true,
    }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Finalizar chamada e gerar resumo" })
    .click();
  await expect(
    page.getByRole("dialog").locator(".whatsapp-bubble"),
  ).toContainText("Conteúdo atualizado para o grupo");
  await page.getByRole("button", { name: "Fechar mensagem" }).click();
  await expect(
    page.getByRole("button", {
      name: "Compartilhar chamada no grupo",
      exact: true,
    }),
  ).toBeEnabled();
});

test("administrador cria login e senha sem cadastro de e-mail", async ({
  page,
}) => {
  await page
    .locator("nav")
    .getByRole("button", { name: "Equipe e acesso", exact: true })
    .click();
  await page.getByRole("button", { name: "Novo usuário", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Criar usuário" });
  await dialog
    .getByLabel("Nome completo", { exact: true })
    .fill("Professora de Teste");
  await dialog
    .getByLabel("Nome de login", { exact: true })
    .fill("professora.teste");
  await dialog
    .getByLabel("Senha inicial", { exact: true })
    .fill("SenhaInicialTeste123");
  await dialog
    .getByLabel("Confirmar senha inicial", { exact: true })
    .fill("SenhaInicialTeste123");
  await expect(dialog.getByLabel("E-mail", { exact: true })).toHaveCount(0);
  await dialog
    .getByRole("button", { name: "Criar login", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  await expect(
    page.getByText("professora.teste", { exact: true }),
  ).toBeVisible();
  expect(
    schoolApi.store.profiles.find((p) => p.username === "professora.teste")
      ?.must_change_password,
  ).toBe(true);
});
test("primeiro acesso exige senha pessoal antes de mostrar alunos", async ({
  page,
}) => {
  schoolApi.store.profiles.find((p) => p.id === "p2")!.must_change_password =
    true;
  await page.getByTitle("Sair", { exact: true }).click();
  await page
    .getByLabel("Nome de usuário", { exact: true })
    .fill("ana.oliveira");
  await page.getByLabel("Senha", { exact: true }).fill("SenhaInicialTeste123");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Defina sua senha pessoal" }),
  ).toBeVisible();
  await expect(page.locator("nav")).toHaveCount(0);
  await expect(page.getByText("Gabriel Almeida", { exact: true })).toHaveCount(
    0,
  );
  await page
    .getByLabel("Nova senha", { exact: true })
    .fill("MinhaSenhaPessoal123");
  await page
    .getByLabel("Confirmar nova senha", { exact: true })
    .fill("MinhaSenhaPessoal123");
  await page
    .getByRole("button", { name: "Salvar nova senha e entrar novamente" })
    .click();
  await expect(
    page.getByLabel("Nome de usuário", { exact: true }),
  ).toBeVisible();
  await login(page, "ana.oliveira");
});
test("foto é comprimida antes do envio e aparece no cadastro e na chamada", async ({
  page,
}) => {
  const data = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 1600;
    canvas.height = 1200;
    const context = canvas.getContext("2d")!;
    const gradient = context.createLinearGradient(0, 0, 1600, 1200);
    gradient.addColorStop(0, "#12458a");
    gradient.addColorStop(1, "#ed3548");
    context.fillStyle = gradient;
    context.fillRect(0, 0, 1600, 1200);
    return canvas.toDataURL("image/png").split(",")[1];
  });
  await page
    .getByRole("button", { name: "Nova matrícula", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Nome completo").fill("Aluno Com Foto");
  await dialog.getByLabel("Turma", { exact: true }).selectOption("c1");
  await dialog.getByLabel("WhatsApp do responsável").fill("5511999999999");
  await dialog.getByLabel("Foto do aluno", { exact: true }).setInputFiles({
    name: "foto.png",
    mimeType: "image/png",
    buffer: Buffer.from(data, "base64"),
  });
  await dialog.getByLabel("Zoom da foto", { exact: true }).focus();
  await dialog.getByLabel("Zoom da foto", { exact: true }).press("End");
  await expect(dialog.getByLabel("Zoom da foto", { exact: true })).toHaveValue(
    "5",
  );
  await dialog.getByLabel("Posição vertical da foto", { exact: true }).focus();
  await dialog
    .getByLabel("Posição vertical da foto", { exact: true })
    .press("ArrowRight");
  await dialog
    .getByRole("button", { name: "Aplicar enquadramento", exact: true })
    .click();
  await expect(dialog.getByText(/Foto pronta:/)).toBeVisible();
  await dialog.getByRole("button", { name: "Salvar registro" }).click();
  await expect(dialog).toHaveCount(0);
  const student = schoolApi.store.students.find(
    (s) => s.name === "Aluno Com Foto",
  )!;
  expect(student.photo_path).toMatch(/u1\/.+\/.+\.(webp|jpg)$/);
  const object = schoolApi.objects.get(student.photo_path!)!;
  expect(object.body.length).toBeLessThanOrEqual(102400);
  expect(["image/webp", "image/jpeg"]).toContain(object.type);
  await page
    .locator("nav")
    .getByRole("button", { name: "Alunos", exact: true })
    .click();
  await page
    .getByPlaceholder("Buscar aluno ou responsável…")
    .fill("Aluno Com Foto");
  await expect(page.locator("tbody .student-avatar img")).toBeVisible();
  await page
    .locator("tbody tr")
    .filter({ hasText: "Aluno Com Foto" })
    .getByRole("button", { name: "Editar matrícula", exact: true })
    .click();
  const edit = page.getByRole("dialog");
  await edit
    .getByRole("button", { name: "Ajustar foto atual", exact: true })
    .click();
  await edit.getByLabel("Zoom da foto", { exact: true }).focus();
  await edit.getByLabel("Zoom da foto", { exact: true }).press("Home");
  await expect(edit.getByLabel("Zoom da foto", { exact: true })).toHaveValue(
    "0.1",
  );
  await edit
    .getByRole("button", { name: "Aplicar enquadramento", exact: true })
    .click();
  await edit
    .getByRole("button", { name: "Salvar registro", exact: true })
    .click();
  await expect(edit).toHaveCount(0);

  await page
    .locator("nav")
    .getByRole("button", { name: "Chamada", exact: true })
    .click();
  await expect(
    page
      .locator(".attendance-row")
      .filter({ hasText: "Aluno Com Foto" })
      .locator("img"),
  ).toBeVisible();
});
test("saída retorna ao login e não há dados ou seletor de demonstração", async ({
  page,
}) => {
  await expect(
    page.getByText(/DEMONSTRAÇÃO|Restaurar demonstração|Testar um perfil/),
  ).toHaveCount(0);
  await page.getByTitle("Sair", { exact: true }).click();
  await expect(
    page.getByLabel("Nome de usuário", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Gabriel Almeida", { exact: true })).toHaveCount(
    0,
  );
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Entre no seu espaço" }),
  ).toBeVisible();
});

test("administrador edita unidade e arquiva, restaura e exclui registro sem vínculos", async ({
  page,
}) => {
  await page
    .getByRole("button", { name: "Gestão de registros", exact: true })
    .click();
  await page
    .getByLabel("Tipo de registro", { exact: true })
    .selectOption("units");
  await page
    .getByRole("button", { name: "Editar Unidade Centro", exact: true })
    .click();
  let dialog = page.getByRole("dialog");
  await dialog.getByLabel("Nome", { exact: true }).fill("Centro revisado");
  await dialog.getByRole("button", { name: "Salvar alterações" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(
    page.locator("tbody").getByText("Centro revisado", { exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("Tipo de registro", { exact: true })
    .selectOption("offerings");
  const offering = schoolApi.store.offerings[0];
  await page
    .getByRole("button", { name: `Arquivar ${offering.name}`, exact: true })
    .click();
  dialog = page.getByRole("dialog");
  await dialog
    .getByLabel("Motivo do arquivamento")
    .fill("Atualização do catálogo");
  await dialog.getByRole("button", { name: "Confirmar arquivamento" }).click();
  await expect(dialog).toHaveCount(0);
  await page.getByLabel("Situação dos registros").selectOption("archived");
  await expect(
    page.locator("tbody").getByText(offering.name, { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: `Restaurar ${offering.name}`, exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Confirmar restauração" })
    .click();
  await page.getByLabel("Situação dos registros").selectOption("all");
  await page
    .getByRole("button", { name: `Excluir ${offering.name}`, exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByLabel("Digite EXCLUIR para confirmar")
    .fill("EXCLUIR");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Excluir definitivamente", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.locator("tbody").getByText(offering.name, { exact: true }),
  ).toHaveCount(0);
});
test("exclusão informa vínculos e não apaga aluno com chamada", async ({
  page,
}) => {
  await page
    .getByRole("button", { name: "Gestão de registros", exact: true })
    .click();
  const student = schoolApi.store.students.find((s) =>
    schoolApi.store.attendance.some((a) => a.student_id === s.id),
  )!;
  await page
    .getByRole("button", { name: `Excluir ${student.name}`, exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText(/vínculo\(s\) encontrado/)).toBeVisible();
  await dialog.getByLabel("Digite EXCLUIR para confirmar").fill("EXCLUIR");
  await dialog
    .getByRole("button", { name: "Excluir definitivamente", exact: true })
    .click();
  await expect(dialog.getByRole("alert")).toContainText("vínculos");
  expect(schoolApi.store.students.some((s) => s.id === student.id)).toBe(true);
});
test("fontes de navegação, tabelas e formulários permanecem legíveis", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Alunos", exact: true }).click();
  const size = await page
    .locator("tbody td")
    .first()
    .evaluate((e) => parseFloat(getComputedStyle(e).fontSize));
  expect(size).toBeGreaterThanOrEqual(13);
  await page
    .getByRole("button", { name: "Nova matrícula", exact: true })
    .click();
  expect(
    await page
      .getByRole("dialog")
      .getByLabel("Nome completo")
      .evaluate((e) => parseFloat(getComputedStyle(e).fontSize)),
  ).toBeGreaterThanOrEqual(15);
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Cancelar", exact: true })
    .click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Abrir menu" }).click();
  await page
    .getByRole("button", { name: "Gestão de registros", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Gestão de registros", level: 2 }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test("registro assistido gera rascunho revisável e evolução conclui somente o lembrete vinculado", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Pedagógico", exact: true }).click();
  await page
    .getByRole("button", { name: "Novo registro", exact: true })
    .click();
  let dialog = page.getByRole("dialog");
  await dialog
    .getByLabel("Aluno (opcional)", { exact: true })
    .selectOption("s1");
  await dialog
    .getByRole("button", { name: "Preenchimento assistido", exact: true })
    .click();
  const guide = dialog.getByRole("region", {
    name: "Guia de registro pedagógico",
  });
  await guide
    .getByRole("button", { name: "Atenção e início da tarefa", exact: true })
    .click();
  await guide.getByRole("button", { name: "Continuar", exact: true }).click();
  await guide
    .getByRole("button", {
      name: "Demora a iniciar após a orientação coletiva",
      exact: true,
    })
    .click();
  await guide.getByRole("button", { name: "Frequente", exact: true }).click();
  await guide.getByRole("button", { name: "Continuar", exact: true }).click();
  await guide
    .getByRole("button", { name: "Atividade individual", exact: true })
    .click();
  await guide.getByRole("button", { name: "Continuar", exact: true }).click();
  await guide
    .getByLabel("Dividir a tarefa em etapas observáveis", { exact: true })
    .check();
  await guide.getByRole("button", { name: "Continuar", exact: true }).click();
  await guide.getByRole("button", { name: "Em 7 dias", exact: true }).click();
  await guide
    .getByRole("button", { name: "Revisar relatório", exact: true })
    .click();
  await expect(guide.locator(".guide-review")).toContainText("Frequente (2/3)");
  await expect(guide.locator(".guide-review")).toContainText(
    "Dividir a tarefa",
  );
  await guide
    .getByLabel("Revisei e confirmo o registro pedagógico", { exact: true })
    .check();
  await dialog
    .getByRole("button", { name: "Salvar registro", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  const parent = schoolApi.store.pedagogy.find(
    (p) => p.support_plan?.context === "Atividade individual",
  )!;
  expect(parent.support_plan?.sources).toContain("cast");
  const pending = page
    .locator(".pedagogy-agenda-list article")
    .filter({ hasText: "Atenção e início da tarefa" });
  await expect(pending).toHaveCount(1);
  await pending
    .getByRole("button", { name: "Registrar evolução", exact: true })
    .click();
  dialog = page.getByRole("dialog");
  await expect(dialog.locator('input[name="parent_record_id"]')).toHaveValue(
    parent.id,
  );
  await dialog
    .getByLabel("Resultado do acompanhamento")
    .selectOption("progress");
  await dialog
    .getByLabel("Evidências da evolução")
    .fill("Iniciou com dois lembretes em atividade equivalente.");
  await dialog
    .getByLabel("Observações e evolução")
    .fill("Avanço parcial, mantendo a necessidade de apoio.");
  await dialog
    .getByRole("button", { name: "Salvar registro", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  await expect(pending).toHaveCount(0);
  const child = schoolApi.store.pedagogy.find(
    (p) => p.parent_record_id === parent.id,
  )!;
  expect(child.support_plan?.outcome).toBe("progress");
  expect(schoolApi.store.pedagogy.some((p) => p.id === parent.id)).toBe(true);
  await expect(
    page
      .locator(".record-card")
      .filter({ hasText: "Avanço parcial, mantendo" }),
  ).toContainText("Evolução vinculada");
});

test("cadastro aceita todos os campos vazios e permite completar a turma depois", async ({
  page,
}) => {
  await page
    .getByRole("button", { name: "Nova matrícula", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.locator("input[required],select[required],textarea[required]"),
  ).toHaveCount(0);
  await dialog
    .getByRole("button", { name: "Salvar registro", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  const student = schoolApi.store.students.find((s) => !s.name && !s.class_id)!;
  expect(student).toBeTruthy();
  expect(student.unit_id).toBe("u1");
  expect(student.guardian_phone).toBe("");
  await page.getByRole("button", { name: "Alunos", exact: true }).click();
  const row = page
    .locator("tbody tr")
    .filter({ hasText: `Cadastro ${student.id.slice(0, 6).toUpperCase()}` });
  await expect(row).toContainText("Sem turma");
  await row
    .getByRole("button", { name: "Editar matrícula", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByLabel("Nome completo")
    .fill("Cadastro completado");
  await page
    .getByRole("dialog")
    .getByLabel("Turma", { exact: true })
    .selectOption("c1");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Salvar registro", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator("tbody")).toContainText("Cadastro completado");
});

test("chamada grava horário e motivo opcionais e inclui os detalhes no WhatsApp", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Chamada", exact: true }).click();
  await page
    .getByRole("button", { name: "Todos presentes", exact: true })
    .click();
  const first = page.locator(".attendance-row").first(),
    second = page.locator(".attendance-row").nth(1);
  await first.getByRole("button", { name: "Atrasado", exact: true }).click();
  await page
    .getByRole("dialog", { name: "Registrar atraso" })
    .getByLabel(/Horário de chegada de/)
    .fill("14:25");
  await page
    .getByRole("dialog", { name: "Registrar atraso" })
    .getByRole("button", { name: "OK", exact: true })
    .click();
  await second
    .getByRole("button", { name: "Justificado", exact: true })
    .click();
  await page
    .getByRole("dialog", { name: "Justificar ausência" })
    .getByLabel(/Justificativa de/)
    .fill("Consulta médica");
  await page
    .getByRole("dialog", { name: "Justificar ausência" })
    .getByRole("button", { name: "OK", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Finalizar chamada", exact: false })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.locator(".whatsapp-bubble")).toContainText(
    "Chegada: 14:25",
  );
  await expect(dialog.locator(".whatsapp-bubble")).toContainText(
    "Motivo: Consulta médica",
  );
  await dialog
    .getByRole("button", { name: "Fechar mensagem", exact: true })
    .click();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Operação das unidades", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Chamada", exact: true }).click();
  await expect(
    first.getByRole("button", { name: "Atrasado", exact: true }),
  ).toHaveAttribute("title", /Chegada: 14:25/);
  await first.getByRole("button", { name: "Atrasado", exact: true }).click();
  await page
    .getByRole("dialog", { name: "Registrar atraso" })
    .getByLabel(/Horário de chegada de/)
    .fill("");
  await page
    .getByRole("dialog", { name: "Registrar atraso" })
    .getByRole("button", { name: "OK", exact: true })
    .click();
  await second
    .getByRole("button", { name: "Justificado", exact: true })
    .click();
  await page
    .getByRole("dialog", { name: "Justificar ausência" })
    .getByLabel(/Justificativa de/)
    .fill("");
  await page
    .getByRole("dialog", { name: "Justificar ausência" })
    .getByRole("button", { name: "OK", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Finalizar chamada", exact: false })
    .click();
  await expect(
    page.getByRole("dialog").locator(".whatsapp-bubble"),
  ).not.toContainText("Chegada:");
});

test("webcam captura foto e encerra a câmera antes do enquadramento", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const state = window as any;
    Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
      configurable: true,
      value: async (constraints: any) => {
        state.cameraConstraints = constraints;
        const canvas = document.createElement("canvas");
        canvas.width = 640;
        canvas.height = 480;
        const ctx = canvas.getContext("2d")!;
        ctx.fillStyle = "#2364a0";
        ctx.fillRect(0, 0, 640, 480);
        const stream = canvas.captureStream(20);
        for (const track of stream.getTracks()) {
          const stop = track.stop.bind(track);
          track.stop = () => {
            state.cameraStopped = true;
            stop();
          };
        }
        return stream;
      },
    });
    Object.defineProperty(navigator.mediaDevices, "enumerateDevices", {
      configurable: true,
      value: async () => [],
    });
  });
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Operação das unidades", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Nova matrícula", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByRole("button", { name: "Usar câmera", exact: true })
    .click();
  await expect(
    dialog.getByRole("button", { name: "Tirar foto", exact: true }),
  ).toBeEnabled();
  expect(
    await page.evaluate(() => (window as any).cameraConstraints.audio),
  ).toBe(false);
  await dialog.getByRole("button", { name: "Tirar foto", exact: true }).click();
  await expect(
    dialog.getByLabel("Zoom da foto", { exact: true }),
  ).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => (window as any).cameraStopped))
    .toBe(true);
  await dialog
    .getByRole("button", { name: "Aplicar enquadramento", exact: true })
    .click();
  await expect(dialog.getByText(/Foto pronta:/)).toBeVisible();
  await dialog
    .getByRole("button", { name: "Salvar registro", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  expect(schoolApi.store.students.some((s) => s.photo_path && !s.name)).toBe(
    true,
  );
});

test("câmera negada informa como continuar e não impede cadastro sem foto", async ({
  page,
}) => {
  await page.addInitScript(() =>
    Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
      configurable: true,
      value: async () => {
        throw new DOMException("Denied", "NotAllowedError");
      },
    }),
  );
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Operação das unidades", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Nova matrícula", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByRole("button", { name: "Usar câmera", exact: true })
    .click();
  await expect(dialog.getByRole("alert")).toContainText(
    "não permitiu a câmera",
  );
  await dialog
    .getByRole("button", { name: "Cancelar câmera", exact: true })
    .click();
  await dialog
    .getByRole("button", { name: "Salvar registro", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
});

test("comercial faz pré-matrícula, apresenta QR e prepara convites separados", async ({
  page,
}) => {
  schoolApi.store.classes[0].whatsapp =
    "https://chat.whatsapp.com/ValidInvite123456";
  schoolApi.store.classes[1].enrollment_open = false;
  await page.getByTitle("Sair", { exact: true }).click();
  await login(page, "comercial");
  await expect(
    page.getByRole("heading", { name: "Minha mesa comercial", exact: true }),
  ).toBeVisible();
  await expect(
    page
      .locator("nav")
      .getByRole("button", { name: "Pedagógico", exact: true }),
  ).toHaveCount(0);
  await expect(page.locator(".sales-class-grid")).not.toContainText(
    schoolApi.store.classes[1].name,
  );
  const card = page
    .locator(".sales-class-grid article")
    .filter({ hasText: schoolApi.store.classes[0].name });
  await card
    .getByRole("button", { name: "Pré-matricular nesta turma", exact: true })
    .click();
  const form = page.getByRole("dialog");
  await form.getByLabel("Nome completo").fill("Aluno de Venda");
  await form.getByLabel("Nome do responsável").fill("Responsável de Venda");
  await form.getByLabel("Telefone do aluno").fill("5511999999999");
  await form.getByLabel("WhatsApp do responsável").fill("5511888888888");
  await expect(form.getByLabel("Nascimento", { exact: true })).toHaveCount(0);
  await form
    .getByRole("button", { name: "Salvar registro", exact: true })
    .click();
  const welcome = page.getByRole("dialog", { name: "Grupo da turma" });
  await expect(welcome.getByAltText(/QR code do grupo/)).toBeVisible();
  const pre = schoolApi.store.students.find(
    (s) => s.name === "Aluno de Venda",
  )!;
  expect(pre.registration_stage).toBe("pre_enrollment");
  expect(pre.class_id).toBe("c1");
  await welcome
    .getByRole("button", { name: "Enviar convite ao aluno", exact: true })
    .click();
  await expect(
    page.getByRole("dialog").locator(".whatsapp-bubble"),
  ).toContainText("interagir com seus colegas");
  await page
    .getByRole("button", { name: "Fechar mensagem", exact: true })
    .click();
  await page
    .locator("nav")
    .getByRole("button", { name: "Alunos", exact: true })
    .click();
  const row = page.locator("tbody tr").filter({ hasText: "Aluno de Venda" });
  await row
    .getByRole("button", { name: "Grupo da turma", exact: true })
    .click();
  await page
    .getByRole("dialog", { name: "Grupo da turma" })
    .getByRole("button", { name: "Enviar convite ao responsável", exact: true })
    .click();
  await expect(
    page.getByRole("dialog").locator(".whatsapp-bubble"),
  ).toContainText("acompanhar a frequência");
  await page
    .getByRole("button", { name: "Fechar mensagem", exact: true })
    .click();
  await page.getByTitle("Sair", { exact: true }).click();
  await login(page, "secretaria");
  await page
    .getByRole("button", { name: "Central de atenção", exact: true })
    .click();
  await page.getByRole("button", { name: /^Pré-matrículas/ }).click();
  const pending = page
    .locator(".followup-list article")
    .filter({ hasText: "Aluno de Venda" });
  await pending
    .getByRole("button", { name: "Concluir pré-matrícula", exact: true })
    .click();
  const editing = page.getByRole("dialog");
  await editing
    .getByLabel("Endereço", { exact: true })
    .fill("Endereço conferido pela secretaria");
  await editing.getByLabel("Concluir conferência da pré-matrícula").check();
  await editing
    .getByRole("button", { name: "Salvar registro", exact: true })
    .click();
  await expect(editing).toHaveCount(0);
  expect(
    schoolApi.store.students.find((s) => s.id === pre.id)?.registration_stage,
  ).toBe("complete");
  await expect(page.locator(".followup-list")).not.toContainText(
    "Aluno de Venda",
  );
});

test("secretaria configura inscrições, prioridade e grupo da turma", async ({
  page,
}) => {
  await page.getByTitle("Sair", { exact: true }).click();
  await login(page, "secretaria");
  await page.getByRole("button", { name: "Turmas", exact: true }).click();
  const row = page
    .locator("tbody tr")
    .filter({ hasText: schoolApi.store.classes[0].name });
  await row.getByRole("button", { name: "Editar turma", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Turma aberta para matrícula").uncheck();
  await dialog.getByLabel("Prioridade para o comercial").selectOption("2");
  await dialog
    .getByLabel("Link do grupo de WhatsApp")
    .fill("https://chat.whatsapp.com/ValidInvite123456");
  const qr = await import("qrcode");
  const png = await qr.toBuffer("https://chat.whatsapp.com/ValidInvite123456", {
    width: 256,
  });
  await dialog
    .getByLabel("Imagem do QR code da turma", { exact: true })
    .setInputFiles({ name: "grupo.png", mimeType: "image/png", buffer: png });
  await expect(
    dialog.getByAltText("Prévia do QR code da turma", { exact: true }),
  ).toBeVisible();

  await dialog
    .getByRole("button", { name: "Salvar registro", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  await expect(row).toContainText("Matrículas fechadas");
  await expect(row).toContainText("2ª opção");
  await row.getByRole("button", { name: "Grupo", exact: true }).click();
  await expect(
    page
      .getByRole("dialog", { name: "Grupo da turma" })
      .getByAltText(/QR code do grupo/),
  ).toBeVisible();
});

test("ficha do aluno mantém área de leitura proporcional em computador e celular", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Alunos", exact: true }).click();
  await page
    .getByRole("button", { name: "Gabriel Almeida", exact: true })
    .click();
  const dossier = page.getByRole("dialog", {
    name: "Gabriel Almeida",
    exact: true,
  });
  const dimensions = await dossier.evaluate((e) => ({
    height: e.getBoundingClientRect().height,
    content: e.querySelector(".dossier-content")!.getBoundingClientRect()
      .height,
    identity: e.querySelector(".dossier-identity")!.getBoundingClientRect()
      .height,
  }));
  expect(dimensions.content / dimensions.height).toBeGreaterThan(0.35);
  expect(dimensions.identity).toBeLessThan(150);
  await dossier.getByRole("tab", { name: "Contatos", exact: true }).click();
  await expect(dossier.locator(".dossier-content")).toBeVisible();
  await page.setViewportSize({ width: 390, height: 700 });
  expect(
    await dossier
      .locator(".dossier-content")
      .evaluate((e) => e.getBoundingClientRect().height),
  ).toBeGreaterThan(200);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("secretaria recebe nova pré-matrícula automaticamente sem recarregar a página", async ({
  page,
}) => {
  await page.getByTitle("Sair", { exact: true }).click();
  await login(page, "secretaria");
  await page.clock.install();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Mesa da secretaria", exact: true }),
  ).toBeVisible();
  const original = schoolApi.store.students[0];
  schoolApi.store.students.push({
    ...original,
    id: "pre-auto",
    name: "Atualização Comercial",
    created_by: "p5",
    registration_stage: "pre_enrollment",
  });
  const confirmation = page.locator(
    ".management-enrollment .management-card-footer",
  );
  await expect(confirmation).toContainText("0 cadastros em conferência");
  await page.clock.fastForward(61000);
  await expect(confirmation).toContainText("1 cadastro em conferência");
  await confirmation.click();
  await expect(page.locator(".followup-list")).toContainText(
    "Atualização Comercial",
  );
});

test("comercial no celular mantém ação inicial e identidade dos alunos legíveis", async ({
  page,
}) => {
  Object.assign(schoolApi.store.students[0], {
    name: "Marcos Palmeiras",
    created_by: "p5",
    registration_stage: "pre_enrollment",
  });
  schoolApi.store.classes[0].name = "01 – Ter e Qui – 8h";
  await page.getByTitle("Sair", { exact: true }).click();
  await login(page, "comercial");
  for (const width of [360, 390, 412]) {
    await page.setViewportSize({ width, height: 800 });
    await page.evaluate(() => window.scrollTo(0, 0));
    const action = await page
      .getByRole("button", { name: "Nova pré-matrícula", exact: true })
      .boundingBox();
    expect(action!.y + action!.height).toBeLessThan(320);
    await expect(
      page.getByText("Uma nova matrícula começa com a turma certa."),
    ).toHaveCount(0);
    const row = page
      .locator(".sales-student-row")
      .filter({ hasText: "Marcos Palmeiras" });
    const identity = await row.locator(".sales-student-identity").boundingBox();
    const status = await row.locator(".sales-student-status").boundingBox();
    expect(identity!.width).toBeGreaterThan(180);
    expect(identity!.height).toBeLessThan(100);
    expect(status!.y).toBeGreaterThanOrEqual(identity!.y + identity!.height);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
});

test("módulos administrativos cabem em tela pequena sem comprimir a página", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  const menu = page.locator("nav");
  await page.getByRole("button", { name: "Abrir menu" }).click();
  const names = await menu
    .getByRole("button")
    .evaluateAll((buttons) =>
      buttons.map((button) => button.getAttribute("aria-label")!),
    );
  await page.getByRole("button", { name: "Fechar menu" }).click();
  for (const name of names) {
    await page.getByRole("button", { name: "Abrir menu" }).click();
    await menu.getByRole("button", { name: name.trim(), exact: true }).click();
    await expect(page.locator(".page-heading h1")).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      name,
    ).toBe(true);
    expect(
      await page
        .locator(".page-heading h1")
        .evaluate((el) => parseFloat(getComputedStyle(el).fontSize)),
    ).toBeLessThanOrEqual(24);
  }
});

test("matrícula individual salva agenda sem turma e participa de chamada e pedagogia", async ({
  page,
}) => {
  await page
    .getByRole("button", { name: "Nova matrícula", exact: true })
    .click();
  let dialog = page.getByRole("dialog");
  await dialog.getByLabel("Nome completo").fill("Aluno Individual");
  await dialog.getByLabel("Turma", { exact: true }).selectOption("individual");
  await dialog.getByLabel("Carga horária total (horas)").fill("20");
  await dialog.getByLabel("Duração de cada aula (minutos)").fill("60");
  await dialog.getByLabel("Professor das aulas individuais").selectOption("p2");
  await dialog.getByLabel("Segunda", { exact: true }).check();
  await dialog.getByLabel("Quarta", { exact: true }).check();
  await dialog
    .getByRole("button", { name: "Salvar registro", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  const student = schoolApi.store.students.find(
    (s) => s.name === "Aluno Individual",
  )!;
  expect(student.class_id).toBeNull();
  expect(student.enrollment_mode).toBe("individual");
  expect(student.individual_days).toEqual([1, 3]);
  await page
    .locator("nav")
    .getByRole("button", { name: "Chamada", exact: true })
    .click();
  await page.getByLabel("Turma", { exact: true }).selectOption("individual");
  await page.getByLabel("Aluno da aula individual").selectOption(student.id);
  await expect(page.getByLabel("Duração desta aula (minutos)")).toHaveValue(
    "60",
  );
  await page
    .getByPlaceholder("O que os alunos aprenderam hoje?")
    .fill("Organização de tarefas individuais");
  await expect(page.locator(".attendance-row")).toHaveCount(1);
  await page
    .locator(".attendance-row")
    .getByRole("button", { name: "Falta", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Finalizar chamada", exact: false })
    .click();
  dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("Aula individual");
  await expect(dialog).toContainText("Aluno Individual");
  await expect(dialog).toContainText("AUSENTES (1)");
  const lesson = schoolApi.store.lessons.find(
    (l) => l.student_id === student.id,
  )!;
  expect(lesson.class_id).toBeNull();
  expect(lesson.duration_minutes).toBe(60);
  await page
    .getByRole("button", { name: "Fechar mensagem", exact: true })
    .click();
  await page
    .locator("nav")
    .getByRole("button", { name: "Pedagógico", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Novo registro", exact: true })
    .click();
  dialog = page.getByRole("dialog");
  await dialog
    .getByLabel("Turma *", { exact: true })
    .selectOption("individual");
  await dialog.getByLabel("Aluno da aula individual").selectOption(student.id);
  await dialog.getByLabel("Habilidade observada *").fill("Organização");
  await dialog
    .getByLabel("Observações e evolução *")
    .fill("Organiza as tarefas com apoio visual.");
  await dialog
    .getByRole("button", { name: "Salvar registro", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  expect(
    schoolApi.store.pedagogy.find((p) => p.student_id === student.id)?.class_id,
  ).toBeNull();
  await page
    .locator("nav")
    .getByRole("button", { name: "Central de atenção", exact: true })
    .click();
  await expect(
    page.getByText("Aluno Individual", { exact: true }).first(),
  ).toBeVisible();
});

test("desligamento exige checklist configurável antes de salvar", async ({
  page,
}) => {
  await page
    .locator("nav")
    .getByRole("button", { name: "Alunos", exact: true })
    .click();
  const row = page
    .locator("tbody tr")
    .filter({ hasText: schoolApi.store.students[0].name });
  const id = schoolApi.store.students[0].id;
  await row.getByTitle("Arquivar aluno", { exact: true }).click();
  let dialog = page.getByRole("dialog");
  await dialog
    .getByLabel("Detalhes *")
    .fill("Conclusão confirmada pela secretaria");
  await expect(dialog.getByRole("checkbox")).toHaveCount(1);
  await dialog
    .getByRole("button", { name: "Salvar registro", exact: true })
    .click();
  await expect(dialog).toBeVisible();
  expect(schoolApi.store.students.find((s) => s.id === id)?.status).toBe(
    "ativo",
  );
  await dialog.getByRole("checkbox").check();
  await dialog
    .getByRole("button", { name: "Salvar registro", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  expect(
    schoolApi.store.students.find((s) => s.id === id)?.offboarding?.steps
      ?.length,
  ).toBe(1);
  await page
    .locator("nav")
    .getByRole("button", { name: "Equipe e acesso", exact: true })
    .click();
  await page
    .getByLabel("Nova etapa", { exact: true })
    .fill("Conferiu os materiais devolvidos?");
  await page
    .getByRole("button", { name: "Adicionar etapa", exact: true })
    .click();
  await expect(page.getByLabel("Etapa 2", { exact: true })).toHaveValue(
    "Conferiu os materiais devolvidos?",
  );
});

test("foto redonda amplia duas vezes sem abrir a ficha do aluno", async ({
  page,
}) => {
  const student = schoolApi.store.students[0];
  student.photo_path = `${student.unit_id}/${student.id}/identificacao.png`;
  const data = await page.evaluate(() => {
    const c = document.createElement("canvas");
    c.width = 100;
    c.height = 100;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#13478b";
    ctx.fillRect(0, 0, 100, 100);
    return c.toDataURL("image/png").split(",")[1];
  });
  schoolApi.objects.set(student.photo_path, {
    body: Buffer.from(data, "base64"),
    type: "image/png",
  });
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Operação das unidades", exact: true }),
  ).toBeVisible();
  await page
    .locator("nav")
    .getByRole("button", { name: "Alunos", exact: true })
    .click();
  const avatar = page
    .getByRole("button", {
      name: `Ampliar foto de ${student.name}`,
      exact: true,
    })
    .first();
  await expect(avatar).toBeVisible();
  expect(await avatar.evaluate((el) => getComputedStyle(el).borderRadius)).toBe(
    "50%",
  );
  await avatar.scrollIntoViewIfNeeded();
  const box = await avatar.boundingBox();
  await avatar.click();
  const zoom = page.getByRole("img", {
    name: `Foto de ${student.name} ampliada 2 vezes`,
    exact: true,
  });
  await expect(zoom).toBeVisible();
  const image = await zoom.boundingBox();
  expect(image!.width).toBeCloseTo(box!.width * 2, 0);
  expect(image!.x + image!.width / 2).toBeCloseTo(box!.x + box!.width / 2, 0);
  expect(image!.y + image!.height / 2).toBeCloseTo(box!.y + box!.height / 2, 0);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(await page.locator(".photo-zoom-overlay").textContent()).toBe("");
  expect(
    await page
      .locator(".photo-zoom-overlay")
      .evaluate((el) => getComputedStyle(el).backgroundColor),
  ).toBe("rgba(0, 0, 0, 0)");
  await zoom.click();
  await expect(zoom).toHaveCount(0);
  await avatar.click();
  await expect(zoom).toBeVisible();
  await page.mouse.click(5, 5);
  await expect(zoom).toHaveCount(0);
  await avatar.focus();
  await page.keyboard.press("Enter");
  await expect(zoom).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(zoom).toHaveCount(0);
  await expect(avatar).toBeFocused();
  await page.setViewportSize({ width: 390, height: 844 });
  await avatar.scrollIntoViewIfNeeded();
  const mobileBox = await avatar.boundingBox();
  await avatar.click();
  await expect(zoom).toBeVisible();
  const mobileImage = await zoom.boundingBox();
  expect(mobileImage!.width).toBeCloseTo(mobileBox!.width * 2, 0);
  expect(mobileImage!.x + mobileImage!.width / 2).toBeCloseTo(
    mobileBox!.x + mobileBox!.width / 2,
    0,
  );
  expect(mobileImage!.y + mobileImage!.height / 2).toBeCloseTo(
    mobileBox!.y + mobileBox!.height / 2,
    0,
  );
  await page.mouse.click(5, 5);
  await expect(zoom).toHaveCount(0);
});

test("relatório personalizado exporta somente as colunas marcadas em XLS e PDF", async ({
  page,
}) => {
  const student = schoolApi.store.students[0];
  student.guardian = "Responsável de teste";
  student.guardian_phone = "0011999999999";
  student.phone = "11911111111";
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Operação das unidades", exact: true }),
  ).toBeVisible();
  await page
    .locator("nav")
    .getByRole("button", { name: "Relatórios", exact: true })
    .click();
  const report = page.getByRole("region", {
    name: "Relatório personalizado",
    exact: true,
  });
  await report
    .getByRole("button", { name: "Limpar seleção", exact: true })
    .click();
  await expect(
    report.getByRole("button", { name: "Baixar relatório", exact: true }),
  ).toBeDisabled();
  await report.getByLabel("Responsável", { exact: true }).check();
  await report.getByLabel("Telefone do responsável", { exact: true }).check();
  await expect(report.locator("thead th")).toHaveText([
    "Responsável",
    "Telefone do responsável",
  ]);
  await report
    .getByLabel("Formato do arquivo", { exact: true })
    .selectOption("xls");
  const downloading = page.waitForEvent("download");
  await report
    .getByRole("button", { name: "Baixar relatório", exact: true })
    .click();
  const download = await downloading;
  expect(download.suggestedFilename()).toMatch(/\.xls$/);
  const { readFile } = await import("node:fs/promises"),
    XLSX = await import("xlsx");
  const bytes = await readFile((await download.path())!);
  expect([...bytes.subarray(0, 4)]).toEqual([0xd0, 0xcf, 0x11, 0xe0]);
  const wb = XLSX.read(bytes, { type: "buffer" }),
    rows = XLSX.utils.sheet_to_json(wb.Sheets.Alunos, {
      header: 1,
      raw: true,
    }) as unknown[][];
  expect(rows[0]).toEqual(["Responsável", "Telefone do responsável"]);
  expect(
    rows.some(
      (row) => row[0] === "Responsável de teste" && row[1] === "0011999999999",
    ),
  ).toBe(true);
  expect(rows.flat()).not.toContain(student.name);
  expect(rows.flat()).not.toContain(student.phone);
  await report
    .getByLabel("Formato do arquivo", { exact: true })
    .selectOption("pdf");
  const pdfDownload = page.waitForEvent("download");
  await report
    .getByRole("button", { name: "Baixar relatório", exact: true })
    .click();
  const pdf = await pdfDownload;
  expect(pdf.suggestedFilename()).toMatch(/\.pdf$/);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("turmas mantêm a moldura e a ocupação muda de cor por faixa", async ({
  page,
}) => {
  const course = schoolApi.store.classes[0];
  const count = schoolApi.store.students.filter(
    (s) => s.class_id === course.id && s.status === "ativo",
  ).length;
  for (const [capacity, tone] of [
    [count * 4, "low"],
    [count * 2, "moderate"],
    [Math.ceil(count / 0.8), "balanced"],
    [count, "near-full"],
  ] as const) {
    course.capacity = capacity;
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "Operação das unidades", exact: true }),
    ).toBeVisible();
    await page
      .locator("nav")
      .getByRole("button", { name: "Turmas", exact: true })
      .click();
    const row = page
      .locator(".class-directory tbody tr")
      .filter({ hasText: course.name });
    await expect(row.locator(".occupancy-meter")).toHaveClass(new RegExp(tone));
    expect(
      await row
        .locator("td")
        .first()
        .evaluate((el) => getComputedStyle(el).borderLeftColor),
    ).toBe(
      await page.evaluate((color) => {
        const e = document.createElement("span");
        e.style.color = color;
        document.body.appendChild(e);
        const value = getComputedStyle(e).color;
        e.remove();
        return value;
      }, course.color!),
    );
  }
});

test("acessos ficam primeiro e auditoria inicia recolhida sem buscar movimentos", async ({
  page,
}) => {
  let auditRequests = 0;
  page.on("request", (request) => {
    if (new URL(request.url()).pathname === "/rest/v1/audit_log")
      auditRequests++;
  });
  await page
    .locator("nav")
    .getByRole("button", { name: "Equipe e acesso", exact: true })
    .click();
  const team = await page
      .getByRole("heading", { name: "Equipe e logins", exact: true })
      .boundingBox(),
    checklist = await page
      .getByRole("heading", { name: "Checklist de desligamento", exact: true })
      .boundingBox();
  const audit = page.locator(".audit-panel"),
    summary = audit.locator(":scope > summary");
  const auditBox = await summary.boundingBox();
  expect(team!.y).toBeLessThan(checklist!.y);
  expect(checklist!.y).toBeLessThan(auditBox!.y);
  await expect(audit).not.toHaveAttribute("open", "");
  await expect(audit.locator("select").first()).toBeHidden();
  expect(auditRequests).toBe(0);
  await expect(page.locator(".password-change")).toHaveCount(0);
  await summary.click();
  await expect(audit).toHaveAttribute("open", "");
  await expect(
    audit.getByText("Nenhuma alteração nesta página.", { exact: true }),
  ).toBeVisible();
  await expect.poll(() => auditRequests).toBe(1);
  await summary.click();
  await expect(audit.locator("select").first()).toBeHidden();
  await summary.focus();
  await page.keyboard.press("Enter");
  await expect(audit.locator("select").first()).toBeVisible();
});

test("próprio usuário altera senha pelo botão da linha sem painel permanente", async ({
  page,
}) => {
  await page
    .locator("nav")
    .getByRole("button", { name: "Equipe e acesso", exact: true })
    .click();
  const actor = schoolApi.store.profiles[0],
    row = page.locator("tbody tr").filter({ hasText: actor.name }),
    ownButton = row.getByTitle("Alterar minha senha", { exact: true });
  await expect(ownButton).toBeVisible();
  await ownButton.click();
  const dialog = page.getByRole("dialog", {
    name: "Alterar minha senha",
    exact: true,
  });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel("Nova senha", { exact: true })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(ownButton).toBeFocused();
  await page.locator(".header-profile-name").click();
  await expect(dialog).toBeVisible();
  await dialog
    .getByLabel("Nova senha", { exact: true })
    .fill("MinhaSenhaNova123");
  await dialog
    .getByLabel("Confirmar nova senha", { exact: true })
    .fill("OutraSenha123");
  await dialog
    .getByRole("button", {
      name: "Salvar nova senha e entrar novamente",
      exact: true,
    })
    .click();
  await expect(dialog.getByRole("alert")).toHaveText(
    "As senhas não coincidem.",
  );
  await dialog
    .getByLabel("Confirmar nova senha", { exact: true })
    .fill("MinhaSenhaNova123");
  const change = page.waitForRequest(
    (request) => new URL(request.url()).pathname === "/api/account/password",
  );
  await dialog
    .getByRole("button", {
      name: "Salvar nova senha e entrar novamente",
      exact: true,
    })
    .click();
  expect((await change).postDataJSON()).toEqual({
    password: "MinhaSenhaNova123",
  });
  await expect(
    page.getByRole("button", { name: "Entrar", exact: true }),
  ).toBeVisible();
  await expect(dialog).toHaveCount(0);
});

test("funcionário acessa sua senha pelo cabeçalho no celular", async ({
  page,
}) => {
  await page.getByTitle("Sair", { exact: true }).click();
  await login(page, "secretaria");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator(".header-profile-name").click();
  const dialog = page.getByRole("dialog", {
    name: "Alterar minha senha",
    exact: true,
  });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel("Nova senha", { exact: true })).toBeFocused();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await dialog.getByRole("button", { name: "Cancelar", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await page.getByRole("button", { name: "Abrir menu" }).click();
  await expect(
    page
      .locator("nav")
      .getByRole("button", { name: "Equipe e acesso", exact: true }),
  ).toHaveCount(0);
});

test("curso e turma registram carga horária e a chamada atualiza o progresso do aluno", async ({
  page,
}) => {
  await page
    .locator("nav")
    .getByRole("button", { name: "Cursos e pacotes", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Novo curso ou pacote", exact: true })
    .click();
  let dialog = page.getByRole("dialog");
  await dialog.getByLabel("Nome da formação *").fill("Curso Planejado 200h");
  await dialog
    .getByLabel("Carga horária total (horas)", { exact: true })
    .fill("200");
  await dialog
    .getByLabel("Cursos e módulos incluídos *")
    .fill("Preparação profissional");
  await dialog
    .getByRole("button", { name: "Salvar registro", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  const offering = schoolApi.store.offerings.find(
    (o) => o.name === "Curso Planejado 200h",
  )!;
  expect(offering.total_hours).toBe(200);
  expect(offering.duration_months).toBeNull();
  await page
    .locator("nav")
    .getByRole("button", { name: "Turmas", exact: true })
    .click();
  await page.getByRole("button", { name: "Nova turma", exact: true }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Nome da turma *").fill("Turma Planejada");
  await dialog
    .getByLabel("Curso ou pacote de referência", { exact: true })
    .selectOption(offering.id);
  await dialog
    .getByLabel("Carga horária de cada aula (horas)", { exact: true })
    .fill("2");
  await dialog.getByLabel("Terça", { exact: true }).check();
  await dialog.getByLabel("Quinta", { exact: true }).check();
  await dialog.getByLabel("Professor *", { exact: true }).selectOption("p2");
  await dialog
    .getByLabel("Dias e horário *", { exact: true })
    .fill("Ter e Qui · 14h às 16h");
  await dialog
    .getByRole("button", { name: "Salvar registro", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  const course = schoolApi.store.classes.find(
    (c) => c.name === "Turma Planejada",
  )!;
  expect(course.lesson_duration_minutes).toBe(120);
  expect(course.lesson_days).toEqual([2, 4]);
  await page
    .locator("nav")
    .getByRole("button", { name: "Alunos", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Nova matrícula", exact: true })
    .click();
  dialog = page.getByRole("dialog");
  await dialog
    .getByLabel("Nome completo", { exact: true })
    .fill("Aluno Planejado");
  await dialog.getByLabel("Turma", { exact: true }).selectOption(course.id);
  await dialog
    .getByLabel("Data de início do curso", { exact: true })
    .fill("2026-11-01");
  await dialog
    .getByLabel("Vencimento do último boleto", { exact: true })
    .fill("2027-05-01");
  await dialog
    .getByRole("button", { name: "Salvar registro", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  const student = schoolApi.store.students.find(
    (s) => s.name === "Aluno Planejado",
  )!;
  expect(student.course_start_date).toBe("2026-11-01");
  expect(student.last_installment_date).toBe("2027-05-01");
  await page
    .locator("nav")
    .getByRole("button", { name: "Chamada", exact: true })
    .click();
  await page.getByLabel("Turma", { exact: true }).selectOption(course.id);
  await page
    .getByPlaceholder("O que os alunos aprenderam hoje?")
    .fill("Introdução");
  await page
    .locator(".attendance-row")
    .getByRole("button", { name: "Presente", exact: true })
    .click();
  await page
    .getByRole("button", {
      name: "Finalizar chamada e gerar resumo",
      exact: true,
    })
    .click();
  await page
    .getByRole("button", { name: "Fechar mensagem", exact: true })
    .click();
  expect(
    schoolApi.store.lessons.find((l) => l.class_id === course.id)
      ?.duration_minutes,
  ).toBe(120);
  async function openStudent() {
    await page
      .locator("nav")
      .getByRole("button", { name: "Alunos", exact: true })
      .click();
    await page
      .getByPlaceholder("Buscar aluno ou responsável…")
      .fill(student.name);
    await page.getByRole("button", { name: student.name, exact: true }).click();
  }
  await openStudent();
  let progress = page.getByRole("region", {
    name: "Progresso do curso",
    exact: true,
  });
  await expect(
    progress.getByRole("progressbar", { name: "Carga horária concluída" }),
  ).toHaveAttribute("aria-valuenow", "1");
  await expect(progress).toContainText("2 h de 200 h");
  await expect(progress).toContainText("198 h restantes");
  await expect(progress).toContainText("01/11/2026");
  await expect(progress).toContainText("01/05/2027");
  await page.getByRole("button", { name: "Fechar ficha", exact: true }).click();
  await page
    .locator("nav")
    .getByRole("button", { name: "Chamada", exact: true })
    .click();
  await page
    .locator(".attendance-row")
    .getByRole("button", { name: "Falta", exact: true })
    .click();
  await page
    .getByRole("button", {
      name: "Finalizar chamada e gerar resumo",
      exact: true,
    })
    .click();
  await page
    .getByRole("button", { name: "Fechar mensagem", exact: true })
    .click();
  await openStudent();
  progress = page.getByRole("region", {
    name: "Progresso do curso",
    exact: true,
  });
  await expect(progress.getByRole("progressbar")).toHaveAttribute(
    "aria-valuenow",
    "0",
  );
  await expect(progress).toContainText("0 h de 200 h");
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("aniversariantes usam a data e a turma da chamada sem reabrir por marcação", async ({
  page,
}) => {
  await page.removeLocatorHandler(
    page.getByRole("dialog", { name: "Aniversariantes da aula", exact: true }),
  );
  for (const id of ["s1", "s2", "s3", "s8", "s14"])
    schoolApi.store.students.find((s) => s.id === id)!.birth_date =
      "2009-10-20";
  schoolApi.store.students.find((s) => s.id === "s3")!.status = "abandono";
  await page.reload();
  await page.getByRole("button", { name: "Chamada", exact: true }).click();
  await page.getByLabel("Data da aula").fill("2026-10-20");
  const birthday = page.getByRole("dialog", {
    name: "Aniversariantes da aula",
    exact: true,
  });
  await expect(birthday).toBeVisible();
  await expect(birthday.locator("li")).toHaveCount(2);
  await expect(birthday).toContainText("Gabriel Almeida");
  await expect(birthday).toContainText("Isabela Santos");
  await expect(birthday).not.toContainText("Helena Costa");
  await birthday
    .getByRole("button", { name: "Continuar chamada", exact: true })
    .click();
  await page
    .locator(".attendance-row")
    .first()
    .getByRole("button", { name: "Presente", exact: true })
    .click();
  await expect(birthday).toHaveCount(0);
  await page.getByLabel("Data da aula").fill("2026-10-19");
  await expect(birthday).toHaveCount(0);
  await page.getByLabel("Data da aula").fill("2026-10-20");
  await expect(birthday).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByLabel("Turma", { exact: true }).selectOption("c2");
  await expect(birthday).toBeVisible();
  await expect(birthday.locator("li")).toHaveCount(1);
  await expect(birthday).toContainText("Helena Costa");
});

test("chamada mobile usa cores, cancela detalhes sem alterar a marcação e aceita dados vazios", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Abrir menu", exact: true }).click();
  await page.getByRole("button", { name: "Chamada", exact: true }).click();
  await page.getByLabel("Data da aula").fill("2026-10-21");
  const row = page.locator(".attendance-row").first();
  await row.getByRole("button", { name: "Presente", exact: true }).click();
  await expect(row).toHaveClass(/marked-presente/);
  await expect(row).toHaveCSS("background-color", "rgb(238, 248, 241)");
  await row.getByRole("button", { name: "Falta", exact: true }).click();
  await expect(row).toHaveClass(/marked-falta/);
  await expect(row).toHaveCSS("background-color", "rgb(255, 240, 240)");
  const rowHeight = (await row.boundingBox())!.height;
  await row.getByRole("button", { name: "Atrasado", exact: true }).click();
  let dialog = page.getByRole("dialog", { name: "Registrar atraso" });
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveJSProperty("open", true);
  await dialog.getByLabel(/Horário de chegada de/).fill("14:35");
  await dialog.getByRole("button", { name: "Cancelar", exact: true }).click();
  await expect(row).toHaveClass(/marked-falta/);
  await row.getByRole("button", { name: "Atrasado", exact: true }).click();
  await expect(dialog.getByLabel(/Horário de chegada de/)).toHaveValue("");
  await dialog.getByRole("button", { name: "OK", exact: true }).click();
  await expect(row).toHaveClass(/marked-atrasado/);
  await expect(row).toHaveCSS("background-color", "rgb(255, 248, 230)");
  expect((await row.boundingBox())!.height).toBe(rowHeight);
  await row.getByRole("button", { name: "Justificado", exact: true }).click();
  dialog = page.getByRole("dialog", { name: "Justificar ausência" });
  await dialog.getByRole("button", { name: "OK", exact: true }).click();
  await expect(row).toHaveClass(/marked-justificado/);
  await expect(row).toHaveCSS("background-color", "rgb(237, 244, 255)");
  await expect(row.locator("input,textarea")).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test("guia mobile ramifica e registra evolução sem digitar, com revisão obrigatória", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Abrir menu", exact: true }).click();
  await page.getByRole("button", { name: "Pedagógico", exact: true }).click();
  await page
    .getByRole("button", { name: "Novo registro", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByLabel("Aluno (opcional)", { exact: true })
    .selectOption("s1");
  await dialog
    .getByRole("button", { name: "Preenchimento assistido", exact: true })
    .click();
  const guide = dialog.getByRole("region", {
    name: "Guia de registro pedagógico",
  });
  const next = () =>
    guide.getByRole("button", { name: "Continuar", exact: true }).click();
  await expect(
    guide.getByRole("button", { name: "Continuar", exact: true }),
  ).toBeDisabled();
  await guide
    .getByRole("button", { name: "Organização e autonomia", exact: true })
    .click();
  await next();
  await guide
    .getByRole("button", {
      name: "Perde etapas de instruções com várias ações",
      exact: true,
    })
    .click();
  await guide.getByRole("button", { name: "Frequente", exact: true }).click();
  await expect(
    guide.getByLabel("Precisa de apoio para compreender os enunciados", {
      exact: true,
    }),
  ).toBeVisible();
  await next();
  await guide
    .getByRole("button", { name: "Exercício prático", exact: true })
    .click();
  await next();
  await expect(
    guide.getByLabel("Dividir a tarefa em etapas observáveis", { exact: true }),
  ).toBeVisible();
  await expect(
    guide.getByLabel("Combinar uma rotina breve para retomar a atividade", {
      exact: true,
    }),
  ).toHaveCount(0);
  await guide
    .getByLabel("Dividir a tarefa em etapas observáveis", { exact: true })
    .check();
  await next();
  await guide
    .getByRole("button", { name: "Revisar relatório", exact: true })
    .click();
  await dialog
    .getByRole("button", { name: "Salvar registro", exact: true })
    .click();
  await expect(dialog).toBeVisible();
  expect(
    schoolApi.store.pedagogy.filter(
      (p) => p.support_plan?.context === "Exercício prático",
    ),
  ).toHaveLength(0);
  await guide
    .getByLabel("Revisei e confirmo o registro pedagógico", { exact: true })
    .check();
  await expect(
    guide.locator("textarea,input:not([type=hidden]):not([type=checkbox])"),
  ).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await dialog
    .getByRole("button", { name: "Salvar registro", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  const parent = schoolApi.store.pedagogy.find(
    (p) => p.support_plan?.context === "Exercício prático",
  )!;
  await page
    .locator(".pedagogy-agenda-list article")
    .filter({ hasText: "Organização e autonomia" })
    .getByRole("button", { name: "Registrar evolução", exact: true })
    .click();
  await dialog
    .getByRole("button", { name: "Preenchimento assistido", exact: true })
    .click();
  await guide
    .getByRole("button", { name: "Organização e autonomia", exact: true })
    .click();
  await next();
  await guide
    .getByRole("button", {
      name: "Perde etapas de instruções com várias ações",
      exact: true,
    })
    .click();
  await guide.getByRole("button", { name: "Ocasional", exact: true }).click();
  await next();
  await guide
    .getByRole("button", { name: "Exercício prático", exact: true })
    .click();
  await next();
  await guide
    .getByLabel("Dividir a tarefa em etapas observáveis", { exact: true })
    .check();
  await next();
  await guide
    .getByLabel("Resultado do acompanhamento", { exact: true })
    .selectOption("progress");
  await guide
    .getByRole("button", {
      name: "Concluiu mais etapas, ainda com apoio do professor.",
      exact: true,
    })
    .click();
  await guide
    .getByRole("button", { name: "Sem novo lembrete", exact: true })
    .click();
  await guide
    .getByRole("button", { name: "Revisar relatório", exact: true })
    .click();
  await guide
    .getByLabel("Revisei e confirmo o registro pedagógico", { exact: true })
    .check();
  await dialog
    .getByRole("button", { name: "Salvar registro", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  const child = schoolApi.store.pedagogy.find(
    (p) => p.parent_record_id === parent.id,
  )!;
  expect(child.support_plan?.outcome).toBe("progress");
  expect(child.support_plan?.evidence).toContain("Concluiu mais etapas");
  expect(child.follow_up).toBe("");
  await expect(
    page
      .locator(".pedagogy-agenda-list article")
      .filter({ hasText: "Organização e autonomia" }),
  ).toHaveCount(0);
});

test("colar tabela sem cabeçalho reconhece dados, permite revisão e mantém alerta cadastral", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Alunos", exact: true }).click();
  await page
    .getByRole("button", { name: "Importar alunos", exact: true })
    .click();
  const dialog = page.getByRole("dialog", { name: "Importar alunos em massa" });
  await dialog.getByLabel("Unidade da importação").selectOption("u1");
  await dialog.getByLabel("Turma de destino").selectOption("c1");
  await dialog
    .getByRole("button", { name: "Copiar e colar", exact: true })
    .click();
  await dialog
    .getByLabel("Lista de alunos para colar")
    .fill(
      "Aluna Colada Um\t(71) 99999-1234\t14/05/2009\nAluno Colado Dois\t71999994321\t20/06/2008",
    );
  await expect(dialog.getByLabel("Informação da coluna 1")).toHaveValue("name");
  await expect(dialog.getByLabel("Informação da coluna 2")).toHaveValue(
    "phone",
  );
  await expect(dialog.getByLabel("Informação da coluna 3")).toHaveValue(
    "birth",
  );
  await expect(
    dialog.getByRole("checkbox", { name: "A primeira linha é cabeçalho" }),
  ).not.toBeChecked();
  await expect(
    dialog.getByRole("button", { name: "Importar 2 alunos", exact: true }),
  ).toBeEnabled();
  await dialog.getByLabel("Informação da coluna 3").selectOption("phone");
  await expect(dialog.getByRole("alert")).toContainText("apenas uma coluna");
  await expect(
    dialog.getByRole("button", { name: "Importar 0 alunos", exact: true }),
  ).toBeDisabled();
  await dialog.getByLabel("Informação da coluna 3").selectOption("birth");
  await dialog
    .getByRole("button", { name: "Importar 2 alunos", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  const imported = schoolApi.store.students.find(
    (s) => s.name === "Aluna Colada Um",
  )!;
  expect(imported.phone).toBe("71999991234");
  expect(imported.birth_date).toBe("2009-05-14");
  expect(imported.class_id).toBe("c1");
  await page
    .getByRole("button", { name: "Central de atenção", exact: true })
    .click();
  await expect(
    page
      .locator(".followup-list article")
      .filter({ hasText: "Aluna Colada Um" }),
  ).toContainText("Completar matrícula");
});

test("cria turma na importação sem perder lista e importa só nomes em celular", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Abrir menu", exact: true }).click();
  await page.getByRole("button", { name: "Alunos", exact: true }).click();
  await page
    .getByRole("button", { name: "Importar alunos", exact: true })
    .click();
  const dialog = page.getByRole("dialog", { name: "Importar alunos em massa" });
  await dialog.getByLabel("Unidade da importação").selectOption("u1");
  await dialog
    .getByRole("button", { name: "Copiar e colar", exact: true })
    .click();
  const text = "1. Lista Nova Ana\n2. Lista Novo Pedro";
  await dialog.getByLabel("Lista de alunos para colar").fill(text);
  await expect(
    dialog.getByRole("button", { name: "Importar 0 alunos", exact: true }),
  ).toBeDisabled();
  await dialog
    .getByRole("button", { name: "Criar turma", exact: true })
    .click();
  const form = dialog.getByRole("form", { name: "Criar turma na importação" });
  await form
    .getByLabel("Nome da turma", { exact: true })
    .fill("Turma criada na importação");
  await form.getByLabel("Professor", { exact: true }).selectOption("p2");
  await form
    .getByLabel("Dias e horário", { exact: true })
    .fill("Ter e Qui 10h");
  await form
    .getByLabel("Curso ou pacote de referência", { exact: true })
    .selectOption("o2");
  await form
    .getByRole("button", { name: "Criar turma e selecionar", exact: true })
    .click();
  await expect(form).toHaveCount(0);
  const group = schoolApi.store.classes.find(
    (c) => c.name === "Turma criada na importação",
  )!;
  expect(group).toBeTruthy();
  await expect(dialog.getByLabel("Turma de destino")).toHaveValue(group.id);
  await expect(dialog.getByLabel("Lista de alunos para colar")).toHaveValue(
    text,
  );
  await expect(
    dialog.getByRole("button", { name: "Importar 2 alunos", exact: true }),
  ).toBeEnabled();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await dialog
    .getByRole("button", { name: "Importar 2 alunos", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  expect(
    schoolApi.store.students
      .filter((s) => s.class_id === group.id)
      .map((s) => s.name),
  ).toEqual(["Lista Nova Ana", "Lista Novo Pedro"]);
});

test("Excel sem coluna Turma usa o destino e preserva telefones do responsável", async ({
  page,
}) => {
  const { default: writeXlsxFile } = await import("write-excel-file/node");
  const buffer = await writeXlsxFile([
    ["Nome", "Telefone", "Responsável", "Telefone do responsável"],
    ["Aluno Excel Destino", "71999991234", "Paula Responsável", "71999994321"],
  ]).toBuffer();
  await page.getByRole("button", { name: "Alunos", exact: true }).click();
  await page
    .getByRole("button", { name: "Importar alunos", exact: true })
    .click();
  const dialog = page.getByRole("dialog", { name: "Importar alunos em massa" });
  await dialog.getByLabel("Unidade da importação").selectOption("u1");
  await dialog.getByLabel("Turma de destino").selectOption("c2");
  await dialog.getByLabel("Arquivo Excel de alunos").setInputFiles({
    name: "destino.xlsx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer,
  });
  await expect(
    dialog.getByRole("button", { name: "Importar 1 alunos", exact: true }),
  ).toBeEnabled();
  await dialog
    .getByRole("button", { name: "Importar 1 alunos", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  const student = schoolApi.store.students.find(
    (s) => s.name === "Aluno Excel Destino",
  )!;
  expect(student.class_id).toBe("c2");
  expect(student.guardian_phone).toBe("71999994321");
  expect(student.guardian).toBe("Paula Responsável");
});

test("lista de alunos inicia com ativos em ordem alfabética, início informado e contato próprio", async ({
  page,
}) => {
  const student = schoolApi.store.students.find((s) => s.id === "s1")!;
  Object.assign(student, {
    course_start_date: "2026-09-01",
    phone: "71999991234",
    opening_hours: 10,
  });
  schoolApi.store.offerings.find(
    (o) => o.id === student.offering_id,
  )!.total_hours = 200;
  await page.reload();
  await page.getByRole("button", { name: "Alunos", exact: true }).click();
  await expect(page.getByLabel("Filtrar situação da matrícula")).toHaveValue(
    "ativo",
  );
  const rows = page.locator(".table-scroll tbody tr");
  const names = await rows.locator(".student-link").allTextContents();
  expect(names).toEqual(
    [...names].sort((a, b) =>
      a.localeCompare(b, "pt-BR", { numeric: true, sensitivity: "base" }),
    ),
  );
  await expect(rows).toHaveCount(14);
  const row = rows.filter({ hasText: "Gabriel Almeida" });
  await expect(row).toContainText("Desde 01/09/2026");
  await expect(row).toContainText("10 h de 200 h");
  await expect(row.getByRole("progressbar")).toHaveAttribute(
    "aria-valuenow",
    "5",
  );
  await expect(row).not.toContainText(student.guardian);
  await expect(
    row.getByRole("link", { name: "WhatsApp de Gabriel Almeida" }),
  ).toHaveAttribute(
    "href",
    "https://web.whatsapp.com/send?phone=5571999991234",
  );
  await page
    .getByLabel("Filtrar situação da matrícula")
    .selectOption("conclusao");
  await expect(rows).toHaveCount(1);
});

test("ocorrências coletivas e individuais persistem sem aparecer no WhatsApp da turma", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Chamada", exact: true }).click();
  await page.getByLabel("Turma", { exact: true }).selectOption("c1");
  await page.getByLabel("Data da aula").fill("2026-10-21");
  await page.getByLabel("Conteúdo trabalhado").fill("Atividade supervisionada");
  await page
    .getByRole("button", { name: "Todos presentes", exact: true })
    .click();
  await page.locator(".occurrence-editor > summary").click();
  await page.setViewportSize({ width: 390, height: 844 });
  const checkbox = page.getByLabel("Conversa excessiva", { exact: true });
  expect((await checkbox.boundingBox())!.height).toBeLessThanOrEqual(20);
  expect((await checkbox.locator("..").boundingBox())!.height).toBeLessThan(60);
  await checkbox.check();
  await page.setViewportSize({ width: 1280, height: 900 });
  await page
    .getByRole("button", { name: "Ocorrência de Gabriel Almeida", exact: true })
    .click();
  const individualOccurrence = page.getByRole("dialog", {
    name: "Ocorrência individual",
    exact: true,
  });
  await expect(individualOccurrence).toContainText("Gabriel Almeida");
  await individualOccurrence
    .getByLabel("Uso excessivo do celular", { exact: true })
    .check();
  await individualOccurrence
    .getByLabel("Não realizou a atividade proposta", { exact: true })
    .check();
  await individualOccurrence
    .getByLabel("Outra ocorrência ou detalhes")
    .fill("Orientação individual registrada");
  await individualOccurrence
    .getByRole("button", { name: "OK", exact: true })
    .click();
  await page
    .getByRole("button", {
      name: "Finalizar chamada e gerar resumo",
      exact: true,
    })
    .click();
  const message = page.getByRole("dialog");
  await expect(message.locator(".whatsapp-bubble")).not.toContainText(
    "Orientação individual",
  );
  await expect(message.locator(".whatsapp-bubble")).not.toContainText(
    "Conversa excessiva",
  );
  expect(schoolApi.store.occurrences).toHaveLength(2);
  await message
    .getByRole("button", { name: "Fechar mensagem", exact: true })
    .click();
  await page.reload();
  await page.getByRole("button", { name: "Alunos", exact: true }).click();
  await page
    .getByRole("button", { name: "Gabriel Almeida", exact: true })
    .click();
  const dossier = page.getByRole("dialog", { name: "Gabriel Almeida" });
  await dossier.getByRole("tab", { name: "Ocorrências", exact: true }).click();
  await expect(dossier).toContainText("Orientação individual registrada");
  await expect(dossier).toContainText("Conversa excessiva");
  await dossier
    .getByRole("button", { name: "Evolução ao responsável", exact: true })
    .click();
  await expect(
    page.getByRole("dialog").locator(".whatsapp-bubble"),
  ).toContainText("Orientação individual registrada");
  await page
    .getByRole("button", { name: "Fechar mensagem", exact: true })
    .click();
  await page.getByRole("button", { name: "Turmas", exact: true }).click();
  const row = page
    .locator(".class-directory tbody tr")
    .filter({ hasText: "Informática • Turma 01" });
  await row
    .getByRole("button", { name: "Ocorrências (2)", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toContainText("Gabriel Almeida");
  await expect(page.getByRole("dialog")).toContainText("Conversa excessiva");
});

test("turmas têm ordem natural, filtros por vagas e ocorrências e lotação verde", async ({
  page,
}) => {
  Object.assign(
    schoolApi.store.classes.find((c) => c.id === "c1")!,
    { name: "Turma 10", capacity: 7 },
  );
  Object.assign(
    schoolApi.store.classes.find((c) => c.id === "c2")!,
    { name: "Turma 2", capacity: 30 },
  );
  Object.assign(
    schoolApi.store.classes.find((c) => c.id === "c3")!,
    { name: "Turma 1", capacity: 10 },
  );
  schoolApi.store.occurrences.push({
    id: "otest",
    lesson_id: "l1",
    unit_id: "u1",
    student_id: "s1",
    codes: ["phone"],
    notes: "",
    author_id: "p2",
    author_name: "Ana",
  });
  await page.reload();
  await page.getByRole("button", { name: "Turmas", exact: true }).click();
  await page.getByLabel("Filtrar unidade").selectOption("u1");
  const rows = page.locator(".class-directory tbody tr");
  expect(
    await rows.locator("td:first-child > strong").allTextContents(),
  ).toEqual(["Turma 1", "Turma 2", "Turma 10"]);
  await page
    .getByLabel("Ordenar turmas", { exact: true })
    .selectOption("more-vacancies");
  await expect(rows.first()).toContainText("Turma 2");
  await page
    .getByLabel("Ordenar turmas", { exact: true })
    .selectOption("incidents");
  await expect(rows.first()).toContainText("Turma 10");
  await page
    .getByLabel("Filtrar turmas", { exact: true })
    .selectOption("incidents");
  await expect(rows).toHaveCount(1);
  expect(
    await rows
      .first()
      .locator(".occupancy-meter")
      .evaluate((el) =>
        getComputedStyle(el).getPropertyValue("--occupancy-color"),
      ),
  ).toBe("#218361");
});

test("ocorrência do aluno abre na linha, confirma ou cancela sem mudar presença e não mistura a sala", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Chamada", exact: true }).click();
  await page.getByLabel("Data da aula").fill("2026-10-21");
  const row = page
    .locator(".attendance-row")
    .filter({ hasText: "Gabriel Almeida" });
  await row.getByRole("button", { name: "Presente", exact: true }).click();
  expect(
    await row.locator(".attendance-options button").allTextContents(),
  ).toEqual(
    expect.arrayContaining([
      expect.stringContaining("Justificado"),
      expect.stringContaining("Ocorrência"),
    ]),
  );
  const labels = await row
    .locator(".attendance-options button")
    .allTextContents();
  expect(labels[3]).toContain("Justificado");
  expect(labels[4]).toContain("Ocorrência");
  const launch = row.getByRole("button", {
    name: "Ocorrência de Gabriel Almeida",
    exact: true,
  });
  await launch.click();
  const dialog = page.getByRole("dialog", {
    name: "Ocorrência individual",
    exact: true,
  });
  await expect(dialog).toContainText("Gabriel Almeida");
  await expect(dialog.locator("select")).toHaveCount(0);
  await dialog.getByLabel("Uso excessivo do celular", { exact: true }).check();
  await dialog.getByRole("button", { name: "Cancelar", exact: true }).click();
  await expect(launch).not.toHaveClass(/has-record/);
  await expect(row).toHaveClass(/marked-presente/);
  await launch.click();
  await expect(
    dialog.getByLabel("Uso excessivo do celular", { exact: true }),
  ).not.toBeChecked();
  await dialog.getByLabel("Uso excessivo do celular", { exact: true }).check();
  await dialog.getByLabel("Conversa excessiva", { exact: true }).check();
  await dialog
    .getByLabel("Outra ocorrência ou detalhes")
    .fill("Orientação apenas deste aluno");
  await dialog.getByRole("button", { name: "OK", exact: true }).click();
  await expect(launch).toHaveClass(/has-record/);
  await expect(
    row.getByRole("button", { name: "Presente", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.locator(".occurrence-editor > summary").click();
  await expect(page.getByLabel("Registrar ocorrência para")).toHaveCount(0);
  await expect(
    page
      .locator(".occurrence-editor")
      .getByLabel("Conversa excessiva", { exact: true }),
  ).not.toBeChecked();
  await launch.click();
  await expect(dialog.getByLabel("Outra ocorrência ou detalhes")).toHaveValue(
    "Orientação apenas deste aluno",
  );
  await dialog.getByRole("button", { name: "Limpar", exact: true }).click();
  await dialog.getByRole("button", { name: "OK", exact: true }).click();
  await expect(launch).not.toHaveClass(/has-record/);
});

test("operação prioriza gestão, filtra período e abre ações sem expor o diário inteiro", async ({
  page,
}) => {
  await expect(
    page.locator(".operational-class-directory"),
  ).not.toHaveAttribute("open", "");
  await expect(page.locator(".class-register")).not.toBeVisible();
  await expect(page.locator(".management-metric")).toHaveCount(4);
  await expect(
    page.getByRole("region", { name: "Prioridades de acompanhamento" }),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Presença e faltas no período" }),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Oportunidades de matrícula" }),
  ).toBeVisible();
  await page.getByLabel("Período do painel").selectOption("7");
  await page.getByRole("button", { name: /Faltas no período/ }).click();
  await expect(
    page
      .getByRole("button", { name: "Faltas", exact: false })
      .filter({ hasText: "Faltas" })
      .last(),
  ).toBeVisible();
  await page
    .getByRole("button", {
      name: "Matricular em Informática • Turma 01",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("dialog").getByLabel("Turma", { exact: true }),
  ).toHaveValue("c1");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Fechar", exact: true })
    .click();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("calendário seleciona intervalo por clique e ficha anual inclui dias sem aula", async ({
  page,
}) => {
  schoolApi.store.classes.find((c) => c.id === "c1")!.lesson_days = [2, 4];
  await page.reload();
  await page
    .getByRole("button", { name: "Calendário escolar", exact: true })
    .click();
  await page.getByRole("button", { name: "Ver 2027", exact: true }).click();
  await expect(
    page.getByRole("button", {
      name: /01\/01\/2027 — Confraternização Universal/,
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "11/01/2027", exact: true }).click();
  await page.getByRole("button", { name: "15/01/2027", exact: true }).click();
  await expect(page.getByLabel("Início do período sem aula")).toHaveValue(
    "2027-01-11",
  );
  await expect(page.getByLabel("Fim do período sem aula")).toHaveValue(
    "2027-01-15",
  );
  await page
    .getByLabel("Motivo do dia sem aula")
    .fill("Recesso da turma em janeiro");
  await page.getByLabel("Abrangência do período").selectOption("c1");
  await page
    .getByRole("button", { name: "Salvar período", exact: true })
    .click();
  await expect(page.locator(".calendar-event-list")).toContainText(
    "Recesso da turma em janeiro",
  );
  const event = schoolApi.store.calendar_events.find(
    (e) => e.title === "Recesso da turma em janeiro",
  )!;
  expect(event.class_id).toBe("c1");
  expect(event.unit_id).toBe("u1");
  await page.getByRole("button", { name: "Relatórios", exact: true }).click();
  const builder = page.getByRole("region", {
    name: "Emissão da ficha avaliativa",
  });
  await builder.getByLabel("Aluno da ficha avaliativa").selectOption("s1");
  await builder.getByLabel("Mês inicial da ficha").fill("2027-01");
  await builder.getByLabel("Mês final da ficha").fill("2027-12");
  await builder.locator(".signature-schedule-preview > summary").click();
  await expect(builder).toContainText("Recesso da turma em janeiro");
  await expect(builder).toContainText("Independência do Brasil");
  const pending = page.waitForEvent("download");
  await builder
    .getByRole("button", { name: "Baixar ficha avaliativa PDF", exact: true })
    .click();
  const download = await pending;
  expect(download.suggestedFilename()).toContain(
    "ficha-avaliativa-Gabriel-Almeida-2027-01-2027-12.pdf",
  );
  const { readFile } = await import("node:fs/promises");
  const bytes = await readFile((await download.path())!);
  expect(bytes.subarray(0, 4).toString()).toBe("%PDF");
  expect(
    (bytes.toString("latin1").match(/\/Type \/Page\b/g) || []).length,
  ).toBeGreaterThan(1);
});

test("calendário permite editar, desativar e excluir períodos e cabe no celular", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Abrir menu", exact: true }).click();
  await page
    .getByRole("button", { name: "Calendário escolar", exact: true })
    .click();
  await page.getByLabel("Motivo do dia sem aula").fill("Recesso editável");
  await page.getByLabel("Início do período sem aula").fill("2027-07-01");
  await page.getByLabel("Fim do período sem aula").fill("2027-07-15");
  await page
    .getByRole("button", { name: "Salvar período", exact: true })
    .click();
  let row = page
    .locator(".calendar-event-list article")
    .filter({ hasText: "Recesso editável" });
  await expect(row).toBeVisible();
  await row.getByRole("button", { name: "Desativar", exact: true }).click();
  await expect(row).toContainText("Não aplicado");
  await row
    .getByRole("button", { name: "Editar Recesso editável", exact: true })
    .click();
  await page.getByLabel("Motivo do dia sem aula").fill("Recesso atualizado");
  await page
    .getByRole("button", { name: "Salvar período", exact: true })
    .click();
  row = page
    .locator(".calendar-event-list article")
    .filter({ hasText: "Recesso atualizado" });
  await expect(row).toBeVisible();
  await row
    .getByRole("button", { name: "Excluir Recesso atualizado", exact: true })
    .click();
  await expect(row).toHaveCount(0);
  expect(
    schoolApi.store.calendar_events.some(
      (e) => e.title === "Recesso atualizado",
    ),
  ).toBe(false);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("professor consulta calendário e só escolhe alunos da própria unidade para ficha", async ({
  page,
}) => {
  await page.getByTitle("Sair", { exact: true }).click();
  await login(page, "ana.oliveira");
  await page
    .getByRole("button", { name: "Calendário escolar", exact: true })
    .click();
  await page.getByRole("button", { name: "Ver 2027", exact: true }).click();
  await expect(page.locator(".calendar-event-list")).toContainText(
    "Confraternização Universal",
  );
  await expect(
    page.getByRole("button", { name: "Salvar período", exact: true }),
  ).toHaveCount(0);
  await expect(page.locator(".calendar-event-actions")).toHaveCount(0);
  await page.getByRole("button", { name: "Relatórios", exact: true }).click();
  const select = page.getByLabel("Aluno da ficha avaliativa");
  await expect(select.locator('option[value="s14"]')).toHaveCount(0);
  await select.selectOption("s1");
  await expect(page.locator(".signature-student-summary")).toContainText(
    "Gabriel Almeida",
  );
});

for (const viewport of [
  { width: 1280, height: 900 },
  { width: 390, height: 844 },
]) {
  test(`atualização mantém chamada e ocorrência em edição (${viewport.width}px)`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    if (viewport.width < 600) {
      await page.getByRole("button", { name: "Abrir menu" }).click();
    }
    await page
      .locator("nav")
      .getByRole("button", { name: "Chamada", exact: true })
      .click();
    await page.getByLabel("Data da aula").fill("2026-10-21");
    await page
      .getByLabel("Conteúdo trabalhado")
      .fill("Conteúdo antes da atualização");
    await page
      .getByRole("button", { name: "Todos presentes", exact: true })
      .click();
    const row = page
      .locator(".attendance-row")
      .filter({ hasText: "Gabriel Almeida" });
    await row.getByRole("button", { name: "Atrasado", exact: true }).click();
    const delay = page.getByRole("dialog", { name: "Registrar atraso" });
    await delay
      .getByLabel("Horário de chegada de Gabriel Almeida")
      .fill("14:15");
    await delay.getByRole("button", { name: "OK", exact: true }).click();
    await page.locator(".occurrence-editor > summary").click();
    await page
      .locator(".occurrence-editor")
      .getByLabel("Conversa excessiva", { exact: true })
      .check();
    await row
      .getByRole("button", {
        name: "Ocorrência de Gabriel Almeida",
        exact: true,
      })
      .click();
    const occurrence = page.getByRole("dialog", {
      name: "Ocorrência individual",
      exact: true,
    });
    await occurrence
      .getByLabel("Uso excessivo do celular", { exact: true })
      .check();
    await occurrence
      .getByLabel("Outra ocorrência ou detalhes")
      .fill("Orientação em andamento");
    // A data refresh can complete while the dialog is open (e.g. session renewal).
    const loaded = page.waitForResponse(
      (response) =>
        response.url().includes("/rest/v1/calendar_events") &&
        response.request().method() === "GET",
    );
    await page
      .getByTitle("Atualizar dados", { exact: true })
      .evaluate((button: HTMLButtonElement) => button.click());
    await loaded;
    await expect(
      page.getByTitle("Atualizar dados", { exact: true }),
    ).toBeEnabled();
    await expect(
      occurrence.getByLabel("Outra ocorrência ou detalhes"),
    ).toHaveValue("Orientação em andamento");
    await expect(
      occurrence.getByLabel("Uso excessivo do celular", { exact: true }),
    ).toBeChecked();
    await occurrence.getByRole("button", { name: "OK", exact: true }).click();
    await expect(page.getByLabel("Conteúdo trabalhado")).toHaveValue(
      "Conteúdo antes da atualização",
    );
    await expect(row).toHaveClass(/marked-atrasado/);
    await expect(
      page
        .locator(".occurrence-editor")
        .getByLabel("Conversa excessiva", { exact: true }),
    ).toBeChecked();
    await page
      .getByRole("button", {
        name: "Finalizar chamada e gerar resumo",
        exact: true,
      })
      .click();
    await expect(
      page.getByRole("dialog", { name: "Resumo da aula" }),
    ).toBeVisible();
    const lesson = schoolApi.store.lessons.find(
      (item) => item.date === "2026-10-21" && item.class_id === "c1",
    )!;
    expect(lesson.topic).toBe("Conteúdo antes da atualização");
    expect(
      schoolApi.store.attendance.find(
        (item) => item.lesson_id === lesson.id && item.student_id === "s1",
      )?.arrival_time,
    ).toBe("14:15");
    expect(
      schoolApi.store.occurrences.filter(
        (item) => item.lesson_id === lesson.id,
      ),
    ).toHaveLength(2);
  });
}

test("nova chamada limpa a tela sem apagar registros e marcações coletivas têm cores", async ({
  page,
}) => {
  schoolApi.store.students.find((student) => student.id === "s1")!.name =
    "Alice de Souza Santos";
  await page.getByTitle("Atualizar dados", { exact: true }).click();
  await expect(
    page.getByTitle("Atualizar dados", { exact: true }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Chamada", exact: true }).click();
  await page.getByLabel("Data da aula").fill("2026-10-22");
  await page.getByLabel("Conteúdo trabalhado").fill("Atividade de revisão");
  const absent = page.getByRole("button", {
    name: "Todos ausentes",
    exact: true,
  });
  const present = page.getByRole("button", {
    name: "Todos presentes",
    exact: true,
  });
  expect(
    await absent.evaluate(
      (element) => getComputedStyle(element).backgroundColor,
    ),
  ).toBe("rgb(252, 236, 237)");
  expect(
    await present.evaluate(
      (element) => getComputedStyle(element).backgroundColor,
    ),
  ).toBe("rgb(232, 245, 237)");
  await absent.click();
  await expect(page.locator(".attendance-row:not(.marked-falta)")).toHaveCount(
    0,
  );
  await page
    .getByRole("button", {
      name: "Finalizar chamada e gerar resumo",
      exact: true,
    })
    .click();
  await expect(page.getByLabel("Mensagem para WhatsApp")).toHaveValue(
    /Alice de Souza — Falta/,
  );
  await page
    .getByRole("button", { name: "Fechar mensagem", exact: true })
    .click();
  const saved = schoolApi.store.attendance.length;
  await page.getByRole("button", { name: "Nova chamada", exact: true }).click();
  await expect(page.getByLabel("Data da aula")).toHaveValue("");
  await expect(page.getByLabel("Conteúdo trabalhado")).toHaveValue("");
  await expect(page.locator(".attendance-row[class*=marked-]")).toHaveCount(0);
  expect(schoolApi.store.attendance.length).toBe(saved);
  await page.getByLabel("Data da aula").fill("2026-10-23");
  await present.click();
  await expect(
    page.locator(".attendance-row:not(.marked-presente)"),
  ).toHaveCount(0);
  await page.getByLabel("Data da aula").fill("2026-10-22");
  await expect(page.getByLabel("Conteúdo trabalhado")).toHaveValue(
    "Atividade de revisão",
  );
  await expect(page.locator(".attendance-row:not(.marked-falta)")).toHaveCount(
    0,
  );
});

test("ficha permite excluir dias do PDF sem alterar o calendário", async ({
  page,
}) => {
  schoolApi.store.classes.find((course) => course.id === "c1")!.lesson_days = [
    2, 4,
  ];
  await page.getByTitle("Atualizar dados", { exact: true }).click();
  await expect(
    page.getByTitle("Atualizar dados", { exact: true }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Relatórios", exact: true }).click();
  const builder = page.getByRole("region", {
    name: "Emissão da ficha avaliativa",
  });
  await builder.getByLabel("Aluno da ficha avaliativa").selectOption("s1");
  await builder.getByLabel("Mês inicial da ficha").fill("2027-09");
  await builder.getByLabel("Mês final da ficha").fill("2027-09");
  await builder.locator(".signature-schedule-preview > summary").click();
  const dates = builder.locator(".signature-date-toggle input");
  const count = await dates.count();
  await builder
    .getByLabel("Incluir 02/09/2027 na ficha", { exact: true })
    .uncheck();
  await builder
    .getByLabel("Incluir 07/09/2027 na ficha", { exact: true })
    .uncheck();
  await expect(builder.locator(".signature-date-count")).toContainText(
    `${count - 2} datas`,
  );
  const download = page.waitForEvent("download");
  await builder
    .getByRole("button", { name: "Baixar ficha avaliativa PDF", exact: true })
    .click();
  const file = await download;
  const { execFileSync } = await import("node:child_process");
  const text = execFileSync("pdftotext", [(await file.path())!, "-"], {
    encoding: "utf8",
  });
  expect(text).not.toContain("02/09/2027");
  expect(text).not.toContain("07/09/2027");
  expect(text).toContain("09/09/2027");
  expect(
    schoolApi.store.calendar_events.some(
      (event) => event.start_date === "2027-09-07",
    ),
  ).toBe(true);
  await builder
    .getByRole("button", { name: "Incluir todas as datas", exact: true })
    .click();
  await expect(
    builder.locator(".signature-date-toggle input:not(:checked)"),
  ).toHaveCount(0);
  await expect(builder.locator(".signature-date-count")).toContainText(
    `${count} datas`,
  );
  for (let i = 0; i < count; i++) await dates.nth(i).uncheck();
  await expect(
    builder.getByRole("button", {
      name: "Baixar ficha avaliativa PDF",
      exact: true,
    }),
  ).toBeDisabled();
  await builder.getByLabel("Aluno da ficha avaliativa").selectOption("s2");
  await expect(builder.locator(".signature-date-count")).toContainText(
    `${count} datas`,
  );
});
