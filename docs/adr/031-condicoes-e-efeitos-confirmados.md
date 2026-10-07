# 031 — Condições e efeitos em transições confirmadas

Data: 2026-10-04. Estado: aplicado localmente.

## Contexto

O usuário escolheu duração por efeito: rodadas, próximo turno ou remoção manual. A recuperação existente impede reaplicar uma ação cuja resposta foi perdida. A duração precisa acompanhar essa garantia e as permissões de mestre/jogador.

## Decisão

Acrescentar efeitos livres ao combate, com alvo, nome, origem opcional, duração e visibilidade. JSON 006, formato de combate 2, SQL continua 6. Migrar o combate anterior sem reconstruir ordem/rodada/iniciativa, conservando sua versão de alteração.

Descontar rodadas ao cruzar a rodada confirmada; encerrar efeitos de próximo turno ao receber a vez. Pausar alvos excluídos do combate. Manter registros encerrados até remoção explícita para que a mudança continue visível. Não descontar ao reconectar/consultar/ordenar, nem ao repetir uma identidade confirmada.

Reutilizar ações versionadas e confirmação privada do item 54. Mestre/ADM em modo mestre conduzem; jogador recebe apenas efeitos públicos também em SSE/exportação. Remoção de alvo definitivo limpa seus efeitos na mesma transação. Limites de 80 por mesa/10 por alvo, incluindo encerrados.

## Consequências e evidência

Sem relógio local como fonte de duração, serviço externo ou regras automáticas de um sistema de RPG. Encerrar combate conserva durações; efeitos manuais continuam até remoção. Backup integral conserva privados e exportação restringe acesso.

Um teste HTTP integrado, suíte 133/133, build e navegador desktop/celular: duração/identidade, acesso/validação/conflito, rollback, restauração e migração idempotente. Contrato e limites em [COMBAT_EFFECTS.md](../COMBAT_EFFECTS.md).
