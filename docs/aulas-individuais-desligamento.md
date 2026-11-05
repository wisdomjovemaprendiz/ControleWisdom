# Aulas individuais, fotos e desligamento

## Matrícula e chamada

No cadastro ou edição de aluno, selecione **Aula individual** no campo Turma. Informe a carga horária total em horas, a duração de cada encontro em minutos, os dias da semana e o professor. Os campos podem ser completados depois. O vínculo é com o aluno e a unidade, sem cadastrar uma turma artificial. Um professor de referência de outra unidade não é aceito.

Na Chamada, selecione **Aulas individuais**, escolha o aluno e a data. Informe o conteúdo e confirme a duração realizada. As opções de presença, atraso com horário e falta justificada com motivo continuam disponíveis. Há um encontro por aluno por data. O resumo para WhatsApp identifica a modalidade e o aluno; o envio continua manual.

As presenças e os atrasos somam a duração registrada nas horas realizadas da ficha. Faltas e justificativas não consomem carga horária. A carga contratada não encerra automaticamente a matrícula: o desligamento continua sujeito à conferência da equipe. Os dias escolhidos organizam a agenda; não geram faltas automaticamente.

Os mesmos alertas de ausência, aniversário, contato e acompanhamento pedagógico incluem alunos individuais. Professor designado ou, enquanto não houver designação, professores da unidade podem registrar os encontros; administração e coordenação também podem fazê-lo. Secretaria e comercial continuam sem permissão de escrita na chamada.

## Identificação

As fotos continuam privadas, comprimidas e com enquadramento ajustável. A exibição passa a ser circular, inclusive nas fotos dos relatórios PDF. Clicar ou usar Enter/Espaço na foto abre a ampliação de 2×. Escape ou o botão Fechar retorna à tela sem executar a ação da linha do aluno.

## Checklist

Administração e coordenação configuram as etapas em **Equipe e acesso → Checklist de desligamento**. É possível adicionar, editar, ordenar e desativar etapas. O padrão inclui a confirmação de retirada do grupo de WhatsApp. Para aulas individuais sem grupo, a equipe confirma que não há vínculo com grupo a remover. Deve existir ao menos uma etapa ativa para concluir o desligamento.

Ao alterar uma matrícula ativa para conclusão, abandono, inadimplência ou cancelamento, ou ao arquivar pelo gerenciamento de registros, é obrigatório confirmar todas as etapas ativas. A validação ocorre no banco e também impede alterações diretas sem checklist. O banco registra o texto das etapas, o responsável e o horário da conclusão. Edições futuras do modelo não modificam esses comprovantes. Uma reativação preserva o histórico anterior; um novo desligamento exige conferir novamente o checklist vigente.

## Auditoria

Administração e coordenação consultam a auditoria em **Equipe e acesso**, com filtro por tipo de registro e aluno e paginação. Os registros novos guardam autor, data e hora, identificação do registro e dados anteriores/posteriores, incluindo mudanças de turma, modalidade, professor, situação e exclusões. As comparações não incluem senhas nem chaves. Exclusões mantêm a identificação do autor no histórico mesmo se a conta desse autor for posteriormente removida. Registros antigos não possuem detalhes retroativos de antes/depois.

## Banco e verificação

Migração aditiva: `supabase/011_individual_lifecycle_audit.sql`, aplicada pelo histórico em `npm run db:provision`. Preserva matrículas e turmas existentes. Alunos existentes continuam na modalidade Turma. As políticas de acesso por unidade e os vínculos de histórico permanecem em vigor.

Há testes de PostgreSQL/RLS para chamadas individuais, validação transacional, checklist obrigatório nas duas rotas, preservação das etapas e auditoria de arquivamento, transferência e exclusão. A suíte do navegador cobre matrícula, chamada, pedagogia, configuração do checklist e ampliação das fotos.
