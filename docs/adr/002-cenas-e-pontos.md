# Cenas de campanha e visibilidade dos pontos

Data: 2026-10-01. Estado: adotado.

## Contexto

O item 28 do plano pede cenas de campanha ligadas a pontos e indicadores de notas no mapa. A mesa possui conteúdo privado e névoa de guerra; compartilhar uma cena não pode revelar locais ocultos nem publicar automaticamente conteúdo após excluir um ponto.

## Decisão

- Cenas são fichas de texto no estado SQLite da mesa, com título, texto, pontos, visibilidade, arquivo e versão própria. Mestres e ADM no modo mestre gerenciam o arquivo. Jogadores consultam cenas compartilhadas.
- A visibilidade inicial é `master`. Publicar para a mesa exige escolher `table` e salvar explicitamente. Cenas arquivadas continuam acessíveis a mestres para restauração.
- GET e SSE entregam a jogadores somente cenas ativas e compartilhadas. Uma cena com vínculos exige pelo menos um ponto visível. Uma cena criada sem vínculos é acessível à mesa toda. Identificadores de pontos ocultos são retirados do resultado.
- Excluir um ponto conserva seu vínculo na cena para revisão pelo mestre. Vínculos indisponíveis não equivalem a uma lista vazia e não tornam a cena acessível à mesa toda.
- O ADM mantém seu papel real na API. Sua interface no modo jogador aplica os filtros da visão de jogador e não permite editar cenas.
- Indicadores são derivados do conteúdo já autorizado. Uma nota ligada ao mesmo ponto por vários cartões conta uma vez. Cenas arquivadas não entram na contagem.
- Edição e arquivo exigem a versão aberta pelo cliente. Conflitos preservam o rascunho e pedem revisão por campo. Criar novamente a mesma cena com o mesmo identificador e conteúdo é idempotente.
- Rascunhos reutilizam a estratégia local autorizada para notas, separados por mesa, pessoa e aba: `localStorage`, IndexedDB e cópia JSON disponível. Fechar permite manter ou descartar; publicar continua explícito.

## Consequências e limites

Uma cena pública com vários locais pode ser lida assim que um deles está revelado. O mestre deve separar informações que dependam de revelações diferentes em cenas distintas. Cobrir um local restringe os próximos envios; conteúdo já visto não pode ser revogado.

O arquivo aceita 100 cenas por mesa, incluindo arquivadas, com até 120 caracteres de título, 10.000 de texto e 30 pontos por cena. Esta etapa não introduz uma estratégia de persistência diferente nem um serviço externo.

## Evidência

`tests/campaignScenes.test.js` contém três testes: permissões, validação e concorrência; contagens e filtragem por névoa/arquivo; SSE e persistência após reinício. A suíte completa passou com 56 testes. Build e fluxos no navegador foram verificados em desktop e 390 px, incluindo recuperação real de rascunho após recarregar e ocultação de cena pela névoa durante a leitura do jogador.
