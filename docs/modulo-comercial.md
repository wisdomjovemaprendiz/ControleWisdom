# Comercial, secretaria e grupos de turma

O administrador cria a conta em **Equipe e acesso → Novo usuário → Comercial**, definindo login, senha inicial e unidade. Mantém-se a troca obrigatória de senha no primeiro acesso. O Comercial vê apenas os dados de sua unidade. Não administra equipe, unidades, cursos, aulas ou turmas e não consulta registros pedagógicos.

## Mesa comercial

O painel apresenta matrículas criadas pelo próprio profissional, pendências da secretaria, vagas em turmas abertas e alunos com alerta de faltas. A lista de oportunidades considera vagas restantes, incluindo os alunos em pré-matrícula, e oferece ordenação por prioridade da secretaria (1ª, 2ª ou 3ª opção, seguida da menor quantidade de alunos) ou por menor número de alunos. Turmas fechadas, arquivadas e sem vagas não são ofertadas.

**Pré-matricular nesta turma** abre o formulário com a turma selecionada. O Comercial informa foto, nome do aluno, responsável, telefones e formação; a captura por câmera/webcam e o enquadramento continuam disponíveis. Os campos permanecem opcionais conforme a configuração anterior do cadastro. A inscrição é salva como pré-matrícula e preserva a autoria do vendedor, com controle de vagas e validação da abertura da turma também no banco.

O Comercial pode corrigir os dados básicos de suas próprias pré-matrículas enquanto estiverem pendentes. Não pode concluir a conferência, alterar a situação administrativa, editar inscrições de outros profissionais ou alterar registros já concluídos. A secretaria e os perfis de gestão mantêm suas permissões de cadastro.

## Passagem para a secretaria

Uma pré-matrícula pendente aparece na **Central de atenção → Pré-matrículas**, na fila de operação e no contador de alertas da secretaria e da gestão. As filas se atualizam automaticamente a cada minuto com a aba ativa e ao retornar à janela; a edição de formulários não é interrompida. A secretaria abre o cadastro, completa ou confere os dados e marca **Concluir conferência da pré-matrícula** antes de salvar. Os campos opcionais continuam opcionais; o ato de conferência é uma sinalização explícita da equipe, não uma afirmação automática de que todos os dados foram preenchidos.

A conclusão guarda usuário e horário no banco, retira o alerta de pré-matrícula e atualiza a situação exibida ao Comercial. Os registros anteriores não são apagados. As pendências comuns de qualidade cadastral podem continuar aparecendo à secretaria se ainda houver informações opcionais em aberto.

## Faltas e relacionamento

Comercial e secretaria consultam alertas da própria unidade para alunos ausentes na última aula registrada ou com pelo menos três faltas acumuladas. O histórico de contatos é compartilhado, permitindo registrar motivo, encaminhamento e próximo retorno sem duplicar abordagens. A ausência de uma chamada não é convertida em falta e faltas justificadas não são tratadas como faltas não justificadas.

## Abertura e prioridade das turmas

Em **Turmas → Editar turma**, a secretaria e a gestão controlam **Turma aberta para matrícula** e **Prioridade para o comercial**. A prioridade é de 1ª a 3ª opção; não altera vagas nem ordenações pedagógicas. A secretaria pode tratar transferências e ajustes administrativos; o Comercial recebe bloqueio no banco ao tentar uma nova inscrição numa turma fechada ou sem vagas. As turmas existentes começam abertas, mantendo o comportamento anterior até a equipe escolher fechá-las.

## WhatsApp e QR code

A secretaria informa um convite HTTPS de `chat.whatsapp.com`. O QR code é gerado localmente a partir desse link, sem serviços externos. Também pode enviar uma imagem PNG, JPG ou WebP, convertida para PNG de até 350 KB, no bucket privado `class-qr-codes`. Somente a secretaria e a gestão podem enviar ou remover essas imagens. A leitura usa URLs temporárias e respeita a unidade.

Após salvar a pré-matrícula, o Comercial pode apresentar o QR code ao aluno ou responsável. O botão **Grupo** nas turmas e no cadastro/ficha permite reabrir essa apresentação. Uma imagem fornecida pela secretaria pode ser mostrada mesmo sem link; o link é necessário para os convites por mensagem. Se o link mudar, a imagem antiga é retirada para evitar enviar um QR de outro grupo, salvo quando uma nova imagem é enviada junto.

Há dois textos revisáveis: o aluno recebe convite para tirar dúvidas, receber orientações e interagir com os colegas; o responsável recebe convite para acompanhar frequência, evolução e orientações do professor. Os botões usam os telefones de cada destinatário e o envio é manual no WhatsApp. Não há disparo automático nem mensagens enviadas durante os testes.

## Ficha do aluno

O painel usa cabeçalho compacto, foto ao lado do nome, indicadores menores e uma área central que ocupa o espaço restante da janela. As abas e ações permanecem acessíveis, com rolagem independente do conteúdo. O Comercial consulta cadastro, frequência e contatos, sem a aba pedagógica ou exportações de evolução. O layout foi verificado em computador e celular, inclusive com nome longo.

A migração `010_commercial_enrollment.sql` acrescenta papel, etapas de cadastro, prioridade, abertura e armazenamento dos QR codes, sem apagar os alunos existentes. As matrículas anteriores são mantidas como cadastro concluído. Links antigos fora do formato esperado são preservados pela migração; ao editar a turma, a equipe deverá informar um convite válido.
