# Revisão dos controles do item 50

2026-10-03. Skill `web-design-guidelines`; regras obtidas da [fonte atual](https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md). Escopo: controles novos de vínculos, acesso único a notas e mudanças na abertura da janela; não é auditoria geral do site.

## src/components/tabletop/ObjectReferencePanel.jsx

- ObjectReferencePanel.jsx:8 — corrigido: foco no seletor/lista após adicionar ou retirar; não se perde em um botão removido.
- ObjectReferencePanel.jsx:26 — corrigido: todos os destinos já vinculados têm mensagem própria.
- ✓ Rótulos, ações semânticas, nomes acessíveis por destino, vazio e limite de vínculos.

## src/components/tabletop/TabletopMap.css

- TabletopMap.css:29 — corrigido: listas extensas usam `content-visibility` e tamanho intrínseco.
- ✓ Foco, hover, quebra de nomes, controles de 44 px, cores dos selects e operação em tela estreita.

## Notas e navegação

- CharacterSheet.jsx:329 — ✓ acesso único a Minhas notas com explicação curta.
- RPGMapExplorer.jsx / Notebook.jsx — ✓ rascunhos com identidade anterior, janelas/estados existentes, abertura por objeto conserva Texto/Mapa mental; não introduz animação nova.
- TabletopMap.jsx — ✓ atualizações de vínculos anunciadas por status/alerta existentes; abertura bloqueada durante gravação/conflito/prévia.

Navegador: 1440×900 e 390×844; teclado, foco da lista, retirada, abertura e reabertura. Documento 382 px em celular de 390 px; janela de nota 374 px; console final sem erros. Evidências em `50-links-desktop.png`, `50-links-mobile.png` e `50-player-note-mobile.png`.
