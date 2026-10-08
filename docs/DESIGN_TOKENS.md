# Tokens de design — item 63

Fonte única: o bloco `:root` de `src/theme.css`. Código novo usa estes nomes; não cria cores, famílias de fonte, espaçamentos ou durações soltos. `tests/designTokens.test.js` confere o catálogo, recusa `var(--x)` sem declaração e impede que o total de cores literais suba.

## Cor

Carvão com leve tom frio, papel escuro de tinta quente, ouro envelhecido como acento principal e vinho como apoio (perigo e moldura). Paleta ajustada em 2026-10-08 para a direção gótica sutil (`docs/DIRECAO_GOTICA.md`); os nomes dos tokens não mudaram, só os valores.

| Papel | Tokens |
| --- | --- |
| Texto | `--ink` #e2dccf, `--ink-strong` #f1e8d2, `--ink-warm` #d6c8a6, `--ink-soft` #bba982, `--muted` #a39d92 |
| Ouro (ação, seleção, foco) | `--gold-light` #dcc896, `--gold-bright` #cdb682, `--gold` #b39a63, `--gold-deep` #8d7646, `--gold-shadow` #6a5a38 |
| Filetes e bordas | `--rule-soft` #2b2720, `--rule` #3d362b, `--rule-strong` #574c37, `--line-strong` #3a3429, `--line` (ouro a 22%) |
| Superfícies neutras | `--surface-0` #0b0c0c, `--surface-1` #121313, `--surface-2` #1a1b1a |
| Superfícies de papel | `--paper-0` #161412, `--paper-1` #1b1815, `--paper-2` #25211c |
| Alerta | `--red` #6f2a32, `--accent` #a8655f, `--danger-ink` #e8c2bb |
| Extremo | `--black` #000000 |
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

## Espaço, forma e alvo

`--space-1` 4 px, `--space-2` 8, `--space-3` 12, `--space-4` 16, `--space-5` 24, `--space-6` 32. Raios `--radius-s` 2 px e `--radius-m` 4 px; não usar raios maiores. `--target` 44 px é a altura mínima de qualquer controle tocável.

## Movimento e foco

`--motion-fast` 120 ms, `--motion-base` 200 ms, `--ease-out`. Sempre nomear a propriedade (`transition: opacity var(--motion-fast) var(--ease-out)`); nunca `all`. Só `transform` e `opacity` em controles. `theme.css` zera animação, transição e rolagem suave em `prefers-reduced-motion`.

`--focus-ring` e `--focus-offset` definem o contorno de foco: `outline: var(--focus-ring); outline-offset: var(--focus-offset)`.

## Estado da consolidação

Em 2026-10-07: 264 cores literais viraram token quando ficavam a até 2 de diferença perceptual (ΔE) do token, e 147 famílias de fonte viraram `--font-display` ou `--font-body`. Comparação de pixels antes e depois, em 11 telas, deu no máximo 5 a 7 níveis de diferença por canal; a única mudança maior foi a face sorteada do D20. Restam 710 cores literais, a maioria em `workspace.css`, `NoteBoard.css`, `Notebook.css`, `account.css` e `TurnTracker.css`; cada uma tem de ser avaliada, porque muitas são variações isoladas de dourado e de marrom que não cabem em nenhum token sem mudar a aparência. O limite do teste desce quando essas cores migrarem.