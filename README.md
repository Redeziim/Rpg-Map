# RPG Map Explorer

Aplicação web para condução e acompanhamento de campanhas de RPG. Reúne mapa interativo, pontos de interesse, ficha configurável, barras de status do grupo e rolagem de dados em uma interface única.

## Requisitos

- Node.js 24 ou superior
- npm


## Validação

```bash
npm run build
npm test
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

O servidor Node.js armazena contas e mesas em SQLite. Salas online têm permissões de jogador, mestre e ADM e eventos em tempo real, incluindo a bandeja 3D de dados compartilhada.

Consulte [ONLINE.md](ONLINE.md) para publicar com Docker, configurar armazenamento persistente e convidar jogadores. Banco local, sessões, dependências e arquivos de ambiente não são versionados.

## Orientação para agentes

Leia `AGENTS.md` antes de alterar o projeto. As skills locais ficam em `.agents/skills/` e definem os critérios de design, acessibilidade, animação e desempenho em React.
