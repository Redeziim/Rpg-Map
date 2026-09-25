# Teste de duas telas — 25/09/2026

O servidor local foi iniciado com `npm run dev -- --host 0.0.0.0 --port 5173 --strictPort`. `GET /` e `GET /api/health` responderam pela interface de rede `192.168.100.116:5173` (HTTP 200 e `{"ok":true}`). A API interna permaneceu em `127.0.0.1:3001` e foi alcançada pelo proxy do Vite.

Um cliente no navegador integrado entrou como ADM (`qa_20260924`) e outro no Chrome entrou como jogador (`qa_segunda_20260924`). Ambos abriram a mesma `Mesa de QA` e exibiram `Conectado à mesa`, dois participantes e o turno do jogador. A troca de turno ADM → jogador já havia sido observada imediatamente nos dois clientes em 24/09. Neste complemento, a tela do ADM oferecia gerenciamento de participantes; a do jogador não. Em `Status do grupo`, ambos exibiram o jogador em turno.

Uma rolagem `1d20` foi enviada pela API autenticada do jogador para exercitar a sincronização entre as duas sessões. A resposta foi `201`, total `6`. As duas interfaces receberam a atualização em tempo real e mostraram `@qa_segunda_20260924 · rolou`, `1d20: [6]`, `Total 6` e o destaque do resultado. A [captura do ADM](resultado-adm.jpg) registra o destaque. O lançamento por arrastar a mão na interface não foi exercitado neste complemento.

No Chrome, o viewport foi ajustado a 390×844 e a [captura do jogador](jogador-mobile.jpg) mostra navegação, turno, participantes e bandeja. A largura de rolagem do documento foi 382 px para um viewport de 390 px, sem transbordamento horizontal. O viewport do navegador foi restaurado ao fim.

Limites: o teste móvel foi feito em viewport emulado, sem um telefone físico. O IP local é dinâmico; o endereço deve ser conferido no computador antes de cada uso. Este teste valida acesso pela interface de rede do computador e sincronização de turno/rolagem entre dois clientes, mas não mede latência, rede externa ou desempenho em aparelho fraco.
