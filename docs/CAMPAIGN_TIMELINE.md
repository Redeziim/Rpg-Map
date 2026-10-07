# Linha do tempo da campanha — item 57

## Estado atual

Entregue em 2026-10-07. Somente mestres e o ADM no modo mestre criam, editam, arquivam e restauram. Jogadores consultam os registros publicados. A aba **Linha do tempo** (rótulo curto "Diário" no celular) está na navegação principal. Decisão registrada em `docs/adr/034-linha-do-tempo-da-campanha.md`.

## Tipos

- **Sessão** e **Decisão**: podem ser publicadas para jogadores. O resumo de uma sessão é o texto do registro de Sessão, escrito pelo mestre.
- **Preparação**: anotação do mestre para a próxima sessão. É sempre reservada: criar ou editar com `visibility: table` retorna 400, e mudar um registro publicado para Preparação exige `visibility: master` na mesma edição. O editor oferece um roteiro inicial (objetivo, cenas e pontos, personagens e ameaças, pontas soltas, decisões pendentes).

## Registro

`id`, `kind` (`session`, `decision` ou `prep`), `date` (`AAAA-MM-DD`, validada no calendário), `title` (até 120), `body` (até 10.000), `visibility` (`master` ou `table`), `pointIds` e `sceneIds` (até 20 cada), `archived`, `author`, `createdAt`, `updatedAt`, `version`.

## API

Todas sob `/api/rooms/:roomId/timeline`, autenticadas e com `mapViewMode`.

| Método e rota | Quem | O que faz |
| --- | --- | --- |
| `GET /` | participante | Página de 20 registros. Parâmetros: `kind`, `archived=1` (mestre), `before=data,criação,id` e `revision`. Devolve `entries`, `hasMore`, `next`, `revision`. |
| `GET /:id` | participante | Detalhe. Reservado ou arquivado aparece como 404 para jogadores. |
| `POST /` | mestre | Cria. O corpo leva `id` gerado pelo cliente. Repetir o mesmo corpo devolve 200 sem duplicar; corpo diferente com o mesmo `id` dá 409. |
| `PATCH /:id` | mestre | Edita ou arquiva (`archived`). Exige `expectedVersion`. Conflito: 409 com `details.current`. |
| `GET /:id/versions` | mestre | Histórico, da mais nova à mais antiga. |
| `POST /:id/restore` | mestre | Restaura `version` como uma nova versão. Exige `expectedVersion`. |

## Ordem, páginas e revisão

Mais recentes primeiro: data do acontecimento, depois criação e identificador. O cursor pertence a um registro visível. A revisão resume o que a pessoa pode ler (contagem, soma de versões e última alteração; mestres e jogadores têm revisões diferentes). Uma página pedida com revisão antiga recebe 409; a tela avisa e volta aos mais recentes. O snapshot da mesa traz `timelineRevision` para a tela saber quando recarregar.

## Privacidade

- Jogadores nunca recebem registros reservados ou arquivados, nem em página, detalhe, snapshot, SSE, auditoria ou exportação.
- Vínculos são filtrados contra os pontos (com névoa) e cenas que a pessoa já enxerga.
- O texto não vai para a auditoria; só o tipo de ação `timeline.changed`.

## Edição na tela

Diálogo de edição com data, tipo, título, texto, visibilidade e vínculos. O rascunho é guardado no navegador por pessoa e mesa, pergunta antes de descartar e sobrevive a recarga. Se o registro mudou em outra janela, o editor oferece a revisão campo a campo (manter o rascunho ou usar a versão da mesa). O histórico de versões abre em diálogo próprio e restaura com um clique.

## Persistência e recuperação

Migração SQL 008: `timeline_entries`, `timeline_versions` e `idx_timeline_entries_order`. Backup e restauração conferem os registros e recusam um banco com data inválida, autor inexistente ou última versão diferente do registro atual. `npm run db:diagnose` conta registros e versões por mesa. A exportação JSON inclui `timeline` e `counts.timeline`.

## Validação

`tests/campaignTimeline.test.js` cobre pela API HTTP: permissões, autoria, validações, idempotência, privacidade e filtro de vínculos, ordem e páginas, revisão antiga, conflito, histórico e restauração, arquivamento, auditoria, exportação por papel, reinício, backup e restauração e recusa de dado inválido. Navegador: criação pelo editor, leitura como jogador, 1440 e 390 px sem rolagem horizontal. Acessibilidade em 2026-10-07: axe-core 4.14 (WCAG 2.0 a 2.2 A/AA e melhores práticas) sem violações na lista, no editor, na confirmação de descarte e no histórico, em desktop e celular; todos os controles com pelo menos 44 px de altura e largura em 390 px (exceto caixas de seleção); diálogos prendem o foco, fecham com Escape e devolvem o foco a quem os abriu. Falta teste com leitor de tela real.

## Limites conhecidos

Não há exclusão definitiva nem importação pela interface. O rascunho usa só `localStorage`. Não há pesquisa de texto na linha do tempo.
