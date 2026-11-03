# Apoio pedagógico da Wisdom

Versão do catálogo: `wisdom-pedagogy-2026.11-v1`. Fontes consultadas em 3 de novembro de 2026.

O assistente organiza o planejamento do professor em observação, objetivo, intervenção e verificação do resultado. As escolhas são propostas de apoio educacional, adaptadas aos cursos de jovem aprendiz. Não classifica transtornos nem atribui rótulos clínicos. O resultado é um rascunho que exige revisão e confirmação do professor.

## Referências consultadas

1. **CAST (2024). Universal Design for Learning Guidelines, versão 3.0.** https://udlguidelines.cast.org/
   Diretrizes consultadas: clarificar vocabulário; combinar modos de representação; apoiar composição e expressão; praticar com apoio graduado; tornar metas significativas; planejar desafios; organizar recursos; monitorar progresso; oferecer feedback orientado à ação; promover pertencimento e práticas restaurativas. O UDL é uma estrutura para desenhar condições de aprendizagem acessíveis, e não uma medida de diagnóstico individual ou garantia de resultado.
2. **Pashler, H.; Bain, P. M.; Bottge, B. A.; Graesser, A.; Koedinger, K.; McDaniel, M.; Metcalfe, J. (2007). Organizing Instruction and Study to Improve Student Learning. IES / What Works Clearinghouse, NCER 2007-2004.** https://ies.ed.gov/ncee/wwc/PracticeGuide/1
   Recomendações consultadas: distribuir o estudo no tempo; alternar exemplos resolvidos e problemas; combinar gráficos e explicações verbais; conectar representações abstratas e concretas; usar perguntas e quizzes para recuperação; ajudar a identificar o que ainda precisa ser estudado; formular perguntas explicativas. O guia diferencia níveis de evidência entre recomendações. O catálogo não atribui um mesmo nível de evidência a todas as estratégias nem estima ganhos individuais.
3. **CASEL. Framework for Social and Emotional Learning.** https://casel.org/fundamentals-of-sel/what-is-the-casel-framework/
   Competências consultadas: autoconhecimento, autorregulação, consciência social, habilidades de relacionamento e tomada responsável de decisões. O framework considera contextos de sala, instituição, família e comunidade e sua aplicação em diferentes etapas de desenvolvimento. Apoios socioemocionais devem ser contextualizados e preservar a dignidade do estudante.

A aplicação educativa exige considerar contexto, barreiras de acesso, conhecimentos anteriores, linguagem da atividade, condições da turma, voz do estudante e possibilidade de apoio da coordenação e profissionais responsáveis. A associação entre uma observação e uma estratégia é uma proposta de planejamento derivada dessas referências, não uma inferência causal demonstrada para aquele aluno. Não são fabricados relatos de casos reais ou resultados de pesquisa individuais.

## Catálogo e funcionamento

São 20 opções de observação em 10 áreas e 21 estratégias iniciais: atenção e início da tarefa; organização e autonomia; leitura; escrita; matemática; memória e revisão; comunicação oral; participação e colaboração; autorregulação emocional; prática digital e profissional.

O professor marca a frequência observada de 0 a 3, informando contexto e linha de base. Isso não é um teste padronizado: 0 = não observado, 1 = ocasional, 2 = frequente, 3 = muito frequente no período acompanhado. O campo de nível de 1 a 5 descreve apoios necessários para a habilidade/tarefa, não idade mental, desenvolvimento global ou classificação clínica.

As sugestões usam regras locais: relações explícitas entre observações e uma ordenação pela soma das frequências das observações relacionadas. Palavras do relato ajudam a localizar opções. Uma possibilidade correlacionada nunca entra automaticamente no registro. O professor deve confirmá-la; pode consultar todas as estratégias, escolher apoios e escrever livremente. Nenhum dado pessoal é enviado a uma API externa de IA.

Cada estratégia expõe passos, justificativa, fontes e uma forma de recolher evidência. O professor define objetivo e critério de comparação. O botão de rascunho usa somente as escolhas e os fatos informados. Não afirma melhora sem um resultado e evidência registrados pelo professor.

## Intervenção e acompanhamento

A data de acompanhamento produz lembrete dentro do sistema: agenda pedagógica, Central de atenção, fila da operação e contador de alertas. Lembretes incluem atrasados, hoje e agendados; o calendário usa São Paulo e é atualizado quando a janela recebe foco ou muda o dia. Não há envio automático de notificações ao WhatsApp ou por e-mail.

No retorno, o professor abre a intervenção de origem e registra uma evolução manual ou assistida. Deve selecionar resultado (não avaliado, avanço parcial, objetivo alcançado, sem mudança ou revisão do plano) e descrever evidências. A turma, aluno e unidade de origem são preservados. Só salvar esse relatório vinculado conclui o lembrete correspondente. Outra intervenção pendente continua aberta. Uma nova data na evolução cria o próximo passo da cadeia.

A base conserva textos revisados, objetivos, critérios, contexto, linha de base, frequência das observações, estratégias, resultado, evidências, referências e versão do catálogo. O vínculo entre origem e evolução é protegido no PostgreSQL, com uma evolução ativa por intervenção. Há autorização por turma/unidade e auditoria de inserções; não se concede ao professor edição administrativa do histórico de outros usuários.

O histórico aparece na ficha do aluno e nos PDFs pedagógicos. A ficha em PDF inclui os registros do aluno, e a evolução mais recente considera o horário de criação para diferenciar registros do mesmo dia.
