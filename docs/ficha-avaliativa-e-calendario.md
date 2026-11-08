# Ficha avaliativa e calendário escolar

## Onde usar

- **Calendário escolar:** feriados, recessos e outros períodos sem aula.
- **Relatórios → Ficha avaliativa do aluno:** escolha o aluno e os meses, confira as datas se desejar e baixe o PDF.

A seleção do aluno traz sua unidade, turma ou modalidade individual, curso, professor, dias de aula e os contatos cadastrados. Dados ausentes aparecem como Não informado. A foto é incorporada quando disponível no armazenamento privado. Nenhum campo passa a ser obrigatório no cadastro por causa desta emissão.

## Dias sem aula

Escolha a unidade e, opcionalmente, uma turma. Clique no primeiro e no último dia no calendário para selecionar o intervalo; também é possível digitar início e fim nos campos de data. Informe o motivo e escolha Feriado, Recesso ou Sem aula. O período pode valer para uma turma, toda a unidade ou, para gestão, todas as unidades.

O calendário exibe os períodos da unidade inteira por padrão. Ao selecionar uma turma, inclui os períodos dessa turma, da unidade e os gerais. A lista permite editar, ativar/desativar e excluir. Desativar conserva o cadastro e deixa de bloquear as datas em novas emissões.

Administração e coordenação gerenciam períodos gerais e das unidades autorizadas. Secretaria gerencia sua unidade. Professores consultam. Inclusões, alterações e exclusões são auditadas. A migração não cria alunos ou turmas de exemplo.

## Feriados de 2027

A migração `015_school_calendar.sql` cadastra os nove feriados nacionais declarados em leis federais, aplicáveis a todas as unidades: 1º de janeiro, 21 de abril, 1º de maio, 7 de setembro, 12 de outubro, 2 de novembro, 15 de novembro, 20 de novembro e 25 de dezembro.

Fontes oficiais consultadas, em texto integral da Câmara dos Deputados:

- [Lei 10.607/2002, art. 1º](https://www2.camara.leg.br/legin/fed/lei/2002/lei-10607-19-dezembro-2002-473572-publicacaooriginal-1-pl.html): sete datas nacionais.
- [Lei 6.802/1980](https://www2.camara.leg.br/legin/fed/lei/1980-1987/lei-6802-30-junho-1980-357065-publicacaooriginal-1-pl.html): 12 de outubro.
- [Lei 14.759/2023](https://www2.camara.leg.br/legin/fed/lei/2023/lei-14759-21-dezembro-2023-795091-publicacaooriginal-170522-pl.html): 20 de novembro.
- [Lei 9.093/1995, art. 2º](https://www2.camara.leg.br/legin/fed/lei/1995/lei-9093-12-setembro-1995-348594-publicacaooriginal-1-pl.html): feriados religiosos declarados por lei municipal, incluindo a Sexta-Feira da Paixão.

Em **Datas locais e facultativas de 2027**, há sugestões prontas para Carnaval (8 e 9/2), Quarta-feira de Cinzas (10/2), Sexta-feira Santa (26/3) e Corpus Christi (27/5). Escolher uma sugestão prepara o formulário; a escola confirma a unidade/turma e salva se realmente não houver aula. Elas não são classificadas automaticamente como feriados nacionais de aplicação universal. As datas móveis correspondem à Páscoa de 28/3/2027. Feriados estaduais, municipais e recessos próprios podem ser acrescentados normalmente.

## Montagem da ficha

A emissão aceita de um a 24 meses consecutivos, inclusive intervalos entre anos. Os dias da semana vêm da configuração da turma; para turmas antigas, o texto de dias/horário e o nome da turma são usados como alternativa de leitura. Aulas individuais usam os dias da matrícula individual. Sem agenda identificável, a emissão solicita a configuração, em vez de inventar datas.

Somente datas que coincidam com os dias de aula aparecem na tabela. Se uma dessas datas cair em feriado ou recesso aplicável, ela permanece com o motivo, a marca **SEM AULA**, fundo diferenciado e as colunas de assinatura/avaliação unidas. Feriados em dias em que a turma não tem aula não acrescentam linhas extras. Motivos sobrepostos aparecem juntos, sem duplicar a data.

As outras linhas mantêm conteúdo, assinatura do aluno e avaliação em branco para preenchimento à mão. Os meses são separados por faixas; o PDF aproveita o espaço da página, respeita uma altura mínima para escrever e repete logo, dados, cabeçalho da tabela e identificação do mês nas continuações. O cabeçalho usa dados reais, com fonte institucional incorporada para preservar acentos na impressão.

O calendário representa o planejamento de dias sem aula na ficha. A emissão não registra presenças automaticamente, não gera aulas extras e não altera os cálculos de horas nem a previsão de conclusão do curso. Alterações de calendário afetam novas emissões; um arquivo já baixado deve ser gerado novamente quando necessário.
