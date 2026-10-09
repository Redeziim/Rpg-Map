# Tokens de design — item 63

Fonte única: o bloco `:root` de `src/theme.css`. Código novo usa estes nomes; não cria cores, famílias de fonte, espaçamentos ou durações soltos. `tests/designTokens.test.js` confere o catálogo, recusa `var(--x)` sem declaração e impede que o total de cores literais suba.

## Cor

Carvão com leve tom frio, papel escuro de tinta quente, ouro envelhecido como acento principal e vinho como apoio (perigo e moldura). Paleta ajustada em 2026-10-08 para a direção gótica sutil (`docs/DIRECAO_GOTICA.md`); os nomes dos tokens não mudaram, só os valores.

| Papel | Tokens |
| --- | --- |
| Texto | `--ink` #ebe5d8, `--ink-strong` #f1e8d2, `--ink-warm` #d6c8a6, `--ink-soft` #bba982, `--muted` #b4aea3 |
| Ouro (ação, seleção, foco) | `--gold-light` #dcc896, `--gold-bright` #cdb682, `--gold` #bfa56b, `--gold-deep` #a38b55, `--gold-shadow` #6a5a38 |
| Filetes e bordas | `--rule-soft` #38322a, `--rule` #50473a, `--rule-strong` #74664a, `--line-strong` #4a4133, `--line` (ouro a 22%) |
| Superfícies neutras | `--surface-0` #0b0c0c, `--surface-1` #121313, `--surface-2` #1a1b1a |
| Superfícies de papel | `--paper-0` #161412, `--paper-1` #1d1a16, `--paper-2` #2a251f |
| Alerta | `--red` #6f2a32, `--accent` #b8736c, `--danger-ink` #e8c2bb |
| Extremo | `--black` #000000 |
| Texto sobre vinho | `--on-red` (marfim claro nos dois temas) |
| Concluído ou válido | `--ok-ink` #b8ccb2 (verde de sálvia, só onde a cor precisa dizer "ok") |
| Vinho e névoa (apoio) | `--wine-deep` #32141a, `--wine-line` #7a3a42, `--fog` #7a8683, `--fog-deep` #232928 |

Regra de uso: ouro marca o que se pode acionar ou o que está selecionado; filete separa; superfície de papel agrupa. Borda dourada cheia fica para seleção e ação principal.

## Tipografia

| Token | Valor | Uso |
| --- | --- | --- |
| `--font-display` | 'Cormorant Garamond', Georgia, serif | títulos e nomes de tela |
| `--font-brand` | 'Grenze Gotisch', Cormorant Garamond, serif | só a marca "Grimório" |
| `--font-body` | Source Sans 3, system-ui, sans-serif | texto, formulários, rótulos |
| `--fs-label` / `--fs-small` | 12 px / 13 px | rótulos e apoio; nada abaixo de 12 px |
| `--fs-body` / `--fs-lead` | 16 px / 18 px | texto e abertura de seção |
| `--fs-title` / `--fs-heading` | 20–25 px / 26–40 px (fluido) | títulos de registro e de página |
| `--lh-body` / `--lh-tight` | 1,6 / 1,25 | entrelinha de leitura e de título |

Texto corrido fica em no máximo 72 caracteres por linha.

As fontes decorativas da ficha (MedievalSharp, Uncial Antiqua, IM Fell English, Metamorphous e Grenze) não vêm com a página: `src/shared/sheetFonts.js` pede cada uma ao Google Fonts quando o mestre a escolhe, e `tests/sheetFonts.test.js` confere que o nome pedido é o nome usado.

## Espaço, forma e alvo

`--space-1` 4 px, `--space-2` 8, `--space-3` 12, `--space-4` 16, `--space-5` 24, `--space-6` 32. Raios `--radius-s` 2 px e `--radius-m` 4 px; não usar raios maiores. A única exceção é `--radius-arch` (48 px), o arco de pedra do cartão de atributo da ficha. `--target` 44 px é a altura mínima de qualquer controle tocável.

## Movimento e foco

`--motion-fast` 120 ms, `--motion-base` 200 ms, `--ease-out`. Sempre nomear a propriedade (`transition: opacity var(--motion-fast) var(--ease-out)`); nunca `all`. Só `transform` e `opacity` em controles. `theme.css` zera animação, transição e rolagem suave em `prefers-reduced-motion`.

`--focus-ring` e `--focus-offset` definem o contorno de foco: `outline: var(--focus-ring); outline-offset: var(--focus-offset)`.

## Estado da consolidação

Em 2026-10-07: 264 cores literais viraram token quando ficavam a até 2 de diferença perceptual (ΔE) do token, e 147 famílias de fonte viraram `--font-display` ou `--font-body`.

Em 2026-10-09: o resto migrou. Cada hexadecimal passou ao token mais próximo no espaço Lab (ΔE até 16), com a transparência preservada por `color-mix(in srgb, var(--token) N%, transparent)`. Cinzas azul-esverdeados escuros, que eram fundos e bordas estruturais das notas, viraram `--paper-1` e `--rule`; só os avisos de sucesso ficaram com `--ok-ink`. O bloco `<style>` de 2100 linhas que ficava dentro de `RPGMapExplorer.jsx` virou `src/legacy.css` (sem o `@import` de fontes do Google), passou pelo mesmo caminho e entrou sob a verificação. `--accent` clareou de #a8655f para #b8736c, porque como texto dava 4,4:1 sobre o carvão. O limite do teste caiu de 710 para 0; a única exceção declarada é `components/MapStrokeColor.css`, a roda de cores do traço, cujos hexadecimais são as cores que a pessoa escolhe. Cores em arquivos JavaScript (canvas, exportação do mapa, peles dos dados) seguem literais por serem desenho, não folha de estilo.

## Temas

Dois temas, escolhidos no botão "Tema claro" (rodapé da navegação lateral, cabeçalho de "Minhas mesas" e painel de login). O padrão é o sombrio e não escreve atributo; o claro liga `<html data-theme="claro">`. A escolha fica em `localStorage` (`grimorio-tema`), vale só para este navegador e acompanha as outras abas abertas. Um script em `index.html` aplica o tema salvo antes da primeira pintura.

- **Sombrio**: os valores de `:root` em `src/theme.css` (carvão, ouro envelhecido, vinho).
- **Claro** (`src/themeLight.css`): papel envelhecido (`--surface-0` #e7dec9, `--paper-0` #f3ebd8), tinta marrom (`--ink` #2a2118) e ouro escurecido. Nos tons de ouro, `--gold-light` e `--gold-bright` continuam sendo os mais fortes, o que no claro quer dizer mais escuros. A fumaça de fundo (vídeo com mistura "screen") some no claro.
- **Regra para código novo**: use só tokens, nunca hexadecimais, e confira o par texto e fundo nos dois temas. `tests/themeLight.test.js` exige que o claro redefina todo token de cor do sombrio e que 13 pares de texto e fundo passem em AA (4,5:1) nos dois.
- **Fora do tema**: a cena 3D, o desenho do mapa, as peles dos dados e o PNG exportado são conteúdo da campanha e continuam como estão.
