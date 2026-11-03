# Wisdom Cursos — gestão educacional

Aplicação Next.js + TypeScript para cursos preparatórios para jovem aprendiz, cursos individuais e pacotes. Identidade em azul e vermelho baseada na marca fornecida. Fontes hospedadas no próprio aplicativo.

## Desenvolvimento

Requer Node.js 24 e npm 11. O checkout esperado neste ambiente fica em `/workspace/ControleWisdom`.

```sh
npm ci --no-audit --no-fund
npm run dev
```

Sem as variáveis do Supabase, abre uma **demonstração identificada**, com dados fictícios persistidos no navegador. Em Equipe e acesso, é possível testar perfis e restaurar os dados. Não cadastre dados reais de alunos nesse modo. Dados de demonstração não são migrados para produção.

```sh
npm test             # domínio e PostgreSQL embarcado com RLS
npm run build        # compilação de produção e verificação TypeScript
npm run start        # inicia o build compilado
npm run test:e2e     # outro terminal, aplicação já iniciada na porta 3000
```

O Playwright usa Chromium em `/usr/bin/chromium` neste ambiente. Para outra máquina, ajuste `executablePath` em `playwright.config.ts` ou use o navegador instalado pelo Playwright. Os testes de navegador exigem modo demonstração, sem variáveis Supabase, e apagam apenas o armazenamento fictício de seu contexto isolado. O PostgreSQL embarcado simula `auth.users` e `auth.uid()` e executa a migração real, exceto `CREATE EXTENSION pgcrypto`, pois `gen_random_uuid()` é nativa. Não substitui a validação final no projeto Supabase real.

## Ativar Supabase

1. Crie um projeto Supabase. No SQL Editor, execute **uma vez** `supabase/001_schema.sql` em um projeto novo. A migração cria tabelas, relacionamentos, índices, RLS, auditoria e a operação atômica de chamada. Faça backup e revise o esquema antes de aplicar a um banco já existente.
2. Em Authentication → Users, crie a primeira conta da coordenação com e-mail confirmado e uma senha definida com segurança. Copie o UUID do usuário.
3. No SQL Editor, execute o modelo abaixo substituindo os valores indicados. Não inclua senhas neste SQL.

```sql
with new_unit as (
  insert into public.units(name,address)
  values ('Unidade Centro','Endereço da unidade') returning id
)
insert into public.profiles(id,name,role,unit_id)
select 'UUID_DO_USUARIO_AUTH'::uuid,'Nome da coordenação','coordenacao',id
from new_unit;
```

4. Configure as variáveis abaixo em `.env.local` no desenvolvimento e nas variáveis de ambiente do projeto na Vercel. Reinicie o desenvolvimento e gere um novo build após alterá-las. `NEXT_PUBLIC_*` é incorporado ao JavaScript no build.

```text
NEXT_PUBLIC_SUPABASE_URL=https://SEU-PROJETO.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=CHAVE_PUBLICA_ANON_OU_PUBLISHABLE
```

Use somente a chave **pública anon/publishable**. Nunca coloque `service_role`, chave secreta, senha do banco ou token administrativo em variáveis `NEXT_PUBLIC_*`. O login usa e-mail e senha via Supabase Auth; a aplicação não tem cadastro público de contas. Desative signups públicos nas configurações de Authentication se não forem utilizados. Configure o Site URL de produção no Supabase. Recuperação de senha deve ser feita administrativamente no Supabase nesta versão.

5. Entre com a conta de coordenação. Crie unidades e cadastre as contas da equipe em Authentication. Na tela Equipe e acesso, vincule o UUID de cada conta ao perfil e à unidade. A coordenação deve ser concedida apenas a responsáveis pela gestão da rede. Cadastre professores antes de criar turmas.
6. Cadastre cursos/pacotes, turmas e matrículas. Não há dados fictícios no banco real.
7. Valide com duas contas de unidades diferentes: professor e secretaria devem ver apenas sua própria unidade. Verifique também leitura, matrícula, chamada e PDF com dados de teste no projeto real antes de uso operacional.

### Permissões

| Ação                                  | Professor         | Secretaria  | Coordenação       |
| ------------------------------------- | ----------------- | ----------- | ----------------- |
| Consultar alunos, turmas e registros  | Sua unidade       | Sua unidade | Todas as unidades |
| Matrícula expressa e edição cadastral | Sua unidade       | Sua unidade | Todas             |
| Criar cursos/pacotes e turmas         | Não               | Sua unidade | Todas             |
| Chamada e registro pedagógico         | Turmas atribuídas | Consulta    | Todas             |
| Registrar contato por faltas          | Sua unidade       | Sua unidade | Todas             |
| Arquivar e reativar aluno             | Não               | Sua unidade | Todas             |
| Criar unidades e vincular perfis      | Não               | Não         | Sim               |

A restrição é aplicada por RLS no banco. A seleção de unidade e a troca de perfil da demonstração não concedem acesso em produção. Professores veem os registros da sua unidade e editam chamadas/pedagógico apenas nas turmas atribuídas. Registros de contato e pedagógicos são adicionados, preservando o histórico. Exclusões não são expostas. Matrículas arquivadas preservam dados e histórico; reativação respeita as vagas disponíveis. Transferência entre unidades exige novo vínculo; dentro da unidade, a secretaria pode editar a turma da matrícula. O campo `created_by` da matrícula é preservado pelo banco.

## Funcionalidades

- Dashboard por unidade e consolidado: matrículas, frequência, ocupação, vagas, conclusões, cancelamentos, abandono e inadimplência.
- Cursos individuais e pacotes com descrição dos módulos e duração; vínculo da matrícula à formação contratada.
- Matrícula expressa e cadastro completo: dados pessoais, responsável, contatos, turma e formação.
- Chamada com presentes, faltosos, atrasados e justificativas; conteúdo, data e professor; salvamento atômico no banco.
- Diagnóstico, evolução e intervenção pedagógica por aluno ou turma; habilidades, nível atual e data de acompanhamento.
- Alerta a partir de três faltas acumuladas; ligação, mensagem ao responsável e registro do motivo, encaminhamento e retorno.
- Relatórios PDF de gestão, frequência por período, atividade da equipe, pedagógico e resumos de aula.
- Resumo para WhatsApp da turma e evolução individual ao responsável, sempre com revisão e envio manual. Para grupos, copie a mensagem e cole no grupo correto. Não há envio automático nem necessidade de API paga.
- Auditoria no banco de matrícula, chamada, contato e registros pedagógicos (ator, entidade e data, sem duplicar conteúdo pessoal no log).

Frequência = (presenças + atrasos) / (presenças + atrasos + faltas); justificativas não entram no denominador. Alunos sem chamadas aparecem sem percentual. O alerta considera faltas registradas acumuladas. Os indicadores de saídas são a situação atual das matrículas; o gráfico mensal agrupa pela data de matrícula e identifica saídas atuais de cada coorte, sem inventar datas de cancelamento. Relatórios de presença, equipe e pedagógico respeitam o período escolhido. Ocupação abaixo de 40% é destacada para análise da gestão. O cadastro de inadimplência é uma situação administrativa: não há cobrança bancária ou conciliação financeira nesta versão.

## GitHub e Vercel

O repositório é `wisdomjovemaprendiz/ControleWisdom`. Na Vercel, importe esse repositório, escolha Next.js e configure Node.js 24, instalação `npm ci`, build `npm run build` e as duas variáveis públicas do Supabase para os ambientes desejados. A raiz do projeto é a raiz do repositório. A aplicação não exige servidor Express ou banco local na Vercel. Aplique a migração antes de disponibilizar o login aos usuários. Para ativar uma alteração de variável pública, faça novo deploy.

Este checkout e o build local não comprovam publicação no GitHub ou na Vercel. Consulte o resumo de entrega para o estado real das integrações.

## Interface operacional

O redesenho substitui o painel inicial por um quadro de turmas com data e diário de frequência. Há entradas específicas para professor, secretaria e coordenação, ficha individual com histórico, filtros combináveis no cadastro e central de acompanhamento de faltas, cadastros e retornos. As referências e decisões estão em [docs/redesenho-operacional.md](docs/redesenho-operacional.md).

Para executar os testes de navegador em uma instância de demonstração separada quando o ambiente já possui Supabase configurado, use variáveis vazias **somente no processo de teste**, sem apagar ou sobrescrever as configurações reais:

```sh
NEXT_PUBLIC_SUPABASE_URL= NEXT_PUBLIC_SUPABASE_ANON_KEY= npm run dev -- --port 3001
# Em outro terminal:
PLAYWRIGHT_BASE_URL=http://127.0.0.1:3001 npm run test:e2e
```
