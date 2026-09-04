# RPG Map Explorer

Aplicação web para condução e acompanhamento de campanhas de RPG. Reúne mapa interativo, pontos de interesse, ficha configurável, barras de status do grupo e rolagem de dados em uma interface única.

## Requisitos

- Node.js 18 ou superior
- npm

## Execução local

```bash
npm ci
npm run dev -- --host 127.0.0.1
```

O Vite informa a URL local após iniciar o servidor.

## Validação

```bash
npm run build
npm run preview -- --host 127.0.0.1
```

O resultado de produção é gerado em `dist/` e não deve ser versionado.

## Estrutura

- `src/components/RPGMapExplorer.jsx`: estado principal, mapa e navegação.
- `src/components/CharacterSheet.jsx`: ficha de personagem e campos configuráveis.
- `src/components/StatusBars.jsx`: identidade do jogador e barras individuais.
- `src/components/GroupStatus.jsx`: visão consolidada do grupo.
- `src/components/DiceRoller.jsx`: composição e histórico das rolagens.
- `src/components/Dice3D.jsx`: geometria e animação tridimensional dos dados.
- `src/components/Scene3D.jsx`: cena ligada aos pontos de interesse.
- `src/components/sheetHelpers.jsx`: tipos, abas e avaliação de fórmulas da ficha.

## Persistência

A aplicação usa `window.storage` quando o ambiente fornece essa API. No navegador comum, usa `localStorage`. Mapas enviados, pontos, fichas e barras permanecem apenas no armazenamento disponível no cliente; não existe servidor de dados neste repositório.

## Orientação para agentes

Leia `AGENTS.md` antes de alterar o projeto. As skills locais ficam em `.agents/skills/` e definem os critérios de design, acessibilidade, animação e desempenho em React.
