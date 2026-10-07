# Histórico de rolagens — base pública do item 53

Estado em 2026-10-07: histórico público e rolagens privadas implementados. O item 53 está concluído.

## Uso

Na Ficha ou no Status do Grupo, abra **Histórico da bandeja**. A lista mostra autor, horário local, expressão e total. **Ver dados e contexto** abre os valores individuais, origem, mesa, rodada e cena escolhida. Uma jogada com dado preso/inclinado/fora da área fica registrada sem total válido.

**Cena da rolagem (opcional)** usa as cenas disponíveis para a pessoa que lança. O contexto é registrado pelo servidor. Se uma cena ficar oculta, arquivada, removida ou inacessível pela névoa, seu identificador/título deixam de aparecer para leitores sem acesso, inclusive na exportação. Não são publicados texto da cena, notas ou arquivos vinculados.

O histórico guarda as últimas **500 rolagens da bandeja por mesa**, em páginas de 20. Uma alteração confirmada da mesa invalida páginas anteriores já abertas; o usuário pode carregá-las novamente a partir da visão atual. Os dados rolados localmente na Ficha, com a opção de bandeja desligada, continuam no histórico da sessão do navegador. Rolagens anteriores à implementação não podem ser reconstruídas.

## Escrita e confirmação

`POST /api/rooms/:id/tray-rolls` mantém o simulador físico existente. Autor e horário vêm do servidor. O resultado é o mesmo usado nas faces/animação; não existe um segundo sorteio para o registro.

O cliente cria `operationId` UUID e `requestedAt` ao lançar. O corpo do primeiro envio fica preservado para uma repetição do mesmo lançamento. Receber um erro de rede não é tratado como prova de falha. Repetir o corpo devolve `200` e `rollReceipt: {id, operationId}`, sem novo sorteio, revisão ou evento; a primeira confirmação devolve `201`. Reutilizar o identificador com outro corpo devolve `409`.

Novos pedidos precisam ter horário de preparação dentro dos últimos dois minutos, com tolerância de um minuto à frente. Confirmações permanecem sete dias. Depois desse prazo, o pedido original recebe `410`, também após a limpeza do recibo, pois seu horário de preparação expirou. Guardar os dados e preparar outra jogada cria uma nova intenção. Clientes antigos sem identidade continuam aceitos, mas não recebem a proteção contra repetição do cliente novo.

Registro, confirmação, última animação, retenção e incremento da revisão usam uma transação. SSE é emitido depois de COMMIT. Toda consulta e escrita valida a participação na mesa. O histórico de dados é separado do registro administrativo.

## Persistência e recuperação

Migração SQLite **005**, `user_version=5`. O JSON da mesa continua `stateVersion=5`, sem outra migração de combate.

- `dice_rolls`: registros compactos com identidade, dono, horário e resultado/contexto; no máximo 500 por mesa.
- `dice_receipts`: identidade, resumo do pedido e confirmação por sete dias; limpeza de até 100 vencidos por rodada de manutenção.
- `dice_live`: somente a última animação completa de cada mesa. Históricos não repetem seus frames.

O reinício conserva histórico e última jogada; uma animação cujo horário terminou aparece parada. Backup/restauração preservam os registros e confirmações. Inicialização e recuperação recusam registros incompatíveis. Exportações incluem os registros permitidos em `diceHistory` e a contagem `diceRolls`; metadados de repetição e frames não entram no arquivo exportado.

`GET /api/rooms/:id/dice-history?before=:rollId` retorna `{entries, hasMore, revision}`. `before` deve ser um registro da própria mesa que ainda está retido. Snapshot/SSE incluem a primeira página em `diceHistory` e `diceHistoryHasMore`.

## Verificação

Um teste integrado na API HTTP real verifica autor/horário/expressão/valores/contexto, acesso externo recusado, repetição, reinício, exportação, backup/restauração, 500 registros sem duplicatas, expiração e backup incompatível recusado. Foram preservados os testes existentes de faces/física e atualizadas as fixtures de esquemas antigos. Suíte completa: **131/131**. Build aprovado, com o aviso conhecido do pacote Three.js.

Navegador com `npm run dev`, SQLite descartável e larguras 1440/390 px: estado vazio, lançamento por arraste, face/total 19, cena e rodada 2, reabertura, páginas 20→24, Enter/Tab, foco de 2 px, controles novos de 44 px e ausência de overflow/erros de console. HTTP manual confirmou que uma cena escondida fica fora do histórico/exportação do jogador, enquanto seu contexto permanece disponível ao mestre autorizado. A cena foi restaurada ao estado anterior após o teste.

## Rolagens privadas (decisão de 2026-10-07)

Decisão do usuário: cada pessoa vê o próprio histórico de rolagens privadas e o ADM vê o de todos.

- Quem lança marca **Rolagem privada · só você e o ADM veem o resultado** antes de pegar os dados. O corpo de `POST /tray-rolls` aceita `private: true|false` (outro tipo devolve `400`). A opção faz parte da identidade da operação: repetir o mesmo corpo devolve o mesmo recibo; repetir com outra visibilidade devolve `409`.
- O registro guarda `visibility: "private"` no mesmo JSON do SQLite, sem nova migração (`user_version` continua 7, `stateVersion` 5).
- Leitores permitidos: o **autor** e o **ADM da mesa**, em qualquer modo de visão. Outros mestres e jogadores não recebem a rolagem em `dice-history`, no snapshot/SSE (`diceHistory`), na exportação e, para a animação da bandeja, em `trayRoll` (que chega como `null`). A paginação filtra no SQL, então `hasMore` e o cursor `before` seguem consistentes.
- A trava interna "aguarde os dados pararem" continua usando a última rolagem de verdade, privada ou não, para que ninguém lance por cima.
- Entradas privadas aparecem com a etiqueta **Privada** no histórico de quem pode lê-las.
- Teste: `tests/diceHistoryPrivate.test.js` cobre autor, ADM, jogador, outro mestre, repetição, conflito, paginação e exportação.

Skills: tdd, frontend-design e web-design-guidelines. Sem API externa, pacote novo ou migração.
