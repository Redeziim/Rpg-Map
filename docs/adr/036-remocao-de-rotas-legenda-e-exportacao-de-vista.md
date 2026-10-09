# 036. Remoção de rotas, legenda editável e exportação de vista

Data: 2026-10-08. Substitui, no que toca a essas três funções, a decisão [004](004-exploracao-e-exportacao.md).

## Contexto

A revisão de usabilidade (`docs/REVISAO_UX.md`) achou o painel de Ferramentas do Mapa 2D com dez instrumentos de peso igual. O usuário decidiu tirar Rotas de exploração, Legenda do mapa e Exportar vista.

## Decisão

Removidos da interface, do servidor e dos testes: as rotas `/map-routes` e `/map-legend`, os campos `mapRoutes` e `mapLegend` do estado da mesa, `mapRouteVersions` e `mapLegendVersion` do que o servidor envia, o desenho das rotas e da legenda sobre o mapa, o PNG da vista e a auditoria dessas alterações. Os cinco tipos de ponto continuam com nome e cor, agora fixos em `defaultPointTypes()` (`src/shared/pointTypes.js`).

Não houve migração de banco: o estado da mesa é um documento JSON e esses campos deixaram de ser exigidos pelo validador (`assertRoomState`).

## Dados antigos

- Os dois campos estão numa lista só, `REMOVED_STATE_FIELDS` (`server/roomState.js`), e `stripRemovedFields` é o único ponto que os apaga.
- Mesas que já tinham rotas ou legenda guardadas continuam abrindo. O servidor tira esses campos de toda visão (`snapshot`, que também alimenta o SSE) e a exportação escolhe só os campos do estado atual, então rotas privadas do mestre não vazam. O próximo salvamento da mesa apaga os campos do documento.
- Backups antigos que ainda têm os campos verificam e restauram; a mesa restaurada abre sem expô-los.
- As entradas antigas da auditoria (`map.legend`, `map.routes`) continuam legíveis com seus rótulos; novas não são geradas.

## O que isso custa

- **A limpeza é definitiva.** O primeiro salvamento de cada mesa apaga as rotas e a legenda antigas, sem cópia e sem aviso. Antes de atualizar uma instalação que as usava, faça `npm run backup`.
- **Voltar atrás exige um backup anterior.** A versão anterior do aplicativo exigia `mapRoutes` (lista) e uma legenda válida para abrir uma mesa. Depois do primeiro salvamento por esta versão, o estado não tem mais esses campos e a versão antiga recusaria abri-lo. Para voltar, restaure um backup feito antes da atualização.
- Voltar a ter rotas exige reescrever a função; o histórico do git guarda a versão anterior (commits até `393b235`).

## Testes

`tests/removedMapTools.test.js` garante: os endpoints respondem 404 e `PATCH /state` recusa o campo; uma mesa guardada com os campos antigos não os mostra na visão do mestre, do jogador e do dono, nem na exportação de dono e jogador; o primeiro evento SSE de mestre e jogador vem sem eles; um backup feito pelos scripts reais com os campos antigos verifica, restaura e abre sem vazar; e o salvamento limpa o documento. Os cinco tipos de ponto têm teste próprio.
