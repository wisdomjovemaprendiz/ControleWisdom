# Wisdom Cursos — gestão educacional

Next.js + TypeScript e Supabase para cursos preparatórios, cursos individuais e pacotes. A identidade usa a marca Wisdom em azul e vermelho. O aplicativo exige autenticação real e não possui modo demonstração nem cadastros fictícios.

## Configurar para uso real

Requer Node.js 24 e npm 11. Configure as variáveis de `.env.example` nos campos seguros do ambiente e na Vercel. Nunca envie chaves ou senhas pelo chat nem adicione `.env.local` ao Git.

| Variável                          | Uso                                                             |
| --------------------------------- | --------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`        | URL pública do projeto                                          |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`   | Chave pública anon/publishable                                  |
| `SUPABASE_SERVICE_ROLE_KEY`       | Somente servidor: administração das contas                      |
| `CRON_SECRET`                     | Segredo aleatório de pelo menos 32 caracteres, somente servidor |
| `SUPABASE_ACCESS_TOKEN`           | Somente provisionamento: token pessoal com acesso ao projeto    |
| `WISDOM_BOOTSTRAP_ADMIN_PASSWORD` | Somente criação do primeiro administrador, mínimo 6 caracteres  |

Somente as duas variáveis `NEXT_PUBLIC_*` podem estar no navegador. As demais nunca recebem esse prefixo. O token administrativo e a senha de bootstrap não são necessários na Vercel após a configuração inicial.

```sh
npm ci --no-audit --no-fund
npm run db:provision
npm run admin:bootstrap
npm run dev
```

`db:provision` aplica as migrações 001 a 004, registra as versões aplicadas e desativa inscrições públicas no Supabase Auth. Não apaga alunos. Recusa um esquema parcial ou existente sem registro. Para um banco que já tenha recebido integralmente 001/002, revise as migrações anteriores e use `npm run db:provision -- --adopt-existing`; essa opção adota a base existente e aplica as restantes. Não reexecute 001 manualmente em um banco existente. Em ambientes com proxy HTTP, use `NODE_USE_ENV_PROXY=1` nesses comandos.

Como alternativa ao provisionador, em um projeto vazio execute os quatro arquivos `supabase/00*.sql`, em ordem, no SQL Editor e desative novos cadastros públicos em Authentication. Execute depois o bootstrap com a chave de servidor configurada.

`admin:bootstrap` cria o login **admin**, na **Unidade Principal**, com troca obrigatória da senha no primeiro acesso. Não cria outro administrador se já existir um. É possível definir previamente `WISDOM_BOOTSTRAP_ADMIN_LOGIN` e `WISDOM_BOOTSTRAP_UNIT_NAME`. A senha vem exclusivamente do campo seguro; `1710` não é aceita porque o Supabase exige pelo menos seis caracteres. Não existe senha padrão embutida no código.

Após entrar e trocar a senha, o administrador cadastra os funcionários em **Equipe e acesso**, definindo nome, login, senha inicial, perfil e unidade. Não é necessário e-mail nem copiar UUIDs. O sistema usa identificadores internos reservados para integrar o login por usuário ao Supabase Auth; não envia mensagens de e-mail. Cada nova conta ou redefinição exige uma senha pessoal antes de consultar os alunos. Desativar o funcionário bloqueia os dados pela RLS. A senha não aparece na listagem. O administrador redefine senhas iniciais de outros funcionários; cada usuário altera sua própria senha.

Cadastre unidades, equipe, cursos/pacotes, turmas e alunos. A instalação não insere dados de exemplo. Antes de liberar o uso, valide o login real, dois funcionários de unidades diferentes, matrícula, upload de foto, chamada e PDF no projeto Supabase.

## Permissões

| Ação                                      | Professor         | Secretaria  | Coordenação | Administrador |
| ----------------------------------------- | ----------------- | ----------- | ----------- | ------------- |
| Consultar alunos e registros              | Sua unidade       | Sua unidade | Todas       | Todas         |
| Matrícula e edição cadastral              | Sua unidade       | Sua unidade | Todas       | Todas         |
| Cursos/pacotes e turmas                   | Consulta          | Sua unidade | Todas       | Todas         |
| Chamada e pedagógico                      | Turmas atribuídas | Consulta    | Todas       | Todas         |
| Contatos por faltas                       | Sua unidade       | Sua unidade | Todas       | Todas         |
| Arquivar/reativar                         | Não               | Sua unidade | Todas       | Todas         |
| Unidades e relatórios gerais              | Não               | Não         | Sim         | Sim           |
| Criar/desativar contas e redefinir senhas | Não               | Não         | Não         | Sim           |

A RLS aplica as restrições no banco. As APIs administrativas validam o token com o Supabase e consultam o perfil ativo no servidor. Alteração direta de perfis pelo navegador é bloqueada. O último administrador ativo não pode ser removido, e ninguém desativa ou rebaixa a própria conta pela API. Eventos administrativos são auditados sem senhas.

## Cadastro, fotos e acompanhamento

Em **Alunos → Importar Excel**, baixe o modelo e envie `.xlsx` com **Nome** e **Turma**; **Data de nascimento** é opcional. A primeira aba aceita até 500 alunos e 5 MB. Use turma existente na unidade selecionada. A revisão sinaliza erros, duplicidades e vagas insuficientes antes da confirmação. O lote é transacional. Os demais dados podem ser completados depois, sem telefones fictícios. Após falha de rede, atualize a lista antes de repetir uma importação cuja gravação possa ter ocorrido.

O cadastro aceita JPEG, PNG ou WebP até 10 MB. A imagem é recortada em quadrado, reduzida para no máximo 512 × 512 e comprimida para **até 100 KB antes do envio**. Fica em bucket privado, com acesso por unidade e URLs temporárias. A foto aparece junto ao aluno nas listas, chamada, ficha, acompanhamento e relatórios de alunos. Sem foto, aparecem iniciais. Substituição tenta remover o arquivo anterior; falha nessa limpeza não desfaz a matrícula salva.

Nascimento alimenta alertas de hoje e da semana (segunda a domingo, São Paulo), apenas para alunos ativos das unidades permitidas. Datas ausentes não são estimadas. A ficha reúne evolução, intervenções, chamadas e contatos. Há alertas por três faltas acumuladas e retornos agendados.

## Chamada, WhatsApp e PDFs

A chamada registra presentes, faltosos, atrasados e justificativas, conteúdo, data e professor de forma atômica. Ao finalizar, **Compartilhar chamada no grupo** prepara mensagem revisável com os dois primeiros nomes de presentes e atrasados, cabeçalho e sintaxe de formatação do WhatsApp. Alterações pendentes devem ser salvas antes de compartilhar. A equipe copia o texto ou abre o WhatsApp e escolhe o grupo. Não há envio automático.

Os PDFs institucionais incluem logo, fontes com acentos, cabeçalhos, tabelas, fotos disponíveis e paginação. Relatórios internos mantêm nomes completos e todas as situações da chamada. Fotos são incorporadas ao arquivo, sem expor suas URLs temporárias. Homônimos não recebem fotos por correspondência de nome ambígua. A evolução individual pode ser compartilhada manualmente com o responsável.

Frequência = (presenças + atrasos) / (presenças + atrasos + faltas); justificativas ficam fora do denominador. Sem chamadas, não há percentual. Ocupação abaixo de 40% é destacada. O gráfico de matrículas agrupa pela data de entrada e situação atual; não inventa datas de cancelamento. Inadimplência é uma situação administrativa, sem cobrança bancária nesta versão.

## Análise diária e Vercel

Importe `wisdomjovemaprendiz/ControleWisdom` na Vercel, framework Next.js, Node 24, instalação `npm ci` e build `npm run build`. Configure as duas variáveis públicas, `SUPABASE_SERVICE_ROLE_KEY` e `CRON_SECRET` no projeto. Novas variáveis públicas exigem novo build. As migrações e o primeiro administrador devem existir antes de liberar o uso.

`vercel.json` agenda `/api/cron/daily-analysis` diariamente às 10h UTC (7h de São Paulo), após deploy de produção. A Vercel envia `Authorization: Bearer CRON_SECRET`; a rota exige segredo de pelo menos 32 caracteres. A análise grava por unidade: alunos ativos, novas matrículas, arquivados, turmas, ociosidade, presença, faltas, atrasos e cadastros incompletos. Reexecuções atualizam o mesmo dia. Coordenação e administrador consultam os registros em Relatórios. Não são fabricados dias anteriores nem alunos para gerar atividade.

Confirme a primeira execução nos logs da Vercel e na tabela `daily_analytics`. A rotina depende de deploy, segredo e banco disponível; não garante que um projeto gratuito do Supabase nunca seja pausado. Para disponibilidade contínua garantida pelo serviço, use um plano que não pause por inatividade.

## Desenvolvimento e testes

```sh
npm test
npm run build
npm run start
```

Os testes executam regras de domínio, APIs e as migrações reais em PostgreSQL embarcado com RLS, Auth e Storage simulados. Não usam credenciais remotas nem substituem a validação no Supabase real.

Os testes de navegador usam exclusivamente respostas de rede isoladas, mantendo a tela de login real. Inicie um processo separado, sem alterar as configurações reais:

```sh
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 NEXT_PUBLIC_SUPABASE_ANON_KEY=isolated-test-public-key npm run dev -- --port 3002
# Outro terminal:
PLAYWRIGHT_BASE_URL=http://127.0.0.1:3002 npm run test:e2e
```

O Chromium deste ambiente fica em `/usr/bin/chromium`; ajuste `playwright.config.ts` em outra máquina. Fixtures de alunos existem somente em `tests/`, fora do aplicativo. A referência visual e decisões anteriores estão em [docs/redesenho-operacional.md](docs/redesenho-operacional.md). Marca e fontes estão em `public/`, com licenças em `public/licenses/`.
