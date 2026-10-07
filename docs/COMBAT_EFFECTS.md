# Condições e efeitos — item 55

Escolha confirmada pelo usuário: duração individual em rodadas, até receber o próximo turno ou remoção manual. Entrega local de 2026-10-04.

## Interface

Em **Condições e efeitos → Adicionar um efeito**, mestre/ADM em modo mestre escolhem participante, nome, origem opcional, quem vê e duração. O painel mostra os efeitos em andamento e encerrados; o aviso de turno cita os efeitos do participante ativo. Não depende apenas de cor ou som.

Jogadores acompanham efeitos públicos. **Só mestres e ADM** não aparece no modo jogador, inclusive para o ADM, nem em sua exportação. Adicionar um efeito não compartilha nenhuma nota ou outro conteúdo.

Um efeito automático que chega ao fim fica **Encerrado** até ser removido. Ele já não aparece como efeito em andamento no aviso do turno. **Remover** abre uma confirmação dentro do painel; cancelar conserva o efeito. Se o combate mudar, revisar a ordem/efeito atual é uma ação explícita. Texto digitado permanece diante de falha/conflito, e a confirmação de uma intenção anterior não limpa outro rascunho.

## Marcos de duração

| Duração | Comportamento |
| --- | --- |
| Rodadas, 1–99 | Desconta 1 ao começar uma nova rodada confirmada. Adicionar durante uma rodada não concede uma rodada extra. Iniciar na rodada 1 não desconta. |
| Até receber o próximo turno | Encerra quando o alvo recebe a vez, também por **Dar turno** ou avanço após retirada do ativo. Se foi adicionado antes de iniciar, o primeiro turno do alvo encerra o efeito. |
| Até remover manualmente | Não recebe desconto automático. Permanece ao encerrar/reiniciar o combate. |

- Reorganizar, ordenar, dar o turno novamente ao mesmo ativo, consultar, reconectar e reabrir não descontam rodadas nem encerram uma vez adicional.
- Com apenas um participante, pular seu turno inicia uma nova rodada e conta como receber a vez novamente.
- Efeitos de jogadores fora do combate ficam guardados e não recebem desconto enquanto estiverem fora. Recolocar conserva o saldo.
- Remover um NPC, retirar uma conta da mesa ou promovê-la a mestre limpa seus efeitos junto da mudança de participantes. Retirar um jogador somente do combate conserva seus efeitos.
- Encerrar zera ativo/rodada conforme o contrato existente, sem apagar efeitos ou suas durações restantes.

## API e dados

Reutiliza `POST /api/rooms/:roomId/turns` com versão, permissões e confirmação por identidade do [item 54](COMBAT_RECOVERY.md).

`effect-add` recebe `player`, `name` (2–60 caracteres), `origin` (0–120), `visibility` (`all`/`master`) e `duration` com `kind` (`rounds`/`next-turn`/`manual`) e `remaining` (1–99, 1 ou null, respectivamente). `effect-remove` recebe `effectId`. Campos desconhecidos, alvo inexistente, duração inválida e versão antiga são recusados.

Persistência: JSON de mesa **6**, formato de combate **2**, SQL continua **6**. `combat.effects` contém identificador UUID, alvo, nome, origem, visibilidade e duração. Zero em uma duração automática significa encerrado. Limites: 80 efeitos por mesa e 10 por participante, incluindo encerrados. Remova registros encerrados para liberar espaço; não há eliminação silenciosa.

Transição e desconto ocorrem na mesma escrita de combate/versão/revisão/auditoria/confirmação. Repetir a identidade não cria outro efeito nem desconta de novo. SSE sai depois de COMMIT. GET, SSE, consulta de confirmação e exportação projetam somente efeitos permitidos; os ocultos não contribuem para as contagens do cliente. Auditoria usa o evento genérico de combate, sem nomes/origens dos efeitos.

## Migração e recuperação

Etapa JSON 006 valida o combate 1 do estado 5, acrescenta uma lista vazia e passa ao formato 2. Conserva ordem, NPCs, exclusões, iniciativas, ativo, rodada e versão de alteração do combate; a revisão da mesa aumenta uma vez. Estados anteriores passam pelas etapas existentes na mesma transação. Reinício não repete conversão ou desconto. Notas, imagens, arquivos 3D, iluminação, contas e confirmações existentes são preservados.

Backup/restauração inclui efeitos públicos e reservados na cópia integral do servidor; exportação obedece ao modo/papel. Restauração conserva o arquivo anterior e a migração acontece ao abrir a cópia. Nenhuma API externa, dependência nova ou mudança de persistência.

## Validação e limites

Um teste HTTP integrado cobre três durações, início/encerramento, participante único, pausa fora do combate, remoção de NPC, repetição de criação/avanço, concorrência, validação, privacidade em GET/SSE/exportação, rollback, backup/restauração e migração 5→6 idempotente. Suíte completa: **133/133**. Build e `npm run dev` aprovados; navegador 1440/390 px com Enter, foco, confirmação/cancelamento, conflito preservando texto, duração após recarga, controle de 44 px, página 382 px e console sem erros.

São condições livres: não aplicam modificadores de um sistema de RPG automaticamente. O formulário de uma intenção ainda não enviada permanece na tela e avisa antes de recarregar/fechar com texto; a confirmação de um comando enviado tem a proteção local do item 54. Não é uma biblioteca persistente de rascunhos de efeitos. Evidências em [quality/55-interface-review.md](../quality/55-interface-review.md).
