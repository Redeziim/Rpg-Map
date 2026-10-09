# 038 — Editor do modelo da ficha com prévia ao vivo

Data: 2026-10-09. Estado: aceito conforme pedido do usuário.

## Contexto

Montar o modelo da ficha num painel que se abria acima das fichas era apertado: o mestre editava uma lista de campos sem ver como o jogador a veria. O usuário pediu que criar a ficha ou trazer um modelo abrisse numa área própria, onde se edita e, ao mesmo tempo, se vê a ficha do jogador.

## Decisão

- A área Ficha do mestre ganha duas abas internas (`tablist`): **Fichas dos jogadores** e **Editor do modelo**. O jogador não as vê.
- O editor (`src/components/SheetModelEditor.jsx`) fica à esquerda; à direita fica a prévia: o próprio `CharacterSheet` em modo `preview` e perfil de jogador, com valores locais (estado do componente, nunca `onUpdatePlayerSheet` real). Assim a prévia usa exatamente o livro, as fórmulas, os pares atributo e modificador e a tipografia que o jogador usa, sem uma segunda implementação para manter.
- O modo `preview` não mostra cabeçalho, não grava a vista (livro ou lista) no `localStorage` e não oferece notas.
- A biblioteca de modelos (`SheetModels`) avisa o editor com `onPreview` quando há um modelo lido de arquivo em revisão ou um Somar/Substituir à espera de confirmação; a prévia mostra esse resultado com um aviso de que ainda não foi aplicado. Cancelar, aplicar ou trocar de aba volta ao modelo da mesa.
- O livro ganhou `focusCategory`: o editor pede a página da categoria que está sendo editada.
- Em área estreita (container query, 900 px), as duas partes viram painéis alternados com botões **Editar** e **Prévia**.
- Valores de exemplo ficam em `src/shared/sheetExample.js`, só para a prévia.

## Consequências

- Nenhuma mudança no servidor, no banco ou no formato do modelo.
- O painel antigo "Editar modelo da ficha" deixou de existir; o botão virou a aba **Editor do modelo**.
- A prévia monta uma segunda ficha (e, nos campos de ataque, os dados 3D só quando rolados), então só existe enquanto a aba do editor está aberta.
