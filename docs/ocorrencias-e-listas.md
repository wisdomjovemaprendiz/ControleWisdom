# Listas operacionais e ocorrências

## Alunos

A lista inicia com **Ativo** e ordena os nomes alfabeticamente, sem alterar a sequência das chamadas em andamento. Os demais estados continuam disponíveis no filtro. A coluna Desde usa somente `course_start_date`; na ausência da data, exibe **Início não informado**, sem substituí-la pela data de criação.

O resumo ao lado do nome mostra horas cumpridas, carga total e porcentagem, usando o mesmo cálculo da ficha. Sem carga definida, mostra as horas e a indicação de carga a definir. Os dados de responsável continuam no cadastro e na ficha; a lista passa a mostrar telefone do aluno e um link para a conversa no WhatsApp Web. Telefones brasileiros com 10 ou 11 dígitos recebem o prefixo 55 no link, sem modificar o cadastro.

## Turmas

A ordenação padrão compara nomes e números naturalmente: Turma 2 vem antes de Turma 10. A lista permite busca, filtros de matrículas abertas, vagas, lotação e ocorrências, além de ordenação por vagas disponíveis, ocupação, número de registros de ocorrências e prioridade de matrícula. Empates seguem o nome/número.

A legenda de ocupação usa vermelho abaixo de 40%, amarelo de 40% a 69%, verde claro de 70% a 89% e verde de 90% a 100%. A cor fixa de identificação da turma permanece independente da ocupação.

## Ocorrências na chamada

O painel **Ocorrências da aula**, inicialmente recolhido, é opcional. Escolha toda a turma ou um aluno, marque quantas opções corresponderem aos fatos observados e acrescente detalhes, se necessário. Há opções de atenção ao celular, conversa, atrasos recorrentes, atividades, materiais, combinados, convivência, equipamentos, apoio e participação positiva. Nenhuma opção representa diagnóstico clínico.

A finalização da chamada grava presenças e ocorrências na mesma transação. Editar e finalizar novamente atualiza os registros, sem duplicá-los. Apagar todas as opções e o texto, ou remover um registro, exclui aquela ocorrência ao finalizar novamente. Os registros não são enviados antes de finalizar a chamada.

**Ocorrências não entram no resumo nem no relatório de chamada do grupo.** São consultadas no botão Ocorrências da turma, na aba Ocorrências da ficha e na ficha PDF. O acompanhamento ao responsável inclui até os dez registros mais recentes pertinentes ao próprio aluno; o PDF possui o histórico completo. Registros individuais de outros alunos nunca são incluídos nessa seleção.

Uma ocorrência coletiva aparece como **Contexto da turma**, apenas para alunos marcados presentes ou atrasados naquela aula. Não é atribuída a quem faltou. O vínculo histórico usa a chamada, não a turma atual do aluno, preservando o contexto após uma transferência.

## Banco e acesso

A migração `014_lesson_occurrences.sql` cria tabela própria com vínculo à aula, unidade e aluno opcional, marcações, texto, autoria e datas. Valida a participação na chamada e a unidade, preserva autoria e vínculos ao editar e audita inclusão, alteração e remoção.

RLS permite consulta à gestão e secretaria da unidade; professores consultam e registram no contexto de suas aulas. Secretaria consulta, mas não altera ocorrências. Comercial não recebe acesso aos registros. A gravação mantém a mesma RPC de chamada e preserva ocorrências quando um cliente antigo não envia esse campo. Não são criados registros demonstrativos nem alterados alunos reais pela migração.
