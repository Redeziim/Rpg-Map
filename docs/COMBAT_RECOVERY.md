# Recuperação de comandos de combate

Item 54 aplicado localmente. Complementa [COMBAT_STATE.md](COMBAT_STATE.md).

O [item 55](COMBAT_EFFECTS.md) acrescentou as ações `effect-add`/`effect-remove` à mesma confirmação. O JSON atual é 6; a referência ao JSON 5 abaixo registra o formato na entrega original do 54.

## Como usar

O combate exibido vem do estado confirmado da mesa. A conexão precisa estar pronta para enviar uma alteração.

- Durante o envio, os próximos comandos ficam bloqueados.
- Se a resposta não chegar, **Comando sem confirmação** mantém o bloqueio. **Verificar resultado** consulta o servidor sem repetir a alteração.
- Ao reconectar ou reabrir a mesa, a consulta é feita automaticamente. Uma confirmação mostra a ordem atual, mesmo que outro mestre já a tenha alterado.
- Se ainda não houver confirmação, **Reenviar a mesma ação** é uma escolha explícita. Conserva o identificador, horário, comando e versão originais.
- Quando uma confirmação antiga não estiver mais disponível, ou a cópia local estiver ilegível, confira a mesa e use **Conferi a ordem atual**. Essa ação consulta a mesa e libera os controles; não executa o comando antigo.

Iniciativa e nome digitados são preservados diante de falha ou conflito. A confirmação de um personagem anterior não apaga o nome de outro personagem que você começou a digitar durante o envio.

## Contrato HTTP

`POST /api/rooms/:roomId/turns` conserva as ações do combate e acrescenta os campos opcionais `operationId` (UUID) e `requestedAt` (milissegundos). O navegador atual sempre envia os dois. Identidades diferentes continuam sujeitas à versão do combate.

`GET /api/rooms/:roomId/turn-operations/:operationId?requestedAt=…` retorna o snapshot autorizado atual e `combatOperation`:

| Fase | Significado |
| --- | --- |
| `confirmed` | A operação foi gravada. Informa ação, versão resultante e se houve mudança. |
| `unconfirmed` | Não há confirmação disponível para aquela identidade recente; isso não prova que uma requisição em trânsito falhou. |
| `expired` | O horário ou a confirmação saiu do prazo permitido. Conferir a mesa antes de iniciar outra ação. |

Uma identidade já confirmada, com os mesmos dados, retorna o estado **atual** sem executar novamente, aumentar revisão ou emitir outro evento. A confirmação não contém uma cópia antiga do combate. Identidade reutilizada com dados diferentes retorna 409. Pedidos novos preparados há mais de dois minutos, ou mais de um minuto no futuro, são recusados com 410. Confirmações ficam disponíveis por sete dias; depois da limpeza, o horário antigo continua impedindo reaplicação.

Escrita do combate, revisão, registro da mesa e confirmação são uma transação. Falha ao gravar qualquer parte reverte o conjunto. SSE e resposta são publicados após COMMIT. Uma ação válida sem mudança pode guardar sua confirmação, sem alterar combate/revisão/auditoria ou publicar SSE.

Mestre/ADM em modo mestre enviam ações. A consulta identifica a operação pela conta e mesa atuais; um participante não consulta a confirmação de outro. Uma conta rebaixada pode consultar sua própria confirmação enquanto continuar na mesa; retirada da mesa impede o acesso. Clientes legados sem identidade continuam sujeitos a permissões/versão, mas não têm a garantia de confirmação por identidade.

## Persistência e compatibilidade

SQL 006 acrescenta `combat_operations` e seu índice de vencimento. JSON da mesa permanece 5. São guardados metadados de confirmação, sem texto de notas nem uma segunda ordem de combate. A manutenção remove até 100 confirmações vencidas por rodada.

A cópia local usa `grimorio-combat-pending-v1:<mesa>:<conta>` em localStorage. Guarda somente a intenção pendente, antes de enviá-la. Se não for possível guardá-la, o comando não é enviado. O aviso sobrevive a recarga; não publica automaticamente uma ação. Alterações da chave por outra aba são observadas. Apagar dados do navegador remove essa proteção local, sem alterar o combate salvo no servidor.

Backup/restauração inclui confirmações. Bancos e manifestos conhecidos das versões 0–5 conservam suas identidades e contagens. A restauração publica uma cópia; somente ao abrir essa cópia o servidor aplica as migrações restantes. Exportação de mesa mantém o combate confirmado e não inclui as confirmações privadas de transporte.

## Validação

Um teste integrado HTTP cobre resposta perdida, repetição, identidade adulterada, envio simultâneo, estado atual após ações de outro mestre, reinício, rebaixamento e retirada de acesso. Acrescenta falha SQLite durante a confirmação com rollback completo, backup/restauração com confirmações e compatibilidade de manifesto SQL 5. Suíte completa: 132 testes aprovados; o teste ampliado também passou isoladamente.

Navegador em 1440 e 390 px: resposta perdida, proteção após recarga, reconexão/reinício, reenvio explícito de uma ação não recebida, resposta HTTP antiga após SSE novo, teclado, alvos de 44 px e ausência de rolagem/avanço ao consultar. Formulário conserva o próximo nome enquanto a resposta anterior aguarda. Falhas HTTP esperadas foram simuladas somente no banco descartável; a aplicação normal foi conferida novamente. Evidências em [quality/54-interface-review.md](../quality/54-interface-review.md).

Limites: a confirmação expira; a proteção não deve ser confundida com histórico de combate ou execução offline. Nenhuma API externa ou dependência nova.
