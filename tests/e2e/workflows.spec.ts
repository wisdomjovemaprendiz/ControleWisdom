import { test, expect } from "@playwright/test";
import { installSchoolApi, login } from "../support/supabase";
let schoolApi: Awaited<ReturnType<typeof installSchoolApi>>;
test.beforeEach(async ({ page }) => {
  schoolApi = await installSchoolApi(page);
  await page.goto("/");
  await login(page);
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
    .getByRole("button", { name: "Importar Excel", exact: true })
    .click();
  const dialog = page.getByRole("dialog", { name: "Importar alunos do Excel" });
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
    .getByRole("button", { name: "Importar Excel", exact: true })
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
  await dialog
    .getByLabel("Pontuação: Demora a iniciar após a orientação coletiva", {
      exact: true,
    })
    .selectOption("2");
  await dialog
    .getByLabel("Dividir a tarefa em etapas observáveis", { exact: true })
    .check();
  await dialog
    .getByLabel("Contexto e período observado", { exact: true })
    .fill("Atividade de planejamento de currículo, em duas aulas.");
  await dialog
    .getByLabel("Situação inicial / linha de base", { exact: true })
    .fill("Precisou de três lembretes para iniciar.");
  await dialog
    .getByLabel("Objetivo do acompanhamento", { exact: true })
    .fill("Iniciar com apenas um lembrete.");
  await dialog
    .getByLabel("Critério para avaliar a evolução", { exact: true })
    .fill("Comparar os apoios necessários em duas atividades equivalentes.");
  await dialog
    .getByRole("button", {
      name: "Preparar rascunho para revisão",
      exact: true,
    })
    .click();
  await expect(dialog.getByLabel("Observações e evolução")).toHaveValue(
    /três lembretes/,
  );
  await expect(dialog.getByLabel("Intervenção / próximo passo")).toHaveValue(
    /Dividir a tarefa/,
  );
  const day = await page.evaluate(() =>
    new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(
      new Date(),
    ),
  );
  await dialog
    .getByLabel("Data para acompanhamento", { exact: true })
    .fill(day);
  await dialog
    .getByRole("button", { name: "Salvar registro", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  const parent = schoolApi.store.pedagogy.find(
    (p) =>
      p.support_plan?.baseline === "Precisou de três lembretes para iniciar.",
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
  await first.getByLabel(/Horário de chegada de/).fill("14:25");
  await second
    .getByRole("button", { name: "Justificado", exact: true })
    .click();
  await second.getByLabel(/Justificativa de/).fill("Consulta médica");
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
    page
      .locator(".attendance-row")
      .first()
      .getByLabel(/Horário de chegada de/),
  ).toHaveValue("14:25");
  await page
    .locator(".attendance-row")
    .first()
    .getByLabel(/Horário de chegada de/)
    .fill("");
  await page
    .locator(".attendance-row")
    .nth(1)
    .getByLabel(/Justificativa de/)
    .fill("");
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
  await expect(page.locator(".queue-list")).not.toContainText(
    "Atualização Comercial",
  );
  await page.clock.fastForward(61000);
  await expect(page.locator(".queue-list")).toContainText(
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
  const row = page.locator("tbody tr").first();
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
