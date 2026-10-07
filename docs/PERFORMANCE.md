# Desempenho de carregamento — item 66

Medido em 2026-10-07 no build de produção (`npm run build` e `node server/index.js`), Chromium sem cache, máquina de desenvolvimento, `playwright-cli`. Os valores são bytes enviados pela rede (corpo codificado), não tempo de rede. Primeira pintura e maior pintura vêm do navegador, sem limitação de banda; servem para comparar antes e depois, não como promessa de tempo em rede real.

## Antes e depois

| Tela | Antes | Depois |
| --- | --- | --- |
| Login: primeira pintura / maior pintura | 216 ms / 228 ms | 56 ms / 116 ms |
| Login: bytes | 1.783 KB | 1.616 KB |
| Entrar na mesa | 1.037 KB | 253 KB |
| Aba Mapa | 206 KB | 61 KB |
| Aba Status do Grupo | 15.811 KB | 5.911 KB |
| Aba Linha do tempo | 29 KB | 10 KB |

## O que mudou

1. **Compressão dos arquivos estáticos** (`server/staticFiles.js`). Brotli (qualidade 5) ou gzip conforme `Accept-Encoding`, só para HTML, JS, CSS, SVG, JSON, OBJ e MTL acima de 1 KB. O resultado fica em memória (até 96 MB). O `base.obj` da bandeja caiu de 13,4 MB para 3,5 MB.
2. **Cache por nome**. Arquivos de `assets/` com hash no nome recebem `immutable` por um ano; os demais seguem em uma hora; `index.html` continua sem cache.
3. **Fontes sem bloquear a primeira pintura**. A folha de estilo do Google Fonts carrega com `media="print"` e troca para `all` ao terminar; `preconnect` também para `fonts.gstatic.com`. O texto aparece com a fonte de reserva e troca (`display=swap`).
4. **Vídeo do login depois da página**. O vídeo de 1,5 MB só é montado depois do evento `load` e de um momento ocioso; o poster aparece antes. Não carrega com economia de dados ou conexão 2G, nem com movimento reduzido.

## O que continua pesado

- `public/assets/tray/base.png` (2,4 MB) é a textura da bandeja de dados e carrega ao abrir Status do Grupo. Converter para WebP exige mudar o `base.mtl` e conferir a aparência; não foi feito.
- O `three` (cerca de 127 KB comprimido) carrega ao entrar na mesa porque a bandeja de dados compacta aparece em todas as abas. Adiar a bandeja até a primeira rolagem muda o comportamento da animação que outros jogadores veem e fica para uma decisão separada.
- O `base.obj` ainda tem 3,5 MB comprimido. Reduzir a malha muda o dado visualmente.

## Como repetir

Subir `node server/index.js` com `DB_PATH` curto (caminhos longos falham no SQLite do Windows) e um banco descartável, abrir com `playwright-cli`, entrar como jogador e coletar `performance.getEntriesByType('resource')` depois de cada aba. Testes: `tests/staticFiles.test.js`.
