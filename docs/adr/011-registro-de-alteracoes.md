# 011 — Registro de alterações da mesa

- Estado: aceita
- Data: 2026-10-01
- Escopo: item 37; complementa [006 — migrações](006-migracoes-explicitas.md), [008 — transações](008-transacoes-de-operacoes.md) e [009 — retomada](009-retomada-de-sessao-e-conexao.md)

## Contexto

O histórico de notas já recupera versões, mas a mesa não possuía uma consulta para conferir autoria e data de alterações de acesso, mapa e outras configurações. Um registro precisa conservar a relação com a alteração confirmada e limitar o conteúdo privado que replica.

## Decisão

1. Acrescentar `room_audit` por migração numerada `002-room-audit`, elevando o banco a versão 2 e conservando estados de mesa na versão 1. Preservar o descritor/DDL anterior e a verificação/restauração de backups conhecidos de banco 1.
2. Gravar ação e auditoria na mesma transação. Obter autoria da sessão e registrar somente tipos fixos de ação e metadados permitidos. Não produzir entradas para tentativas recusadas nem mudanças inexistentes.
3. Consultar em endpoint próprio, com sessão, participação e papel atual de ADM/mestre. Recusar modo jogador. Omitir a lista dos snapshots e do SSE; não oferecer edição/exclusão de registros na API.
4. Guardar data, sequência por mesa e revisão confirmada. Ordenar por sequência, paginar por cursor exclusivo e conservar as últimas 1.000 entradas por mesa, com limpeza transacional. Incluir os registros nos backups existentes e validar seus metadados no início e na recuperação.
5. Excluir notas pessoais privadas, seus textos legados e movimentos individuais de posição. Registrar notas do mestre ou compartilhadas genericamente, sem nomes, identificadores ou conteúdo. Não copiar imagens, arquivos, coordenadas, valores de ficha, tokens ou feedback.
6. Expor uma lista recolhível na aba Mesa, com filtro por assunto, atualização explícita e páginas de 25 registros. Conservar foco do teclado durante carregamento e no fim das páginas. Avisar quando a mesa recebeu nova revisão, sem deslocar automaticamente quem consulta entradas anteriores.

## Consequências e limites

Falha ao registrar impede a ação auditada. Uma ação com alterações em mais de uma área pode produzir várias entradas na mesma revisão; a autoria não depende de dados do cliente. Registro e restauração de versões continuam produtos diferentes.

A função começa a registrar depois da atualização; não reconstrói autoria de ações antigas. A retenção é limitada por quantidade e não constitui arquivo permanente. Administradores do arquivo SQLite continuam capazes de alterar seu conteúdo; não se implementou assinatura nem serviço de auditoria externo. Login, feedback, rolagens temporárias e preferências locais conservam seus comportamentos atuais.

Não há mudança de framework, dependência, serviço ou estratégia de persistência. Código antigo que desconhece a versão 2 não deve abrir o banco migrado. Retorno usa um backup anterior com a versão correspondente.

## Verificação

Três testes novos verificam autoria/acesso/páginas, dados e privacidade, migração de banco 1, falha de auditoria com rollback de ações, retenção de 1.000 registros, reinício, recuperação e metadados inválidos. Suíte de 83 testes e build passaram. Navegador desktop e celular conferidos com banco descartável, incluindo salvamento de nota, novo registro sem conteúdo privado, foco, filtros e contas de ADM/mestre/jogador. Procedimento em [ROOM_AUDIT.md](../ROOM_AUDIT.md).
