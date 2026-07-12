# Ficha RPG — Explorador de Mapa + Ficha de Personagem

Componente React single-file (`rpg-map-explorer.jsx`) com:

- **Explorador de mapa** com zoom, pan e pontos de interesse (Modo Mestre / Modo Jogador).
- **Ficha de Personagem customizável**: o Mestre monta um modelo base de campos (texto, número,
  imagem, lista, fórmula, ataque/habilidade, lista marcável), e cada jogador pode adicionar seus
  próprios campos extras por cima do modelo base. Suporta sub-abas internas (ex: Combate, Social,
  Inventário) e fontes temáticas de RPG.
- **Dado 3D real**: geometria e texturas extraídas de um modelo `.glb`, com seletor de "bolsa" de
  skins e suporte a expressões como `2d6 + 1d4 - 1d4`.
- **Barras de Status** (vida, sanidade, etc.) por jogador, com cor livre e ajuste rápido.
- **Status do Grupo**: cards de todos os jogadores lado a lado, com animações de dano/cura em
  tempo real (número flutuante, flash na barra, indicador de "caído").
- Tudo sincronizado via `window.storage` (compartilhado entre Mestre e jogadores).

## Como usar

Este arquivo foi feito para rodar como um **artifact React no Claude.ai** (usa a API
`window.storage` disponibilizada nesse ambiente, além de `three` para o dado 3D).

Para rodar fora do Claude.ai, será necessário:
1. Adaptar `window.storage` para uma solução de persistência própria (ex: Firebase, Supabase, ou
   um backend simples com WebSocket para sincronização em tempo real entre Mestre e jogadores).
2. Garantir que as dependências (`three`, `lucide-react`) estejam instaladas no projeto.

## Estrutura

Arquivo único (`rpg-map-explorer.jsx`) contendo todos os componentes:
`RPGMapExplorer` (raiz), `CharacterSheet`, `StatusBars`, `GroupStatus`, `DiceRoller`, `Dice3D`.
