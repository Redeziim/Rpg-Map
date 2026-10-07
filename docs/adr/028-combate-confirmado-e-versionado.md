# 028 — Combate confirmado e versionado

Data: 2026-10-03. Estado: aplicado localmente.

Substitui a composição dos turnos na leitura prevista no item 5 da [ADR 006](006-migracoes-explicitas.md).

## Contexto

Turnos usavam quatro campos independentes. Leituras reconstruíam participantes, enquanto remoção de conta e remoção no combate aplicavam regras diferentes ao participante ativo. Não existia versão específica para impedir duas conduções simultâneas. O usuário pediu que o mestre possa mover na ordem, retirar e pular turnos.

## Decisão

Persistir um único `combat`, com formato 1, versão de alteração, ordem, NPCs, exclusões, iniciativa opcional, ativo e rodada. JSON de mesa 5, SQL 4. Materializar o estado anterior na migração 005, antes da API; retirar os campos antigos. Leitura e exportação utilizam diretamente o estado confirmado.

Manter a rota pública de ações `/turns`, exigindo versão. Transacionar leitura/validação/ação/revisão/audit e publicar SSE depois de confirmar. Reconciliar alterações de participantes durante a escrita de acesso, conservando a ordem dos demais e acrescentando novas entradas ao final. Retirar o ativo avança ao próximo sobrevivente; sem sobreviventes, encerra. Não impor desempate ou regras de um sistema de RPG.

Mestre/ADM em modo mestre conduzem; jogador e ADM em modo jogador acompanham. O navegador conserva somente rascunhos de campos, mantendo versão de início da edição e oferecendo revisão explícita em conflito.

## Consequências

Não há reconstrução de combate em GET nem segunda fonte de verdade. NPCs e participantes continuam identificáveis depois de reinício, exportação e backup/restauração. Clientes anteriores precisam recarregar: ações sem versão são recusadas. Rodada/iniciativa antigas não existiam; a migração conserva o ativo e usa rodada 1 quando necessário. Histórico de rolagens e recuperação de ações sem confirmação pertencem aos itens seguintes. Sem API externa ou nova dependência.

## Evidência

Fluxo HTTP/SSE/concorrência/migração/exportação/backup integrado, rollback de migração e regressões de transações. Suíte de 130 e build aprovados; interface verificada em 1440 e 390 px. Contrato em [COMBAT_STATE.md](../COMBAT_STATE.md).
