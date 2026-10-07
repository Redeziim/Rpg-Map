# 032 — Cenas de vídeo com exibição e acesso posterior separados

Data: 2026-10-04. Estado: aceito conforme orientação do usuário.

## Contexto

O usuário esclareceu que Cenas serve para vídeos/animações: o mestre libera e inicia para os jogadores, guarda o conteúdo e decide se fica disponível para rever. O plano anterior do item 56 tinha foco em notas/participantes e foi substituído por essa definição.

## Decisão

Guardar arquivos binários em SQLite, na tabela `scene_media`, e referências em cenas versionadas. Uma apresentação compartilhada confirmada (`scenePresentation`) concede acesso temporário à cena em exibição. A visibilidade da cena concede separadamente acesso posterior. Não copiar arquivos para snapshots/SSE nem vincular essa permissão à revelação do mapa 2D.

Controlar posição/pausa pelo mestre usando SSE e horário do servidor. Correção é local; nunca gravar por quadro. Autoplay obedece o navegador e movimento reduzido. Ao bloquear som, tentar vídeo silencioso com botão de som; entrada explícita permanece disponível. GIF usa pausa visual e reinicia ao continuar; vídeo tem linha do tempo.

SQL e JSON evoluem para 7 em migração atômica. Preservar combate atual, notas, modelos, regras de acesso e backups anteriores. Exportações autorizadas incluem mídia; restauração confere BLOBs e referências. Sem serviço externo, framework novo ou dependência nova na aplicação.

## Consequências

Mestre prepara, apresenta e concede/revoga leitura posterior independentemente. Arquivos aumentam tamanho de banco/backups; limites explícitos e biblioteca permitem reutilização/exclusão sem referências. Um arquivo recebido/exportado não é revogável no dispositivo remoto. Codec, autoplay, rede e GIF limitam a precisão de reprodução. Contrato e evidências: `docs/SCENE_MEDIA.md` e `quality/56-interface-review.md`.
