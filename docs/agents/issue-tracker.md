# Issue tracker: GitHub

As tarefas e especificações deste projeto ficam em GitHub Issues de `Redeziim/Rpg-Map`.
Use a CLI `gh` com `--repo Redeziim/Rpg-Map` para indicar o destino explicitamente.

## Convenções

- Criar tarefa: `gh issue create --repo Redeziim/Rpg-Map --title "..." --body-file <arquivo.md>`.
- Ler tarefa: `gh issue view <numero> --repo Redeziim/Rpg-Map --comments`.
- Listar tarefas: `gh issue list --repo Redeziim/Rpg-Map --state open --json number,title,body,labels,assignees`.
- Comentar: `gh issue comment <numero> --repo Redeziim/Rpg-Map --body-file <arquivo.md>`.
- Adicionar ou remover etiquetas: `gh issue edit <numero> --repo Redeziim/Rpg-Map --add-label "..."` ou `--remove-label "..."`.
- Encerrar: `gh issue close <numero> --repo Redeziim/Rpg-Map`.
- Para textos com várias linhas, usar um arquivo Markdown com `--body-file`.

O plano de prioridades existente fica em `PLANO_DE_MELHORIAS.md`; consultar esse plano antes de propor a próxima tarefa.

## Pull requests as a triage surface

**PRs as a request surface: no.**

## Quando uma skill pedir para publicar uma tarefa

Criar uma GitHub Issue no repositório indicado acima.

## Quando uma skill pedir para consultar uma tarefa

Ler a issue e seus comentários com `gh issue view`.

## Wayfinding operations

Usado por `wayfinder`. O mapa de trabalho é uma issue principal com uma issue por tarefa.

- **Map**: issue principal com a etiqueta `wayfinder:map`, contendo notas, decisões tomadas e dúvidas em aberto.
- **Child ticket**: issue vinculada como sub-issue do mapa por meio da API do GitHub. Se sub-issues estiverem indisponíveis, usar uma lista de tarefas na issue principal e incluir `Part of #<mapa>` na tarefa. Etiquetas: `wayfinder:research`, `wayfinder:prototype`, `wayfinder:grilling` ou `wayfinder:task`.
- **Blocking**: usar as dependências nativas de issues. O endpoint é `repos/Redeziim/Rpg-Map/issues/<tarefa>/dependencies/blocked_by`; o campo `issue_id` recebe o ID numérico do banco, obtido com `gh api repos/Redeziim/Rpg-Map/issues/<bloqueador> --jq .id`, e não o número da issue. Se essa API estiver indisponível, registrar `Blocked by: #<numero>` no início da tarefa.
- **Frontier**: entre as tarefas abertas do mapa, escolher a primeira na ordem do mapa que não tenha responsável nem bloqueador aberto.
- **Claim**: atribuir a tarefa ao responsável antes de começar, usando `gh issue edit <numero> --repo Redeziim/Rpg-Map --add-assignee @me`.
- **Resolve**: registrar a resposta, encerrar a tarefa e acrescentar o link e um resumo às decisões da issue principal.
