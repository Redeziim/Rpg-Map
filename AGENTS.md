# RPG Map Explorer

Estas instruções se aplicam a todo o repositório `Rpg-Map`.

## Arquitetura atual

- A implementação canônica usa Vite 6, React 18, JavaScript e Three.js.
- `src/components/RPGMapExplorer.jsx`: composição principal, mapa, modos de jogador e mestre e persistência.
- `src/components/CharacterSheet.jsx`: ficha dinâmica e construtor de campos.
- `src/components/StatusBars.jsx` e `GroupStatus.jsx`: barras individuais e visão do grupo.
- `src/components/DiceRoller.jsx` e `Dice3D.jsx`: expressão, histórico e renderização tridimensional dos dados.
- `src/components/tabletop/TabletopMap.jsx`: mesa 3D independente dos pontos do mapa 2D.
- O servidor Node.js em `server/` usa SQLite para contas e mesas, com permissões validadas na API e sincronização SSE.
- `npm run dev` inicia Vite e API; Node.js 24 ou superior é necessário.

Use `npm` e `package-lock.json`. Não troque framework, gerenciador de pacotes ou estratégia de persistência sem autorização explícita.

## Skills obrigatórias por tipo de tarefa

- Criação, reformulação ou acabamento visual: use `frontend-design` antes de escrever a interface.
- Auditoria de UI, UX ou acessibilidade: use `web-design-guidelines` depois da implementação.
- Animações, transições e microinterações: use `web-animation-design`.
- Escrita, revisão ou refatoração React: use `vercel-react-best-practices` e aplique apenas regras pertinentes ao ambiente real do projeto.
- Direção estética de qualquer tela nova ou redesenho: use `design-taste-frontend` junto com `frontend-design`; consulte `awesome-design` para referências de sistema visual.
- Implementar a partir de imagens de design: use `image-to-code` (as imagens devem existir ou ser fornecidas).
- Verificar a interface no navegador (capturas, fluxos, regressão visual): use `playwright-cli`.

## Direção visual

Antes de implementar, declare uma direção visual coerente com o mundo e com a função da tela. Trate mapa, leitor, ficha e ferramentas de mestre como produtos diferentes dentro do mesmo universo; não como um dashboard genérico com temas trocados.

Evite sinais recorrentes de interface gerada por IA:

- gradiente roxo ou azul como identidade visual padrão;
- grade de cards arredondados usada como estrutura para tudo;
- excesso de `border-radius`, brilho, vidro fosco e sombras neon;
- `transition: all`, animação ornamental constante e efeitos sem função;
- fonte de sistema, Inter, Roboto ou Arial como escolha automática;
- emojis usados como ícones de produto;
- texto promocional vago, rótulos genéricos e hierarquia visual uniforme.

Prefira uma linguagem visual específica: cartografia impressa, marginalia, instrumentos de navegação, fichas físicas, selos, gravura ou interface tática. Escolha uma referência dominante por tela e execute-a com contenção. Use tokens CSS para cor, tipo, espaçamento, borda e movimento.

## Interação e acessibilidade

- Use HTML semântico, rótulos acessíveis, foco visível e navegação por teclado.
- Botões apenas com ícone precisam de nome acessível.
- Imagens precisam de `alt` apropriado; imagens decorativas usam `alt=""`.
- Alvos de toque devem ter pelo menos 44 por 44 pixels quando possível.
- Anime preferencialmente `transform` e `opacity`, com duração inferior a 300 ms para controles de produto.
- Implemente `prefers-reduced-motion` para toda animação nova.
- Nomeie propriedades em transições; não use `transition: all` em código novo.
- Preserve legibilidade e operação em viewport estreita, zoom de página e alto contraste.

## Forma de trabalho

1. Identifique qual implementação e fonte de dados são afetadas.
2. Preserve o comportamento antes de alterar a aparência.
3. Defina a direção visual e o detalhe memorável da tela.
4. Implemente estados de foco, hover, ativo, carregamento, vazio e erro quando aplicáveis.
5. Revise a mudança com as skills correspondentes.
6. Teste as páginas alteradas em um servidor HTTP local e em larguras desktop e mobile.

Para validar a aplicação, execute `npm run build` e teste `npm run dev` no navegador. Não declare sucesso apenas com inspeção estática.

## Agent skills

### Issue tracker

Tarefas e especificações em GitHub Issues de `Redeziim/Rpg-Map`. Consulte `docs/agents/issue-tracker.md`.

### Domain docs

Um único contexto: glossário em `GLOSSARY.md` e decisões em `docs/adr/`, criados conforme necessário. Consulte `docs/agents/domain.md`.

## Contexto no vault (memória externa)

O vault do Obsidian é a memória externa de todos os chats deste repositório. No Windows ele fica em `C:\Users\Arthur\RPG-Dev-Vault` (`~/RPG-Dev-Vault`; outro computador: ajuste o caminho) e é um repositório git com remoto `Redeziim/RPG-Dev-Vault`. A memória do chat acaba; o vault não. O que não estiver nele deve ser tratado como perdido.

Antes de começar, leia:

- `Projetos/RPG-Map-Explorer/PROJECT_CONTEXT_FOR_DEV_VAULT.md`
- `Projetos/RPG-Map-Explorer/Progresso-e-Planejamento.md`
- a `Chat-Contexto-AAAA-MM-DD.md` mais recente da mesma pasta
- `Instrucoes-IA.md` para qualquer documentação escrita.

Antes de refazer qualquer coisa, procure no vault (`Projetos/RPG-Map-Explorer/`, `docs/adr/`, `PLANO_DE_MELHORIAS.md`, `PROMPT_PROXIMAS_ETAPAS.md`) se já foi feita ou decidida.

Durante a sessão, não espere o fim para gravar. Ao concluir cada item do plano, tomar uma decisão ou deixar algo pela metade, atualize na hora `Progresso-e-Planejamento.md` (item feito, item em curso, próximo passo exato). Assim um chat que estoure o contexto no meio não perde o trabalho.

Ao terminar a sessão, execute `/fechar-sessao` para consolidar o vault. Ele só faz commit; o push é do usuário. Skills compartilhadas ficam em `~/RPG-Dev-Vault/Skills/`; use `~/RPG-Dev-Vault/scripts/link-skills.sh <este-diretorio>` para ligá-las.
