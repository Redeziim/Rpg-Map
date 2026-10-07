# Revisão dos controles do item 51

2026-10-03. Skills `frontend-design`, `vercel-react-best-practices`, `web-design-guidelines` e `web-animation-design`. Direção: instrumentos táticos da Mesa 3D, com bloco compacto separado por linhas, cores de pergaminho e quatro ações explícitas de câmera. Regras consultadas na [fonte atual](https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md). Escopo limitado aos controles novos.

## src/components/tabletop/TabletopMap.jsx

- TabletopMap.jsx:33 — ✓ preferência lida uma vez; vetores transitórios em ref, sem render a cada movimento.
- TabletopMap.jsx:173 — ✓ seção nomeada, hierarquia, seletor rotulado, `name`/autocomplete, valor confirmado e estado de envio.
- TabletopMap.jsx:178 — corrigido: mensagem de falha junto à iluminação, com orientação e `role="alert"`.
- TabletopMap.jsx:180 — ✓ botões semânticos, nomes específicos, agrupamento acessível, teclado, disponibilidade e explicação do alcance pessoal.

## src/components/tabletop/TabletopMap.css

- TabletopMap.css:32 — ✓ contraste, foco herdado visível, hover, tamanho de 44 px e duas colunas em tela estreita. Sem transição nova.

## src/components/tabletop/TabletopScene.jsx

- TabletopScene.jsx:47 — ✓ troca de iluminação sem remontar câmera/modelos, efeitos com dependências pertinentes e descarte de listener.
- TabletopScene.jsx:214 — ✓ vistas sem movimento automático; restauração da mesa inteira e conservação da distância nas vistas diagonal/frontal.

### Revisão de movimento

| Antes | Depois |
| --- | --- |
| Vista superior como único preset | Superior, diagonal, frontal e restauração com mudança direta |
| Câmera perdida ao reabrir a mesa | Posição/alvo recuperados no navegador, sem percurso animado |
| Iluminação fixa | Presets mudam as luzes existentes, sem animação contínua |

Navegador: 1440×900 e 390×844, teclado, foco, recarga e duas abas. Luz sincronizada sem mover a vista superior da outra aba; modo jogador sem seletor de luz. Documento 382 px, botões 44 px e console sem erros. Não há achado pendente neste escopo.
