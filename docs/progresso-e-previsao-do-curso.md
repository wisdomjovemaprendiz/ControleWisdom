# Progresso e previsão do curso

## Configuração

1. Em **Cursos e pacotes**, informe a carga horária total em horas. A duração em meses passa a ser uma referência opcional, sem definir o progresso.
2. Em **Turmas**, escolha o curso ou pacote de referência, a carga horária de cada aula em horas e os dias considerados na previsão. O campo descritivo Dias e horário continua disponível. Sem dias marcados, o sistema tenta reconhecer os dias escritos nesse campo.
3. No cadastro do aluno, informe opcionalmente **Data de início do curso** e **Vencimento do último boleto**. Sem início informado, a data de matrícula é usada e identificada como referência.
4. Para alunos que já estudavam antes dos registros no sistema, secretaria e gestão podem informar horas anteriores. Devem ser somente horas que não aparecem nas chamadas, evitando duplicação. O ajuste é auditado.

O curso explicitamente contratado pelo aluno tem precedência sobre a referência da turma. Aulas individuais mantêm sua carga horária própria, quando informada.

## Contagem de horas

O progresso é calculado a partir das chamadas finalizadas, não por um contador que é decrementado a cada clique. Presença e atraso somam a duração da aula. Falta e falta justificada não somam horas. Editar a mesma chamada recalcula o resultado e não duplica créditos.

Exemplo: um curso de 200 horas com aulas de 2 horas precisa de 100 aulas com presença. Uma presença soma 2 horas, mostrando 1% e 198 horas restantes. Uma falta mantém as horas cumpridas e deixa a carga pendente.

Cada chamada nova de turma guarda a duração configurada naquela ocasião. Alterar a turma de 2 para 3 horas não reescreve as durações já registradas. Quando a duração é configurada pela primeira vez, chamadas antigas sem duração recebem esse valor como referência. A interface informa essa regra no cadastro da turma. Administração pode corrigir explicitamente a duração de uma aula em Gestão de registros; a correção é auditada.

As presenças novas também guardam o curso contratado naquele momento. Assim, trocar o curso do aluno não transfere automaticamente créditos identificados de outro curso. Chamadas antigas sem esse vínculo utilizam os cadastros atuais e a data de início como aproximação, indicada nos detalhes do cálculo.

Não entram chamadas futuras, não finalizadas, arquivadas, duplicadas ou anteriores ao início informado. O histórico de turmas arquivadas continua disponível para o cálculo; arquivar explicitamente uma chamada ou presença retira esse registro da soma.

## Previsão

A previsão por agenda distribui as aulas restantes nos dias da semana configurados. Após pelo menos quatro chamadas com duração conhecida, utiliza a proporção de horas com presença ou atraso nas últimas vinte chamadas válidas para ajustar o ritmo futuro. Ausências justificadas também adiam a carga que ainda precisa ser cumprida. Dias sem chamada não viram faltas automaticamente.

Sem presenças no histórico recente, não se divide por zero: a projeção supõe retorno com frequência integral e identifica essa condição. Com menos de quatro chamadas, a agenda é usada sem tentar inferir um padrão de faltas.

Sem dias de aula conhecidos, mas com início e último boleto posterior ao início, o intervalo financeiro serve de referência para distribuir a carga restante. O cartão identifica essa base como estimativa pelo prazo de boletos. Havendo agenda, o boleto é comparado com a previsão acadêmica, mostrando quantos dias antes ou depois ela fica.

O cálculo não conhece feriados, recessos ou futuras aulas canceladas. Também depende da atualização correta das chamadas e das horas anteriores informadas. A previsão é dinâmica e não constitui promessa de conclusão. Matrículas inativas deixam de receber projeção futura.

A data de boleto nunca gera horas cumpridas. O percentual só atinge 100% quando a carga real foi alcançada, sem antecipar a conclusão por arredondamento. Atingir 100% não arquiva nem encerra a matrícula: a equipe continua responsável pela conclusão administrativa e pelo checklist de desligamento.

## Consulta e relatórios

A ficha do aluno exibe a barra na aba Cadastro, dentro da área de leitura, preservando o cabeçalho compacto. Mostra horas cumpridas e restantes, início, duração por aula, previsão e último boleto. Os detalhes da metodologia ficam recolhidos.

A ficha PDF inclui o resumo do progresso. No relatório personalizado, as informações de progresso, início, término estimado e último boleto são colunas opcionais, exportáveis para PDF, XLS e XLSX. As horas do curso são acumuladas desde o início; os indicadores de frequência existentes continuam seguindo o período selecionado.

## Banco

A migração aditiva `013_course_progress.sql` acrescenta as cargas, dias, datas e referências históricas. Não preenche cargas horárias desconhecidas dos cursos ou turmas existentes, não cria alunos de exemplo, não altera pagamentos e não conclui matrículas automaticamente.

Preserva acesso por unidade e a autoria das alterações. Professor não altera o último boleto nem informa horas anteriores; secretaria e gestão podem informar horas anteriores; comercial mantém a edição somente das próprias pré-matrículas pendentes, com as datas de planejamento opcionais.
