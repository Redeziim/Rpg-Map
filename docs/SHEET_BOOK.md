# Ficha em formato de livro

A ficha de personagem abre como um livro, em vez de uma coluna longa. Decidido em 2026-10-09: livro aberto com duas páginas, divisão automática e virada em 3D.

## Como funciona

- **Capa.** Retrato, nome do personagem, estado de salvamento e a ajuda das notas. O nome mostrado na capa é o campo "Personagem" da ficha, ao vivo.
- **Páginas.** Cada página recebe uma ou mais categorias do modelo, na ordem do modelo. Categorias curtas dividem a página; uma categoria maior que a página ocupa a sua e rola por dentro.
- **Ferramentas.** A última página, só para quem pode editar, traz a importação de ficha por PDF ou imagem.
- **Vistas.** Com 760 px ou mais de largura, duas páginas lado a lado (capa e página 1, páginas 2 e 3...). Abaixo disso, uma página por vez. A largura é a do próprio livro, não a da janela, então o painel de dados ao lado conta.
- **Virada.** A folha gira sobre a lombada em 640 ms (CSS `rotateY`, `perspective`), com uma sombra que cruza a folha. Numa página só, a folha abre pela borda esquerda e some. Em `prefers-reduced-motion` a troca é imediata.
- **Navegação.** Abas no topo (uma por página, a vista aberta fica destacada), setas de página anterior e próxima, teclas seta esquerda e direita, deslize horizontal no toque. As teclas não agem quando o foco está num campo de texto.
- **Ver como lista.** Volta ao painel antigo, contínuo, útil para leitores de tela e impressão. A escolha fica em `localStorage` (`grimorio-ficha-vista`), por navegador.

## Divisão em páginas

`src/shared/bookPages.js`. Cada categoria tem um peso em pixels, medido na ficha real com a página a uns 400 px de largura: cabeçalho 72, campo curto 90, área de texto 158, lista 140, barra de recurso 141, fileira de três atributos 124, linha de lista compacta 38, intervalo entre categorias 24. A capacidade da página é a altura medida do livro menos 158 px (cabeçalho, número e margens). Como a altura vem do `ResizeObserver`, a divisão muda quando a janela muda. `tests/bookPages.test.js` trava os pesos contra as alturas medidas.

Uma categoria acima da capacidade fica sozinha (por exemplo, três barras de recurso a 568 px de altura de livro). Isso é esperado.

## Acessibilidade

O livro é `role="group"` com `aria-roledescription="livro"`. Cada página é uma região com nome ("Página 3: Atributos") e o corpo rolável entra na ordem de tabulação. Durante a virada, as faces em movimento são cópias com `inert` e `aria-hidden`. O contador de páginas é `role="status"`. Alvos de toque de 44 px. Contraste conferido nos dois temas. Em contraste forçado, lombada e fios somem.

## Arquivos

`src/components/SheetBook.jsx` e `SheetBook.css` (livro), `src/shared/bookPages.js` (divisão), `src/components/CharacterSheet.jsx` (monta capa, categorias e ferramentas e alterna livro e lista).

## Limites

- A estimativa de altura não mede o DOM. Uma categoria com muitos itens de lista pode passar da página e rolar por dentro.
- As páginas fora de vista não ficam montadas; um campo em foco não sobrevive a uma virada.
- Não há virada ao arrastar a borda da página, só botões, teclas, abas e deslize.
