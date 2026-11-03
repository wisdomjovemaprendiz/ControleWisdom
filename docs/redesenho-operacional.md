# Redesenho do controle acadêmico Wisdom Cursos

## Problema observado

A primeira versão repetia um padrão de painel de indicadores: menu lateral fixo, cartões de números, gráfico genérico de matrícula e blocos motivacionais. Isso dava pouco espaço à chamada e exigia sair da visão geral para entender o que aconteceu com um aluno. A interface também não diferenciava a entrada do professor da entrada da secretaria e da coordenação.

## Referências consultadas em 3 de novembro de 2026

A análise foi realizada nos arquivos oficiais públicos dos projetos abaixo. Foram examinados os fluxos descritos e implementados, sem copiar código ou reproduzir a identidade visual desses sistemas.

| Sistema e fonte                                                                                                                                                                                                                                                                                                             | Comportamento observado                                                                                                                                                                          | Aplicação na Wisdom                                                                                                                                                                                   |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Moodle Attendance — descrição oficial](https://github.com/danmarsden/moodle-mod_attendance/blob/master/README.md) e [gerenciador de sessões](https://github.com/danmarsden/moodle-mod_attendance/blob/master/manage.php)                                                                                                   | Registro por sessão, filtro por data e entrada direta na chamada quando há uma sessão adequada; distinção entre consultar, registrar e alterar presença por permissão.                           | Quadro por data, estado da chamada por turma, acesso direto à turma/data e diário das últimas aulas. Permissões já existentes permanecem aplicadas no banco.                                          |
| [Frappe Education — ferramenta de chamada](https://github.com/frappe/education/blob/develop/education/education/doctype/student_attendance_tool/student_attendance_tool.js) e [modelo de presença](https://github.com/frappe/education/blob/develop/education/education/doctype/student_attendance/student_attendance.json) | Seleção de turma e data, recuperação das marcações existentes, ação coletiva de presença, totais antes da gravação e restrição de data futura. O registro vincula aluno, grupo, data e situação. | Contadores visíveis de presentes, faltas, atrasos, justificativas e alunos ainda sem marcação, mantendo ação coletiva e gravação atômica. O diário usa símbolos e texto; cor não é o único indicador. |
| [Gibbon — ficha detalhada do aluno](https://github.com/GibbonEdu/core/blob/master/modules/Students/student_view_details.php)                                                                                                                                                                                                | Perfil agrega informações pessoais, família, matrícula e histórico de frequência; edição e seções dependem das permissões do usuário.                                                            | Ficha lateral com cadastro, frequência por aula, histórico pedagógico e contatos, além de edição e comunicação com o responsável no contexto do aluno.                                                |

A documentação externa do Moodle não estava acessível pela política de rede; a análise usou o README e o gerenciador de sessões do próprio repositório oficial, que estavam acessíveis.

## Estrutura implementada

- **Navegação institucional horizontal:** marca Wisdom, identificação de perfil, módulos com rótulos explícitos. Menu compacto em celular.
- **Entrada por função:** “Meu diário de classe” para professor, “Mesa da secretaria” para secretaria e “Operação das unidades” para coordenação. O professor encontra suas turmas atribuídas no quadro. Secretaria consulta relatórios sem receber controles para editar a chamada.
- **Quadro operacional:** seleção de data, busca por turma/professor, filtros de chamadas sem registro e baixa ocupação, identificação de professor, unidade e vagas.
- **Diário de frequência:** matriz de alunos por até seis aulas recentes, legenda P/F/A/J, percentual individual, acesso à aula selecionada e à ficha do aluno.
- **Central de acompanhamento:** fila de faltas acumuladas, cadastro incompleto, retornos ao responsável e revisões pedagógicas previstas para até a data atual; filtros por categoria e busca. Pendências são calculadas a partir dos registros existentes, sem criar mensagens enviadas ou intervenções concluídas fictícias.
- **Ficha individual:** cadastro, responsável, formação contratada, chamadas com conteúdo/professor, registros pedagógicos e contatos. A ficha pode ser operada por teclado e fechada com Escape.
- **Cadastro de alunos:** filtros combináveis por situação e turma, além da busca existente.
- **Chamada:** totais por situação e contador de alunos ainda sem marcação antes da finalização. Nada é marcado presente por omissão.

A fila não é um calendário de aulas. O filtro “sem chamada” significa ausência de registro na data escolhida, não prova de que havia uma aula programada. O cadastro atual ainda guarda o horário como texto. Retornos representam datas previstas no histórico, não comprovação de contato realizado ou de encerramento da intervenção. Arquivamento, envio manual de WhatsApp e restrição entre unidades continuam preservados.

## Direção visual

Azul institucional na marca e nas faixas de contexto; vermelho no sinal de navegação e em prioridades; fundo de papel e linhas de registro para reforçar o caráter acadêmico. A hierarquia é baseada em documentos, turmas e tarefas. Foram retirados o gráfico de entrada, os cartões decorativos e os textos motivacionais do painel. Tabelas densas têm rolagem própria em celular; nomes permanecem fixos no diário.

## Validação

Testes de domínio e banco cobrem isolamento entre unidades, frequência, autoria/permissões, limite de vagas e gravação atômica. Foram acrescentadas verificações da fila operacional e do diário. Os testes de navegador cobrem os fluxos anteriores e os novos filtros, ficha individual e entrada na chamada a partir do quadro. A revisão visual usa dados fictícios em uma instância separada; não modifica o projeto Supabase configurado.
