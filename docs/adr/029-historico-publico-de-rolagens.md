# 029 — Histórico público e confirmação das rolagens

Data: 2026-10-03. Estado: aplicado, incluindo a decisão de privacidade de 2026-10-07.

## Contexto

A bandeja mantinha somente a última animação em memória. Reinícios apagavam esse resultado, e repetir uma resposta perdida podia gerar outro sorteio. O item 53 pede autoria, horário, contexto e identidade da operação.

## Decisão

Persistir no SQLite o registro compacto, a confirmação do pedido e somente a última animação completa. Usar migração SQL 005; conservar o formato JSON de mesa 5. Escrita, revisão e retenção atômicas, SSE após confirmação. Reutilizar o resultado físico original em todas as representações.

Guardar 500 registros por mesa e confirmações por sete dias. Pedidos novos precisam ter horário de preparação recente; pedidos antigos expirados são recusados mesmo depois da limpeza. Identidade com corpo diferente exige revisão, sem novo sorteio. O navegador repete o corpo original de uma intenção sem confirmação.

Projetar o contexto das cenas pelas permissões atuais também em consultas e exportações. O histórico administrativo permanece separado. Backup conhecido de esquema 4 conserva sua identidade/contagens originais na conferência.

## Limites

Padrão decidido em 2026-10-07: rolagens privadas por padrão, públicas apenas na rolagem na mesa (origem `group`), com marca explícita vencendo o padrão. Rolagem privada: lida apenas por quem rolou e pelo ADM (histórico, snapshot, SSE, animação da bandeja e exportação). Rolagens locais fora da bandeja não passam a ser confirmadas pelo servidor. Os dados anteriores em memória não são reconstruídos.

Contrato, evidências e continuidade em [DICE_HISTORY.md](../DICE_HISTORY.md). Um teste HTTP integrado, suíte 131/131, build e navegador desktop/celular aprovados.
