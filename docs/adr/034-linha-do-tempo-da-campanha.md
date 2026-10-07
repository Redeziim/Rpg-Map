# 034 — Linha do tempo da campanha em tabelas versionadas

Data: 2026-10-07. Estado: aceito conforme a decisão do usuário de que só o mestre (ou ADM no modo mestre) cria e edita.

## Contexto

O leitor da linha do tempo existia como prévia, sem armazenamento, API ou navegação. O contrato de leitura (ordem, paginação, projeção de privacidade) estava definido em `src/shared/campaignTimeline.js`.

## Decisão

Guardar os registros em SQLite, fora do JSON da mesa: `timeline_entries` (versão atual) e `timeline_versions` (todas as versões, até 50 por registro). Migração SQL 008 acrescenta as duas tabelas e o índice de ordenação. O estado JSON da mesa não muda.

- Os registros não entram no snapshot nem no SSE. O snapshot leva apenas `timelineRevision`, um resumo do que a pessoa pode ler; quando muda, a tela recarrega a primeira página pela API.
- Leitura: `GET /timeline` pagina por cursor `data,criação,id`. O cursor só vale com a revisão da página; revisão antiga recebe 409 e a tela volta aos mais recentes.
- Escrita: somente `canManageMap` (mestre/ADM no modo mestre). Autoria vem da sessão. Novos registros começam reservados (`master`). O cliente cria o identificador, o que torna o reenvio idempotente.
- Edição e arquivamento exigem `expectedVersion`. Conflito devolve 409 com o registro atual; o rascunho local é preservado e a revisão é por campo. Não há exclusão: arquivar remove dos leitores e o mestre restaura.
- Restaurar uma versão grava uma nova versão com o conteúdo antigo. O histórico não é reescrito. Vínculos a pontos ou cenas que deixaram de existir são descartados na restauração.
- Vínculos a pontos e cenas são validados na escrita e filtrados na leitura contra o que a pessoa já vê. Um vínculo nunca libera o destino.
- Auditoria: ação `timeline.changed`, sem conteúdo. Exportação: `timeline` com registros reservados e arquivados só para quem exporta como mestre.
- Backup, restauração e diagnóstico conferem os registros (`assertSavedTimeline`): campos válidos, autor existente e última versão igual ao registro atual.

## Consequências

Limites: 500 registros por mesa, 10.000 caracteres de texto, 120 de título, 20 pontos e 20 cenas por registro. Bancos antigos migram sem alterar as mesas. Contrato e testes: `docs/CAMPAIGN_TIMELINE.md` e `tests/campaignTimeline.test.js`. O rascunho fica em `localStorage` por pessoa e mesa; IndexedDB não é usado aqui.
