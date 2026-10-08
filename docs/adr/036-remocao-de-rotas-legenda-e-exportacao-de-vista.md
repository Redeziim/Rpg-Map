# 036. Remoção de rotas, legenda editável e exportação de vista

Data: 2026-10-08. Substitui, no que toca a essas três funções, a decisão 004 (exploração e exportação).

## Contexto

A revisão de usabilidade (`docs/REVISAO_UX.md`) achou o painel de Ferramentas do Mapa 2D com dez instrumentos de peso igual. O usuário decidiu tirar Rotas de exploração, Legenda do mapa e Exportar vista.

## Decisão

Removidos da interface, do servidor e dos testes: as rotas `/map-routes` e `/map-legend`, os campos `mapRoutes` e `mapLegend` do estado da mesa, `mapRouteVersions` e `mapLegendVersion` do que o servidor envia, o desenho das rotas e da legenda sobre o mapa, o PNG da vista e a auditoria dessas alterações. Os cinco tipos de ponto continuam com nome e cor, agora fixos em `defaultMapLegend()` (`src/shared/mapExploration.js`).

Não houve migração de banco: o estado da mesa é um documento JSON e esses campos eram opcionais para o validador depois da mudança.

## Dados antigos

- Mesas que já tinham rotas ou legenda guardadas continuam abrindo. O servidor nunca envia esses campos a um cliente nem os põe em uma exportação (rotas só do mestre não vazam) e os apaga do documento no próximo salvamento da mesa.
- Backups antigos que contêm os campos restauram normalmente.
- Entradas antigas da auditoria (`map.legend`, `map.routes`) continuam legíveis com seus rótulos.

## Consequências

- O teste `tests/mapExploration.test.js` agora garante que as rotas somem (404), que os campos não aparecem em visão, SSE ou exportação e que o salvamento limpa o que sobrou.
- Voltar a ter rotas exige reescrever a função; o histórico do git guarda a versão anterior (commits até `393b235`).
