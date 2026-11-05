# Cores de turmas e relatórios personalizados

## Identidade das turmas

A migração `012_class_identity.sql` grava uma cor em todas as turmas existentes e configura a atribuição automática na criação. A paleta de 16 cores usa primeiro as cores menos utilizadas; redes com mais turmas podem reutilizar cores. Editar nome, professor, vagas ou horário não muda a identidade visual. A atribuição é serializada no banco para evitar que criações simultâneas escolham a mesma cor disponível.

A moldura aparece na lista de turmas, no quadro e diário de classe, na configuração da chamada e nos cartões do comercial. Nome e unidade continuam identificando a turma, independentemente da cor.

## Ocupação

A identidade da turma e a ocupação usam cores independentes. O componente compartilhado `OccupancyBar` aplica as mesmas faixas em todas as telas:

| Percentual | Cor | Situação |
| --- | --- | --- |
| Abaixo de 40% | Vermelho | Baixa ocupação |
| 40% a 69% | Amarelo | Ocupação moderada |
| 70% a 89% | Verde | Boa ocupação |
| A partir de 90% | Laranja | Próxima da lotação; em 100%, lotada |

O cálculo considera alunos ativos e pré-matrículas que reservam vagas, excluindo registros arquivados da operação. Quantidade, capacidade, percentual e vagas acompanham a barra. A barra tem descrição acessível e não depende apenas da cor.

## Relatório personalizado

Em **Relatórios**, escolha unidade, turma/modalidade e período. No painel **Relatório personalizado**, marque as informações desejadas e selecione o formato. Não existe coluna de aluno obrigatória: somente os campos marcados entram na prévia e no arquivo.

Os campos estão agrupados em cadastro, matrícula, frequência e pedagógico. Há filtros de situação e inclusão de registros arquivados. A opção **Filtrar também pela data de matrícula** aplica o período às matrículas; sem ela, o período vale para o cálculo da frequência. Os campos pedagógicos representam o último registro individual, sem filtro pelo período da frequência.

A prévia mostra até dez alunos, mas a exportação inclui todos os alunos encontrados, respeitando unidade, perfil e filtros. Os números de frequência usam as chamadas no período e na turma/modalidade selecionada. Cada informação é tratada como célula; nomes com barras ou dois-pontos não criam colunas acidentais.

- **PDF:** marca institucional, identificação da emissão, cabeçalhos selecionados e paginação. Orientação horizontal a partir de seis colunas.
- **Excel (.xlsx):** formato moderno, com telefones em texto e contagens numéricas.
- **Excel 97–2003 (.xls):** arquivo binário BIFF8 real, não HTML renomeado. Aceita até 65.535 alunos mais o cabeçalho; para volumes maiores, selecionar XLSX.

A versão oficial SheetJS 0.20.3 é carregada sob demanda, com URL e integridade fixadas no lockfile. Textos que começam com `=` ou `+` continuam texto, sem serem convertidos em fórmulas. Nenhuma exportação é enviada automaticamente a terceiros.

## Verificação

Os testes cobrem persistência de cores em turmas existentes e novas, faixas da ocupação, escopo por unidade, filtros, colunas exatas e preservação de telefones. As planilhas XLS e XLSX são abertas novamente para verificar tipo real e conteúdo. O teste de PDF confere cabeçalho e dados selecionados sem colunas implícitas. Os fluxos do navegador verificam download real e ausência de transbordamento no celular.
