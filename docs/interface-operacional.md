# Interface operacional

A interface mantém a marca Wisdom, com azul institucional, vermelho para destaques e superfícies neutras. As telas internas priorizam tarefas e dados.

- Cada página começa com um título e suas ações. Evitar banners promocionais, saudações extensas e descrições que repetem o título.
- Ajuda deve explicar uma regra ou decisão concreta. Alertas, validações e informações sobre frequência e acompanhamento continuam visíveis.
- O filtro de unidade aparece para administração e coordenação. Os demais perfis veem sua unidade no cabeçalho, sem um seletor desabilitado.
- Em listas de alunos, reservar espaço para foto e identidade com `minmax(0, 1fr)`. No celular, posicionar o status abaixo da identidade; não disputar a mesma linha com nomes e turmas.
- Manter ações de toque com pelo menos 40 px no cabeçalho e 44 px nas ações principais. Preservar foco de teclado e rótulos acessíveis.
- Tabelas extensas podem rolar dentro de seu contêiner; a página inteira não deve ter rolagem horizontal.

## Verificação

A suíte Playwright verifica a ação inicial do comercial e a largura da identidade do aluno em 360, 390 e 412 px. Também percorre os módulos administrativos em 360 px, confere a ausência de transbordamento da página e preserva testes de fontes, ficha do aluno, chamadas, fotos e permissões. Revisar visualmente os perfis administrativo, secretaria, professor e comercial no celular e no computador ao alterar a estrutura global.

Na área Equipe e acesso, a administração de logins aparece primeiro, seguida do checklist de desligamento e da auditoria. A auditoria inicia recolhida e busca as movimentações apenas quando expandida. A alteração da própria senha é aberta pelo botão de chave na linha do usuário ou pelo nome do usuário no cabeçalho; o formulário não ocupa espaço permanente na página. Perfis sem administração de acessos usam o cabeçalho para alterar a senha, sem uma página de configurações vazia no menu.
