# Tokens de design — item 63

Fonte única: o bloco `:root` de `src/theme.css`. Código novo usa estes nomes; não cria cores, famílias de fonte, espaçamentos ou durações soltos. `tests/designTokens.test.js` confere o catálogo, recusa `var(--x)` sem declaração e impede que o total de cores literais suba.

## Cor

Papel escuro e tinta quente, com dourado como único acento. Valores medidos no código existente; nada foi trocado por uma cor nova.

| Papel | Tokens |
| --- | --- |
| Texto | `--ink` #eee7d9, `--ink-strong` #fff1cf, `--ink-warm` #e7d6b1, `--ink-soft` #cbb58a, `--muted` #b8b0a4 |
| Ouro (ação, seleção, foco) | `--gold-light` #f0d391, `--gold-bright` #e2c786, `--gold` #c8a65e, `--gold-deep` #a78954, `--gold-shadow` #80663d |
| Filetes e bordas | `--rule-soft` #403722, `--rule` #55462f, `--rule-strong` #76613f, `--line-strong` #49402e, `--line` (ouro a 22%) |
| Superfícies neutras | `--surface-0` #101010, `--surface-1` #171717, `--surface-2` #1f1f1f |
| Superfícies de papel | `--paper-0` #1c1b17, `--paper-1` #211f19, `--paper-2` #2c291f |
| Alerta | `--red` #8f3037, `--accent` #c97770, `--danger-ink` #ffd2cb |
| Extremo | `--black` #000000 |

Regra de uso: ouro marca o que se pode acionar ou o que está selecionado; filete separa; superfície de papel agrupa. Borda dourada cheia fica para seleção e ação principal.

## Tipografia

| Token | Valor | Uso |
| --- | --- | --- |
| `--font-display` | Cinzel, Georgia, serif | títulos e nomes de tela |
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