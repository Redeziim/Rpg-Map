# Buscar pontos do mapa 2D — item 23, opção A

Decisão do usuário em 2026-10-07: opção A. Só o que o ponto já tem (nome, descrição e tipo); sem região, sem etiquetas e sem mudança nos dados salvos.

## O que existe

Na lista **Pontos de Interesse** do painel de Ferramentas 2D:

- **Buscar ponto**: cada palavra digitada precisa aparecer no nome, na descrição ou no nome do tipo; não importam acentos nem maiúsculas. "taverna porto" acha uma taverna chamada "Porto velho".
- **Chips de tipo** (Cidade, Dungeon, Taverna, Floresta, Evento), com a quantidade ao lado. A contagem acompanha a busca, e um tipo sem resultado fica desativado. Tocar de novo no tipo escolhido volta para Todos.
- **Lista ordenada por nome** (números por valor: "Ponte 2" antes de "Ponte 10"), com "n de N pontos" anunciado a leitores de tela e o botão **Limpar filtros**.
- **Ver no mapa** (ícone de alfinete em cada item): centraliza o ponto e dá no mínimo 150% de zoom, destaca o ponto por 5 s e não abre os detalhes. No celular o painel se fecha para o mapa aparecer. Clicar no nome continua abrindo os detalhes.
- No mapa, enquanto há busca ou tipo escolhido, os pontos de fora do resultado ficam esmaecidos.
- Estados vazios com orientação: mapa sem pontos e busca sem resultado.

## Privacidade

A lista recebe os mesmos pontos que o mapa já mostra: quem consulta só vê os revelados pela névoa. A busca só reduz essa lista; nunca a amplia (`tests/pointSearch.test.js`, caso do ponto oculto).

## Código

`src/shared/pointSearch.js` (filtro, contagem e cálculo de centralização), `src/components/PointFinder.jsx` e `.css`, ligados em `RPGMapExplorer.jsx`.

## Validação

Sete testes unitários. No navegador, como jogador: 12 pontos, busca por "porto", "alamo" (acento), "adega" (descrição) e duas palavras, filtro de tipo com 10 marcadores esmaecidos, mensagem de vazio, limpar, centralização a 9 px do centro e ponto destacado sem abrir detalhes; em 390 px, sem rolagem horizontal, alvos de 44 px e painel fechando ao mostrar o ponto.

## Limites

Região e etiquetas (opção B) ficam para quando a mesa passar de uns 30 pontos. O filtro vale só na sessão: ao recarregar a página, volta a mostrar todos.