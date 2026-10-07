# Revisão — tamanho proporcional e redução relativa

2026-10-03. Skills `frontend-design`, `vercel-react-best-practices` e `web-design-guidelines`; [regras atuais](https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md). Direção: instrumentos táticos, controle único de tamanho, rótulos diretos e proporção indicada por exemplos. Escopo: controles novos de tamanho e informação de qualidade.

## src/components/tabletop/ObjectSelectionPanel.jsx

- ObjectSelectionPanel.jsx:28 — ✓ formulário semântico, campo rotulado, teclado, envio com estado existente e limites calculados sobre escalas atuais.
- ObjectSelectionPanel.jsx:29 — ✓ `name`, autocomplete, inputmode e 44 px. Campo conserva valor após falha e volta a 1 após sucesso.
- ObjectSelectionPanel.jsx:34 — ✓ ajustes avançados conservam posição/giro por eixo; tamanho tem ação única clara.

## src/components/tabletop/ModelPreviewPanel.jsx

- ModelPreviewPanel.jsx:30 — corrigido: exibição arredondada evita resíduos como 1,9999999999999998 no campo.
- ModelPreviewPanel.jsx:15 — ✓ validação usa limites existentes; erro anunciado junto à prévia e valor válido restaurado. Enter confirma por blur.

## src/components/tabletop/TabletopMap.jsx

- TabletopMap.jsx:98 — corrigido: multiplicador sozinho envia deslocamento/giro zero. Falha reproduzida pelo botão real e fluxo repetido após o ajuste; API confirmou a pose.
- TabletopMap.jsx:147 — ✓ redução real em porcentagem, números localizados e aviso para recursos mantidos.

## src/components/tabletop/TabletopMap.css

- TabletopMap.css:40 — ✓ foco herdado visível, hover, rótulos/ajuda, campo/botão 44 px e largura contida. Sem animação nova.

Navegador em 1440×900 e 390×844: prévia, arraste, importação, metade/dobro, teclado, Original/Leve e reabertura. Página 382 px em viewport de 390 px; aba nova final sem erros de console. Sem achado pendente no escopo.
