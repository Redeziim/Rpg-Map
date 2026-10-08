# O que falta — estado de 2026-10-07

Esta seção vale mais que o restante do documento, que é do ciclo de 2026-10-04 e está desatualizado (ele ainda lista como pendentes itens já entregues). Fonte de prioridades: `PLANO_DE_MELHORIAS.md`. Perguntas que dependem do mestre da mesa: `docs/PERGUNTAS_EM_ABERTO.md`.

## Entregue nesta rodada

Itens 16, 17, 18, 23 (opção A), 53, 57, 58, 59, 63, 65 e 66, e a primeira rodada dos itens 60 a 62. Resumo por item em `PLANO_DE_MELHORIAS.md`; contratos em `docs/CAMPAIGN_TIMELINE.md`, `docs/NOTES_TRASH_EXPORT.md`, `docs/SHEET_SYSTEMS.md`, `docs/POINT_SEARCH.md`, `docs/DESIGN_TOKENS.md` e `docs/PERFORMANCE.md`.

## Falta decidir

1. **Item 64 — direção visual.** A tela-piloto Ferramentas de mestre foi aplicada em 2026-10-07 (`DESIGN.md`). Falta o usuário aprovar a direção e escolher a próxima tela: Mapa 2D, Mesa 3D ou Bandeja de dados. Também restam, no mesmo painel, os estilos antigos embutidos em `RPGMapExplorer.jsx` (bloco `<style>`), que vale migrar para folhas com tokens aos poucos.

## Falta fazer

2. **Importação de fichas (item 58).** Testar com fichas reais e oficiais de D&D e da Ordem Paranormal (as dos testes foram feitas à mão); testar um PDF preenchível de verdade (hoje os campos de formulário só passaram no interpretador); acrescentar mais sistemas em `src/shared/sheetTemplates.js`.
3. **Acessibilidade (itens 60 a 62).** Teste com leitor de tela real (NVDA ou equivalente); contraste do texto sobre a imagem do mapa e sobre cenas 3D; teclado dentro do canvas do mapa 2D e do mapa mental além dos atalhos documentados.
4. **Tokens de design (item 63).** Restam 710 cores literais, a maioria em `workspace.css`, `NoteBoard.css`, `Notebook.css`, `account.css` e `TurnTracker.css`. O limite em `tests/designTokens.test.js` só pode descer.
5. **Desempenho (item 66).** Textura `public/assets/tray/base.png` (2,4 MB); `three` carregado ao entrar na mesa por causa da bandeja de dados; `base.obj` ainda com 3,5 MB comprimido.
6. **Pontos do mapa (item 23, opção B).** Região e etiquetas só se uma mesa passar de uns 30 pontos.
7. **Testes em paralelo.** `npm test` roda em série porque `diceHistory` e `transactions` falham com `ECONNRESET` quando os arquivos rodam juntos. Uma tarefa à parte foi aberta para achar a causa; o resultado dela não foi incorporado aqui.
8. **Manutenção.** `npm audit` aponta 1 vulnerabilidade de severidade alta; a pasta `art/` do clone local continua fora do git; `README.md` e `AGENTS.md` ainda não mencionam `scripts/prepareOcr.js` (roda sozinho antes de `dev` e `build`).

## Opções futuras que exigem aprovação

- Leitura de fichas por IA (um modelo de linguagem lendo o arquivo) e resumo assistido de sessão (item 59): enviariam texto a um serviço externo, com custo, chave e privacidade a decidir. Hoje nada sai do navegador.
- Mapa mental: refinamento amplo continua adiado, sem requisito novo.

## Como retomar

Fluxo em `Skills/fluxo-site` do `RPG-Dev-Vault`: escopo, banco, backend, frontend, QA, revisão e `/fechar-sessao`. Commits locais são livres; push só quando o usuário pedir. Banco de teste com caminho curto (`%TEMP%\...`), nunca o caminho longo do scratchpad. Node 24, Git e GitHub CLI ficam em `%LOCALAPPDATA%\Programs\devtools`.

---
# Prompt para continuar o RPG Map Explorer

Atualizado em 2026-10-04, a partir de `PLANO_DE_MELHORIAS.md`, decisões/ADRs, skills e do commit de referência `1cb5f90baef92d99421c82ea139b53cb15b1b465`. O item 2 foi concluído localmente neste ciclo; o leitor do item 57 está pronto, mas ainda não integrado.

**Como usar:** copie o conteúdo a partir de “Início do prompt” até “Fim do prompt” para uma conversa que tenha acesso ao repositório. Este documento planeja as próximas implementações; sua criação não executa as features abaixo.

## Início do prompt

Continue o desenvolvimento do **RPG Map Explorer / Grimório**, no repositório `Redeziim/Rpg-Map`. Implemente as pendências por etapas pequenas, preservando os dados e as escolhas já feitas. A interface deve ser simples, fácil de entender e escrita em português.

### 1. Contexto e ordem de execução

Leia `AGENTS.md`, `README.md`, `PLANO_DE_MELHORIAS.md`, `docs/RESUMO_DA_ENTREGA.md`, `docs/agents/issue-tracker.md` e as decisões de arquitetura relacionadas à tarefa. Consulte `GLOSSARY.md` se existir. Reconcilie este prompt com o estado atual: alguma pendência pode ter sido concluída depois de sua preparação.

Os itens **38–52 e 54–56 estão concluídos**, assim como o movimento suave do **67** e o ajuste de modelos detalhados/tamanho proporcional/Leve relativo automático. As entregas locais têm suíte 134/134, build e navegador aprovados e ainda não foram publicadas no Git. Preserve os arquivos existentes ao retomar.

Há **15 itens com trabalho restante** neste documento: 16–18, 23, 53 e 57–66. O item 2 foi concluído localmente e documentado em ADR 033. O item 23 está adiado. O refinamento amplo do mapa mental é outra frente adiada, sem requisito novo definido.

Ordem para o trabalho ativo:

1. Combate e campanha: completar 53 quando chegar sua escolha de privacidade e seguir 57–59. Mesa 3D, contrato de combate, recuperação, condições e apresentações de cenas já entregues.
2. Visual e acessibilidade: 60 a 66. Acessibilidade básica deve acompanhar cada interface nova desde já.

Prioridade por gravidade: **P0** é perda de dados, acesso indevido ou função essencial quebrada; **P1** é função importante incompleta; **P2** é organização/acabamento. Termine os P0 de cada área antes dos P1 e P2. A ordem de áreas já escolhida permanece; não troque as prioridades sem explicar uma necessidade concreta.

| Trabalho restante | Prioridade | Situação e momento |
| --- | --- | --- |
| 2 — recuperação de rascunhos | P0 | Proteção já existe; falta aprofundar validação. Pode acompanhar os ensaios de confiabilidade, sem reformular o mapa mental. |
| 16–18 — organização e exportação de notas | P2 | Retomada curta a apresentar quando voltar às notas. |
| 23 — filtros dos pontos | P1 | Adiado; só retomar após escolha do usuário. |
| 53 — privacidade das rolagens | P0 | Base pública entregue; escolha já perguntada pendente. 54 concluído. |
| 57–58 — campanha e regras | P1 | Linha do tempo e pacotes opcionais. Condições e apresentações de cenas concluídas. |
| 59 — resumo/preparação | P2 | Versão manual como ponto de partida. |
| 60–62 — operação e acessibilidade geral | P0 | Auditoria geral na etapa final; corrija problemas graves encontrados antes disso. |
| 63–66 — linguagem visual e desempenho | P1 | Consolidação após as funcionalidades. |

Os itens **16, 17 e 18** continuam pendentes de notas. Apresente-os como uma retomada curta e separada quando chegar a hora de voltar a essa área. O refinamento amplo do mapa mental e os filtros de pontos do item **23** continuam adiados; peça uma decisão antes de reabrir essas duas frentes.

### 2. Decisões que devem ser preservadas

- Arquitetura: Vite 6, React 18, JavaScript, Three.js, Node.js 24+ e SQLite. Use npm e `package-lock.json`.
- Não troque framework, gerenciador ou estratégia de persistência sem autorização explícita. Evoluções de esquema no SQLite devem usar as migrações já existentes.
- A Mesa 3D independente permanece. Pontos 2D abrem detalhes e notas; não reintroduza uma cena 3D aberta por ponto.
- Nova nota deve continuar criando uma nota em branco. Não recoloque modelos de sessão, personagem, local ou pista.
- A coleção de referências continua sendo de imagens. PDF fica fora do escopo.
- No mapa mental, preserve conexões sem ponta de seta, busca com destaque, janela fixa inicialmente no canto inferior esquerdo, opção de soltar/redimensionar e vínculos com pontos 2D.
- Não recoloque mini mapa, visão geral ou “Enquadrar tudo” no mapa mental. Essa decisão não remove os controles atuais de câmera da Mesa 3D.
- Preserve o ADM em modo jogador usando as permissões desse modo. A validação final sempre deve acontecer no servidor.
- Notas pessoais privadas de terceiros continuam privadas, inclusive diante de ADM/mestre. Compartilhar uma nota agora não libera automaticamente versões antigas privadas.
- Vários vínculos por objeto foram escolhidos e entregues no 50. Jogadores criam notas em Minhas notas em todas as abas; notas pessoais exigem compartilhamento explícito também diante de mestre/ADM. Não pergunte novamente essas escolhas.
- No 51, mestre define iluminação para todos e cada pessoa controla a câmera pessoal. Redução relativa automática no Leve foi confirmada e entregue, com tamanho proporcional para preservar a forma do modelo. Não pergunte novamente essas escolhas.
- O usuário pediu validação rápida para o 50, dispensando os três testes propostos: um fluxo HTTP integrado com cobertura pertinente foi suficiente. A quantidade de testes futuros deve acompanhar o risco concreto; não use três como mínimo automático nem repita pedidos de autorização já respondidos.
- Preserve qualidade Automática/Original/Leve pessoal, original intacto, edição local imediata e interpolação remota. Movimento suave segue o aparelho por padrão e pode ser escolhido nesta sessão; não replique essa preferência na mesa.
- Prévia na própria mesa, visível só para quem a abriu, com contorno e indicação Só você. Não a sincronize/publice antes de Adicionar à mesa; mantenha números recolhidos, normalização e descarte existentes.
- Bloqueio do item 48 já escolhido: impedir mover, girar e mudar tamanho até desbloquear, inclusive pelos números e na API. Não pergunte novamente qual modalidade de bloqueio usar.
- A exportação da mesa existe, mas ainda não possui importação pela interface. Importação é uma extensão de escopo, não uma parte esquecida do item 38.

### 3. Escolha de skills

Carregue apenas as skills pertinentes à tarefa atual e leia seu `SKILL.md`. Não carregue todas as skills a cada item. A seleção abaixo foi feita a partir das instruções instaladas; ela não exige instalar novas skills. Skills orientam o trabalho do agente e não são dependências do site. [Referência oficial sobre skills](https://developers.openai.com/plugins/concepts/skills).

| Skill | Quando usar neste projeto | Como aplicar |
| --- | --- | --- |
| `vercel-react-best-practices` | Toda escrita, revisão ou refatoração React | Aplique as regras compatíveis com React 18/Vite: renderizações, efeitos, listeners, consultas, importações e tamanho do bundle. Não introduza Next.js, Server Components ou APIs exclusivas de versões posteriores de React. |
| `frontend-design` | Interface nova, reformulação e acabamento | Defina primeiro a função da tela e uma direção visual específica: cartografia no mapa, marginalia nas notas, ficha física no personagem e instrumentos táticos na Mesa 3D. Preserve a legibilidade e os controles conhecidos. |
| `web-design-guidelines` | Revisão de UI/UX e acessibilidade depois de implementar | Consulte a fonte atual indicada pela skill; revise os arquivos efetivamente alterados e corrija os achados aplicáveis. |
| `web-animation-design` | Arraste, transições, feedback animado e recuperação visual | Use movimento funcional, em geral abaixo de 300 ms nos controles, propriedades explícitas e `prefers-reduced-motion`. Não anime uma barra para fingir progresso. |
| `tdd` | Dados, permissões, migrações, sincronização, importação e regras de combate | Faça um ciclo por comportamento: teste falhando, implementação mínima, teste passando. Use interfaces públicas como HTTP, CLI e fluxos do navegador. |
| `diagnosing-bugs` | Bug difícil, travamento, vazamento ou desempenho ruim | Construa primeiro uma reprodução mensurável, teste hipóteses e retire a instrumentação temporária antes de concluir. |
| `code-review` | Revisão explícita de uma entrega contra uma referência Git e uma especificação | Use um commit/branch de base verificável e a issue ou seção de especificação. A skill prevê duas revisões por subagentes; não crie conversas separadas do usuário como substituição. Não a invoque como um ritual para alterações triviais. |
| `computer-use:computer-use` | Validação real de telas em `npm run dev` | Leia as instruções disponíveis e use as ferramentas de navegador da sessão. Trabalhe com contas/mesas descartáveis, desktop e celular; não dependa só da leitura do JSX. Não peça ao usuário cliques que a ferramenta consegue executar. |
| `skill-creator` | Se surgir necessidade real de criar/manter uma skill específica do projeto | Use apenas depois de identificar um procedimento repetido que as skills atuais não cobrem. Não crie uma skill genérica para cada feature. |
| `openai-docs` | Eventual integração OpenAI ou configuração do próprio Codex | Use documentação oficial atual. Essa skill não é necessária para implementar o RPG sem serviços OpenAI. |

Não há uma skill especializada em Three.js ou manutenção SQLite instalada. Para essas tarefas, combine testes/diagnóstico com a documentação oficial e as decisões do repositório. Não anuncie skills inexistentes como disponíveis. As skills atuais bastam para o plano; uma nova instalação só se justifica por uma lacuna concreta.

`Hallmark` é uma referência autorizada de design, com licença MIT, e contém uma skill própria. Não aparece como skill carregável no catálogo atual da sessão. Consulte seus recursos quando chegar ao acabamento; se for incorporá-lo como skill, use `skill-installer`, verifique o conteúdo e mantenha as regras de `AGENTS.md`. Ele orienta design e não precisa virar dependência de runtime do site. [Repositório Hallmark](https://github.com/Nutlope/hallmark).

### 4. APIs, bibliotecas e serviços

**Nenhuma pendência deste prompt exige obrigatoriamente uma API externa.** Amplie a API Node/SQLite existente conforme necessário. Recursos do navegador e métodos do Three.js não são serviços externos.

| Área | Recurso recomendado | API externa necessária? |
| --- | --- | --- |
| Sessões, convites e limpeza | Node, SQLite e filesystem; manutenção interna | Não |
| Diagnóstico operacional | Logs estruturados locais e contadores limitados | Não |
| Integridade e ocupação | CLI do projeto, SQLite e backups existentes | Não |
| Rascunhos | IndexedDB/localStorage já autorizados e identificação de abas | Não |
| Lixeira, exportação de nota e filtros | Endpoints autenticados do projeto; JSON/Blob para download | Não |
| Modelos 3D | Three.js e seus loaders já instalados; Blob/ArrayBuffer e gestão de recursos | Não |
| Transferência binária de modelos, item 42 | Evolução dos endpoints internos `POST/GET /api/rooms/:roomId/map-assets`; formato legado preservado | Não |
| Progresso e cancelamento | FileReader/Blob, AbortController; XMLHttpRequest quando precisar medir bytes enviados | Não |
| Combate, condições e campanha | SQLite, transações e SSE existentes | Não |
| Visual e acessibilidade | HTML/CSS, recursos de acessibilidade e APIs nativas do navegador | Não |

**Bibliotecas já integradas:** `gltf-validator@2.0.0-dev.3.10` (Khronos, Apache-2.0) valida GLTF/GLB no worker do servidor; `meshoptimizer@1.3.0` (MIT) reduz malhas compatíveis no worker do cliente. São locais, sem API externa. Consulte `docs/MODEL_VALIDATION.md` e `docs/TABLETOP_QUALITY_AND_MOTION.md` antes de alterar os limites e contratos.

O usuário já autorizou baixar APIs e repositórios úteis. Essa autorização não define orçamento nem credenciais para serviços pagos. Antes de ativar qualquer serviço externo, registre finalidade, dados enviados, retenção, custo, licença e alternativa local. Se faltarem conta, chave, orçamento ou decisão sobre envio de conteúdo privado, peça apenas essa informação. Não exponha chaves no frontend.

Não adicione um serviço de IA para resumos, um catálogo externo de regras, armazenamento em nuvem ou telemetria externa por conveniência. Só proponha esses serviços quando uma necessidade concreta justificar a integração.

O [public-apis](https://github.com/public-apis/public-apis) fornecido pelo usuário é um catálogo de opções. Revalide cada fornecedor em sua documentação oficial antes de usá-lo; a entrada do catálogo não comprova disponibilidade, licença ou limites atuais. Se o sistema escolhido no item 58 for D&D 5e, candidatos opcionais são a [D&D 5e SRD API](https://docs.dnd5eapi.co/) e a [Open5e](https://open5e.com/). A primeira oferece acesso ao SRD; a segunda reúne conteúdo 5e com fontes e busca. Elas não são necessárias para o combate genérico e não devem determinar o sistema de todas as mesas. Antes de implementar, defina edição, fonte/licença do conteúdo e o que será consultado; não envie notas privadas para um catálogo de regras.

### 5. Processo e conclusão de cada entrega

1. Confira o Git e preserve alterações existentes. Identifique os componentes, endpoints e dados afetados.
2. Escreva um escopo curto e os comportamentos observáveis. Resolva decisões técnicas rotineiras; peça escolha quando ela mudar o produto, a privacidade ou uma ação irreversível.
3. Use, como fronteiras de testes previstas neste prompt, a API HTTP autenticada, os comandos CLI e os fluxos reais de navegador. Não substitua comportamento por testes de nomes privados ou reprodução da implementação.
4. Para cada feature, cubra os riscos concretos com poucos testes nas fronteiras públicas: funcionamento; acesso/validação/conflito; falha/recuperação quando aplicáveis. A quantidade não é fixa. As listas de três casos abaixo são sugestões de cobertura, não três arquivos/testes obrigatórios. Faça os ciclos TDD por comportamento; reaproveite a suíte. Revisões apenas visuais/documentais podem ser conferidas no navegador sem teste novo artificial.
5. Execute os testes pertinentes, `npm test` e `npm run build` ao concluir a entrega. Não repita testes amplos sem um risco restante concreto.
6. Rode `npm run dev` em um banco descartável. Valide as telas alteradas em desktop e celular, incluindo 390 px, teclado, foco, erro e modo jogador. Verifique dados e arquivos gerados, não só mensagens de sucesso.
7. Para mudanças de esquema ou recursos persistentes, atualize migrações, backup/restauração e exportação quando afetados. Confirme compatibilidade dos dados antigos e rollback em falhas.
8. Registre o que foi feito, testes, limitações e próximo item no plano e na documentação relacionada. Só marque “Feito” com evidência.
9. Entregue um resumo simples por feature. Não faça deploy nem manipule dados reais de produção como parte de uma validação local. Publicação Git deve seguir a autorização vigente da conversa em que este prompt for executado.

Quando houver várias opções que mudem o produto, descreva em português simples o que será feito e apresente duas ou três escolhas com consequências curtas. Pergunte na etapa correspondente e continue trabalhos independentes enquanto aguarda. Decisões rotineiras de código podem ser resolvidas pelo agente.

### 6. Retomada imediata — linha do tempo, item 57; escolha pendente no 53

A base Git contém 39–41. As entregas locais 42–52 e 54–56, base pública do 53, movimento do 67 e ajuste de modelos estão validados com suíte 134/134, build e navegador. Leia `docs/COMBAT_STATE.md`, `docs/COMBAT_RECOVERY.md`, `docs/COMBAT_EFFECTS.md`, `docs/SCENE_MEDIA.md`, `docs/DICE_HISTORY.md`, os contratos da Mesa 3D e ADRs 016–032.

O item 56 foi redefinido pelo usuário e entregue como vídeos/animações: mestre libera/inicia para todos, salva e controla visualização posterior. Preserve apresentação e permissão posterior separadas, acesso autenticado/Range e originais. Decisão do item 57 já recebida: **somente o mestre/ADM no modo mestre cria e edita a linha do tempo**; jogadores leem apenas registros liberados. Prossiga com a integração. Preserve efeitos do 55: rodada confirmada, próximo turno ou remoção manual, sem desconto após retomada. O item 53 já tem histórico público persistente; a pergunta sobre quem pode consultar futuras rolagens privadas está pendente. Não a repita, não presuma a resposta e continue trabalho independente. Preserve originais/pacotes, grupos/bloqueios, versões, prévia, iluminação compartilhada/câmera pessoal e recuperação. Valide proporcionalmente ao risco, com build e navegador desktop/celular.

No 52, o usuário pediu controles do mestre para mover, retirar e pular. Retirar o ativo passa ao próximo; mudanças de conta/papel aplicam a mesma regra. No 54, a identidade local e a confirmação privada no servidor protegem respostas perdidas; consulta retorna sempre a ordem atual. Não repita estes itens. No 53, registre a resposta à pergunta já enviada antes de definir permissões de rolagens privadas.

Skills: `diagnosing-bugs` para medições de desempenho, `vercel-react-best-practices` e `tdd`; `frontend-design`/`web-design-guidelines` se alterar controles e `web-animation-design` se houver transição de detalhe. API interna e recursos nativos; nenhuma API externa obrigatória.

### 7. Pendências de notas — retomada separada

**Pontos de entrada:** componentes de notas em `src/components/`, cópias locais dos rascunhos, `src/useRoom.js`, `server/app.js`, `server/roomState.js`, histórico/coleção de imagens e exportação em `server/roomExport.js`. Use os contratos existentes e suas projeções de acesso antes de acrescentar endpoints. Não reformule o quadro como parte destas pendências.

#### Item 2 — recuperação de rascunhos (concluído localmente)

**Implementado:** cada documento gera identidade própria apesar do sessionStorage copiado pelo navegador; documentos antigos continuam como fontes somente de leitura na recarga. O caderno lista cópias da conta/mesa/seção, guarda as janelas atuais antes da substituição e marca a recuperação como rascunho, sem publicação. Cenas reutilizam os adaptadores localStorage/IndexedDB. Debounce de 250 ms, timeout de IndexedDB e JSON de emergência mantidos. ADR 033.

**Concluído quando:** comprovado por QA de abas diferentes, recarga, escolha da cópia, quota local cheia (fallback IndexedDB) e falha dupla com conferência do JSON de emergência; salvamentos na mesa = 0. Build aprovado. Reprodutor e revisão em `quality/02-draft-recovery*`.

**Limite observado:** não foi simulado crash abrupto de processo/browser; OS limpa storage de maneira não reproduzível neste fluxo. O intervalo planejado de debounce continua 250 ms; página oculta/fechamento tenta flush, sem promessa quando sistema encerra o processo ou ambos os armazenamentos falham.

**Skills:** `tdd`, `diagnosing-bugs`, `vercel-react-best-practices`; skills de UI se mudar a tela. **API:** nenhuma externa; persistência local já autorizada.

#### Item 16 — arquivo e lixeira de notas

**Como fazer:** implemente estados separados para nota ativa, arquivada e na lixeira. Faça alterações autenticadas, versionadas e transacionais. Preserve conteúdo, quadro, histórico e referências às imagens. Reutilize as regras de dono/escopo/compartilhamento; uma nota privada não pode aparecer em listas ou contagens de terceiros. Uma nota restaurada não deve conceder acesso a novos participantes por acidente. Não remova arquivos ainda usados por outras notas ou versões.

**Decisão antes da remoção definitiva:** lixeira sem expiração automática ou prazo escolhido pelo usuário? Não invente uma retenção que apague notas.

**Concluído quando:** arquivar, enviar à lixeira e restaurar funcionam com conflitos tratados e permissões preservadas.

**Validação sugerida (sem mínimo de três testes):** ciclo completo; privacidade e duas edições concorrentes; reinício e imagens/histórico preservados.

**Skills:** `tdd`, `vercel-react-best-practices`, `frontend-design`, `web-design-guidelines`. **API:** endpoints internos para ciclo de vida; nenhuma externa.

#### Item 17 — exportação individual de nota e quadro

**Como fazer:** reutilize o contrato e as projeções do item 38 onde fizer sentido. Prepare JSON versionado com título, texto, quadro e imagens autorizadas incorporadas. Declare o contexto dos vínculos a pontos e remova identificadores ocultos; um vínculo de outra mesa não deve ser tratado como válido sem reconciliação. Não inclua notas vizinhas, rascunhos não salvos ou versões privadas antigas. Respeite limites, cancelamento e expiração do acesso antes do download.

**Formato inicial recomendado:** JSON completo. TXT para texto e PNG do quadro são alternativas a escolher, sem PDF. Não adicione importação como parte implícita desta exportação.

**Concluído quando:** o arquivo contém a nota permitida e seus recursos, pode ser inspecionado fora do navegador e não revela dados adicionais.

**Validação sugerida (sem mínimo de três testes):** conteúdo autossuficiente; compartilhamento/versões/vínculos ocultos; revogação, limite e cancelamento.

**Skills:** `tdd`, `vercel-react-best-practices`, `frontend-design`, `web-design-guidelines`. **API:** exportação interna reutilizada; nenhuma externa.

#### Item 18 — atalhos e preferências do quadro

**Como fazer:** reúna os atalhos existentes em “Ajuda do quadro”, com ações equivalentes acessíveis por botão. Mantenha os atalhos restritos ao quadro com foco e não capture edição de texto nem zoom de página. Guarde preferências de visualização por pessoa e mesa no navegador, com leitura de versões antigas e restauração de valores padrão. Não grave zoom pessoal como mudança compartilhada na nota e não recoloque “Enquadrar tudo”.

**Concluído quando:** ajuda, teclado e preferências coincidem com o comportamento real, sem mover a janela inesperadamente.

**Skills:** `vercel-react-best-practices`, `frontend-design`, `web-design-guidelines`; `web-animation-design` se alterar o movimento de navegação. **API:** nenhuma externa; validação de teclado, recarga e separação entre contas, sem três testes artificiais de CSS.

### 8. Mapa 2D — item adiado

#### Item 23 — filtros e organização dos pontos

**Antes de começar:** confirme se o usuário quer retomar esta função. Apresente duas escolhas simples: filtros pelos campos existentes; ou filtros com região/etiquetas adicionais.

**Como fazer quando autorizado:** comece por nome e tipo, reutilizando os tipos e a legenda atuais. Filtros pessoais não alteram a mesa. Campos novos precisam de migração, edição pelo mestre e preservação de pontos antigos. Filtre a visão já autorizada pelo servidor: não entregue nomes, contagens ou opções de região vindos de pontos cobertos pela névoa. Não substitua a busca dentro das notas nem adicione cena 3D aos pontos.

**Concluído quando:** a lista e o mapa mostram os mesmos resultados permitidos, com estado vazio claro e botão para limpar os filtros.

**Validação proporcional se houver novos dados/API:** filtros; privacidade com névoa e papéis; migração/conflito/reinício.

**Skills:** `vercel-react-best-practices`, `frontend-design`, `web-design-guidelines`; `tdd` para dados e acesso. **API:** interna se adicionar metadados; nenhuma externa.

### 9. Mesa 3D independente

**Arquivos principais:** `src/components/tabletop/TabletopMap.jsx`, `TabletopScene.jsx`, `loadMapAsset.js`, `server/app.js`, `server/mapAssets.js` e as tabelas/rotinas de arquivos 3D. O item 42 acrescentou `src/shared/mapAssetTransfer.js`, `server/mapAssetTransfer.js` e `src/components/tabletop/mapAssetTransfer.js`. Já existem verificação de tamanho, pré-carregamento, descarte básico, tratamento inicial de falha e fila com dois carregamentos; aprofundar esses mecanismos, sem apresentar tudo como ausente.

**Direção de interface para esta área:** bancada tática de montagem. A cena ocupa o espaço principal; importação, seleção e propriedades ficam em ferramentas compactas, nomeadas e operáveis por teclado. Cada passo deve dizer claramente se está preparando algo local ou publicando para a mesa. Preserve a composição atual durante as correções de lógica; aplique a direção ao acrescentar controles.

**Base concluída — itens 42–49:** preserve transporte binário opcional, pacotes JSON/base64 antigos, File/Blob, cache privado, permissões, validação profunda, propriedade/liberação dos recursos, recuperação WebGL, confirmação privada, prévia local, grupos/bloqueios e carga espacial/LOD. Contratos, limites e medições em `docs/MODEL_TRANSFER.md`, `docs/MODEL_VALIDATION.md`, `docs/TABLETOP_RESOURCE_LIFECYCLE.md`, `docs/WEBGL_RECOVERY.md`, `docs/MODEL_IMPORT_PROGRESS.md`, `docs/MODEL_PREVIEW.md`, `docs/TABLETOP_OBJECTS.md` e `docs/TABLETOP_STREAMING.md`.

#### Item 43 — concluído

Conteúdo, referências, geometria e texturas conferidos antes de publicar, em workers com limites/prazo/cancelamento. Registros antigos preservados e falhas junto dos arquivos. Contratos/evidências em `docs/MODEL_VALIDATION.md`, decisão 017. Não refaça esta feature.

#### Item 44 — concluído

Propriedade explícita de recursos compartilhados, descarte idempotente, cargas parciais, URLs e desmontagem completa. Três testes novos e ciclos reais no navegador, inclusive clone que permanece visível após remover a origem. Contrato, medições e limites em `docs/TABLETOP_RESOURCE_LIFECYCLE.md`, decisão 019. Não refaça esta feature. Ao adicionar clones, prévias ou recuperação do renderer, siga o contrato `retainModel`/`disposeModel` e valide os novos ciclos.

#### Item 45 — concluído

Uma tentativa automática por entrada, seguida de Reabrir 3D, conforme escolha do projeto. Contexto perdido encerra o runtime e libera recursos; renderer novo usa o snapshot autorizado atual. Câmera/alvo, seleção e preferências preservados, sem repetir publicações. Callbacks antigos invalidados. Notas/mapa 2D continuam operáveis. Evidências de perda WebGL nativa, falha de criação injetada, SSE, teclado e modo jogador em `docs/WEBGL_RECOVERY.md`, decisão 020. Não refaça a feature.

Ao implementar progresso, prévia ou novos recursos, preserve o limite de recuperação e o contrato de descarte. Não use a tentativa de reabrir como repetição de importação nem renove automaticamente o orçamento de recuperação após cada sucesso.

#### Item 46 — concluído

Etapas reais e bytes medidos por XMLHttpRequest; cancelar interrompe transferência/validação e reconcilia uma confirmação privada do servidor. Resultado desconhecido bloqueia repetição, inclusive após recarga. Cancelamento após COMMIT informa o modelo já adicionado; repetição não duplica ou ressuscita objetos. Migração 004, prazo de três minutos e retenção de sete dias; backup e clientes legados preservados. Contrato, três testes públicos, evidências de navegador e limites em `docs/MODEL_IMPORT_PROGRESS.md`, decisão 021. Não refaça esta feature.

Ao acrescentar a prévia, conserve o identificador da publicação, a consulta de resultado, a seleção dos arquivos diante de erro e a proteção contra repetir um resultado desconhecido. Nenhuma API externa ou biblioteca nova foi necessária.

#### Item 47 — concluído

Prévia na própria mesa, visível só para quem a abriu, com contorno dourado, Mover/Girar/Tamanho e números recolhidos. Normalização e originais preservados; cancelar mantém arquivos, seleção e mesa, e adicionar confirma a pose mostrada na transação existente. Qualidade, acesso, recursos, câmera e recuperação WebGL respeitam os contratos anteriores. Três testes públicos e navegador em 1440/390 px, incluindo segunda aba, teclado, toque e perdas reais de contexto. Contrato/limites em `docs/MODEL_PREVIEW.md`, decisão 022. Não refaça esta feature nem replique seu arraste local por SSE.

#### Item 48 — concluído

Seleção por marcação/Shift+clique, grupos com nome/identidade estável, poses globais preservadas, gizmo comum, números e tamanho uniforme do conjunto. Duplicação cria identificadores novos usando os mesmos pacotes. Bloqueio persistido impede posição/giro/tamanho no servidor, gizmo e números; lotes são atômicos com versão e preservação do ajuste em conflito. Campo numérico mantém a digitação diante de SSE. Estado 1 migra para 2, backup antigo é preservado e pacote só sai após sua última instância. Três testes públicos e navegador em 1440/390 px, duas abas, modo jogador, teclado e Original/Leve. Contrato/limites em `docs/TABLETOP_OBJECTS.md`, decisão 023. Não refaça esta feature.

**Decisão de produto confirmada em 2026-10-03:** bloquear impede mover, girar e mudar tamanho até desbloquear. Vale também para campos numéricos e HTTP, não só para o gizmo. Não pergunte novamente por essa escolha.

Ao acrescentar LOD ou referências, preserve a expansão do grupo inteiro, versão capturada da fila/digitação, bloqueio HTTP e descarte dos contornos/pivô. Não transforme apenas um membro carregado de um grupo parcialmente carregado.

**Validação sugerida (sem mínimo de três testes):** transformações/grupo/duplicação; acesso/bloqueio/conflito; reinício e retirada da última referência ao pacote.

**Skills:** `tdd`, `vercel-react-best-practices`, `frontend-design`, `web-design-guidelines`, `web-animation-design` para manipulação. **API:** interna; nenhuma externa.

#### Item 49 — concluído

Automática com Original/Leve manuais, simplificação em worker e texturas reduzidas no cliente, originais preservados e preferências pessoais. Carga espacial prioriza selecionados/visíveis/próximos, com duas operações incluindo prévia, cancelamento/repriorização, pausa/retomada e tentativa explícita. LOD com geometrias reais, histerese, seleção na qualidade próxima e Original manual sem redução por distância. Sem loop permanente ou publicações extras. Três testes públicos novos confirmados pelo projeto, suíte de 125, build e navegador 1440/390 px. Contrato/custos/limites em `docs/TABLETOP_STREAMING.md`, ADR 024; qualidade inicial em `docs/TABLETOP_QUALITY_AND_MOTION.md`, ADR 018. Não refaça esta feature.

**Limites preservados:** download individual e parsers ainda usam o original; derivação acrescenta CPU e geometria residente. Versões prontas antes do download e cache compartilhado de modelos decodificados foram avaliados e não foram adicionados. São extensões futuras; não altere a persistência ou o original por conveniência.

**Evidência:** cena de 12 objetos carrega inicialmente 3; três esferas Leve passam de 5.952 para 1.488 triângulos ao afastar. Foco distante, teclado, grupos/bloqueios, prévia privada e desmontagem/reabertura verificados; descarte compartilhado e pacote intacto nos testes.

**Skills aplicadas:** diagnóstico, React, TDD, frontend, animação e revisão de UI. **API externa:** nenhuma.

#### Item 50 — concluído

Vários vínculos por objeto a pontos, cenas e notas, com identidades tipadas/caderno, nomes atuais, abrir/retirar, versão canônica e projeção autorizada em HTTP/SSE/abertura/exportação. Grupo continua inteiro, mas relações são editadas por objeto escolhido. Duplicação cria IDs próprios; estado 3 preserva os objetos antigos com listas vazias. Minhas notas em todas as abas, criação por jogadores e privacidade pessoal também diante de mestre/ADM conforme escolha expressa. Dados, evidências e limites em `docs/TABLETOP_REFERENCES.md`, decisão 025. Não refaça esta feature.

**Limites:** ponto 2D continua sem abrir uma cena 3D própria. Navegar para ponto/cena preserva a seleção, mas a câmera pode ser reenquadrada ao remontar a Mesa 3D. Lixeira de notas e refinamento do quadro seguem adiados.

**Validação confirmada:** o usuário dispensou os três novos testes e pediu rapidez. Um teste HTTP integrado, suíte de 126, build e navegador 1440/390 px cobrem funcionamento, privacidade/SSE/névoa, conflitos, conservação, retirada, reinício/exportação e nota criada pelo jogador. O bug antigo de criação não se reproduziu; acesso e privacidade foram corrigidos. Não repita a validação sem novo risco.

**Skills:** `tdd`, `vercel-react-best-practices`, `frontend-design`, `web-design-guidelines`. **API:** interna; nenhuma externa.

#### Item 51 — iluminação e câmera: CONCLUÍDO

Mestre define Padrão/Luz clara/Luz baixa para todos, com versão, autorização e SSE. Câmera pessoal por conta/mesa no navegador; vistas superior/diagonal/frontal e restauração da mesa inteira. Mudanças diretas, sem percurso animado. Estado JSON 4, SQLite 4. Um teste integrado com HTTP real, suíte de 127, build e navegador 1440/390 px: teclado, recarga, duas abas sem deslocamento da câmera alheia, modo jogador, 44 px e console sem erros. Nenhuma API externa ou dependência. Contrato em `docs/TABLETOP_LIGHTING_AND_CAMERA.md`, ADR 026. Não refaça a feature nem pergunte novamente seu alcance.

### 10. Combate e campanha

**Pontos de entrada:** `src/components/TurnTracker.jsx`, `RPGMapExplorer.jsx`, `DiceRoller.jsx`, `Dice3D.jsx`, `src/useRoom.js`, `server/roomState.js`, `server/app.js` e rotinas de rolagem/bandeja. Confirme as regras atuais antes de migrar. Direção de interface: ordem de turno legível e ferramentas de condução com ação explícita, mantendo a bandeja de dados já escolhida.

#### Item 52 — concluído: estado único de combate

`state.combat` reúne ordem, iniciativa opcional, NPCs, exclusões, rodada e ativo; schemaVersion 1 e versão de alteração. Mestre/ADM em modo mestre conduzem; jogadores acompanham. Ordenação mantém empates/ativo/rodada; retirada do ativo passa ao próximo sobrevivente tanto no combate como em remoção/promoção de conta. Entradas novas ficam ao final. Ações/revisão/audit transacionais com versão e SSE depois do commit; no-op sem gravação. Rascunhos não substituem a ordem confirmada e iniciativa mantém valor/versão de início para revisão em conflito.

Migração JSON 005 de estados 0–4 remove os quatro campos anteriores, materializa a ordem uma vez, conserva dados e faz rollback integral em campo incompatível. SQL continua 4. HTTP/SSE/concorrência, migração/reinício/exportação e backup/restauração integrados; suíte de 130, build e navegador 1440/390 px aprovados. Controles ≥44 px, Enter/foco/modo jogador, conflito real com valor preservado e reabertura com rodada/ordem/NPCs/iniciativas. Contrato em `docs/COMBAT_STATE.md`, ADR 028, revisão/evidências em `quality/52-*`. Sem nova API externa/dependência. Não reconstrua o combate na leitura nem reintroduza os campos antigos.

#### Item 53 — histórico contextual de rolagens

**Base pública implementada e validada:** [DICE_HISTORY.md](DICE_HISTORY.md), ADR 029 e `quality/53-*`. SQLite 5 (migração 005), JSON de mesa 5, 500 registros compactos por mesa, última animação completa e confirmações por sete dias. Repetição retorna a identidade original, sem novo sorteio/revisão/evento. Contexto de cena projetado pelas permissões atuais. Um teste HTTP integrado, suíte 131/131, build e navegador 1440/390 px aprovados. **A pergunta sobre rolagens privadas já foi enviada e não foi respondida.** Não repetir a pergunta nem interpretar a espera como escolha; implementar a resposta quando ela chegar. Não refazer a base pública nem marcar o item inteiro concluído antes dessa decisão.

**Como fazer:** persista autor, horário do servidor, expressão, resultados confirmados, origem e contexto de mesa/cena/combate. Registre o resultado uma vez, com identidade da operação, sem usar a animação para recalcular o valor. Preserve a correspondência entre faces visíveis e resultado da bandeja. Defina retenção e escopo privado/público; não confunda esse histórico com o registro administrativo genérico da mesa.

**Decisão de produto:** se não houver regra explícita, pergunte como o usuário quer rolagens privadas do mestre e quem poderá consultá-las.

**Concluído quando:** repetição de envio/reconexão não duplica a rolagem e cada participante consulta apenas os resultados permitidos.

**Validação sugerida (sem mínimo de três testes):** expressão/faces/contexto; autoria/privacidade; repetição, reinício e retenção.

**Skills:** `tdd`, `vercel-react-best-practices`; `diagnosing-bugs` para divergências de dados/física. **API:** interna; gerador/rolagem atual, nenhuma externa.

#### Item 54 — concluído: recuperar combate após desconexão

**Entregue:** snapshot confirmado, revisões e retomada SSE; intenção local por conta/mesa, confirmação privada SQL 006 na transação e consulta do estado atual. Resposta perdida bloqueia próximos comandos; reenvio da mesma identidade/versão é explícito. Recarga/reinício/acesso, resposta antiga após SSE, rollback e backups SQL 5/6 validados. Consulte `docs/COMBAT_RECOVERY.md` e ADR 030. Não reimplemente.

**Concluído quando:** reiniciar a API ou reconectar mantém turno/rodada/NPCs e não ressuscita dados antigos.

**Validação sugerida (sem mínimo de três testes):** reinício; resposta antiga depois de SSE; ação confirmada com resposta perdida e acesso revogado.

**Skills:** `tdd`, `diagnosing-bugs`, `vercel-react-best-practices`. **API:** interna e SSE; nenhuma externa.

#### Item 55 — concluído: condições, duração e alertas

**Entregue:** condições livres por alvo, origem opcional, visibilidade e duração em rodadas/próximo turno/manual; encerramento visível, pausa fora do combate e remoção confirmada. Desconto em transições confirmadas, protegido pela identidade do 54. JSON 006 conserva o combate anterior; acesso em GET/SSE/exportação e rollback/backup/restauração validados. Suíte 134/134, build e navegador desktop/celular aprovados. Contrato em `docs/COMBAT_EFFECTS.md`, ADR 031. Não reimplemente.

**Decisão confirmada:** o usuário escolheu a recomendação — escolher por efeito entre número de rodadas, até o próximo turno ou remoção manual. Explique o marco de início/fim no escopo e preserve a contagem perante recuperação/repetição. Não repita a escolha.

**Concluído quando:** duração e encerramento têm comportamento previsível, com permissões e recuperação preservadas.

**Validação sugerida (sem mínimo de três testes):** duração/transições; acesso/visibilidade; repetição/reinício sem desconto duplicado.

**Skills:** `tdd`, `vercel-react-best-practices`, `frontend-design`, `web-design-guidelines`; `web-animation-design` para alertas. **API:** interna; nenhuma externa.

#### Item 56 — concluído: vídeos e animações nas cenas

**Definição confirmada pelo usuário:** o mestre prepara o vídeo/animação, libera e inicia para todos; o arquivo fica salvo e ele escolhe separadamente quem pode rever em Cenas. Esse escopo substituiu as associações extras de notas/participantes. Texto/pontos antigos permanecem compatíveis.

**Entrega:** MP4/WebM/GIF, envio binário e biblioteca privada, apresentação confirmada com pausa/retomada/recomeço/encerramento, controles pessoais e leitura posterior liberada/revogada pelo mestre. API/SSE/Range/HEAD/exportação respeitam acesso atual; autoplay tem fallback silencioso/manual e movimento reduzido. GIF reinicia ao continuar. SQL/JSON 007 preserva combate/arquivos/dados antigos. Contrato `SCENE_MEDIA.md`, ADR 032; nenhuma API externa/dependência na aplicação.

**Validação proporcional:** um teste HTTP integrado com arquivo MP4 real e GIF, permissões, SSE, comandos versionados, revogação/cache/leitura parcial, reinício, exportação e backup/restauração. Suíte 134/134, build e navegador 1440/390 px, seletor real, duas telas, teclado, vídeo/GIF e visualização posterior. Não repetir três testes artificiais.

**Skills:** `tdd`, `vercel-react-best-practices`, `frontend-design`, `web-design-guidelines`. **API:** interna; nenhuma externa.

#### Item 57 — linha do tempo

**Preparação local, ainda não concluída:** leitor em `CampaignTimeline.jsx` e funções de consulta em `src/shared/campaignTimeline.js`, conferidos com dados fictícios em `quality/57-timeline-preview.html`. Leia `docs/CAMPAIGN_TIMELINE.md` e `quality/57-interface-review.md`. Criação/edição ainda aguarda a escolha enviada; não presuma a resposta nem declare a prévia como integração pronta. Persistência, API, conflito, exportação e navegação ainda precisam ser implementados após essa definição.

**Como fazer:** crie entradas de sessão/decisão com data, texto e vínculos, respeitando edição e visibilidade. Use paginação e ordenação estáveis. Separe a narrativa da campanha dos registros técnicos de auditoria; não transforme o log administrativo em conteúdo de sessão automaticamente.

**Decisão de produto:** somente mestre escreve, ou jogadores podem contribuir? Defina autoria/edição antes da implementação.

**Concluído quando:** entradas podem ser consultadas na ordem correta e não revelam decisões ou referências privadas.

**Validação sugerida (sem mínimo de três testes):** edição/ordenação; acesso/conflito; paginação/reinício/exportação.

**Skills:** `tdd`, `vercel-react-best-practices`, `frontend-design`, `web-design-guidelines`. **API:** interna; nenhuma externa.

#### Item 58 — regras opcionais por sistema

**Como fazer:** pergunte qual sistema o usuário quer primeiro. Mantenha um modo genérico e trate o pacote de regras como configuração versionada por mesa, com campos/fórmulas/condições definidos e validados. Não execute JavaScript arbitrário proveniente de um pacote. Ativar/trocar regras não deve apagar fichas; apresente uma prévia do impacto.

**APIs:** não são necessárias para a estrutura. Um catálogo externo só deve ser avaliado após escolher sistema, conteúdo e fonte. Verifique licença e uso permitido de cada material, cache/limites e funcionamento quando o serviço cair. Não importe um catálogo de D&D automaticamente para todas as mesas.

**Concluído quando:** uma mesa genérica e uma mesa com o pacote escolhido coexistem, sem regressão ou perda ao trocar configuração.

**Validação sugerida (sem mínimo de três testes):** regras e casos conhecidos do sistema; pacote inválido/acesso; troca/migração/rollback.

**Skills:** `tdd`, `vercel-react-best-practices`; skills de design para seleção/prévia. Use documentação primária do sistema escolhido.

#### Item 59 — resumo e preparação de sessão

**Como fazer:** comece com edição manual, vínculos às cenas/decisões e separação entre preparação privada do mestre e resumo compartilhado. Reutilize notas e histórico onde o contrato permitir, sem reintroduzir modelos obrigatórios de Nova nota.

**Decisão de produto:** resumo manual é a primeira opção recomendada. IA é uma opção futura, exige escolha específica sobre serviço, custo e envio de conteúdo. Um resumo gerado deve virar rascunho revisável; dados privados só entram se houver autorização apropriada.

**Concluído quando:** o mestre prepara e compartilha o texto escolhido, mantendo informação privada fora da visão dos jogadores.

**Validação proporcional se alterar dados/API:** composição/salvamento; separação privado/compartilhado; histórico/conflito/reinício.

**Skills:** `vercel-react-best-practices`, `frontend-design`, `web-design-guidelines`, `tdd`; `openai-docs` apenas se OpenAI for o serviço escolhido. **API externa:** nenhuma para a versão manual.

### 11. Visual e acessibilidade

Faça por tela/fluxo, usando dados e operações reais. Evite uma troca ampla de tema que esconda problemas de interação. Bugs graves de foco, rótulos e acesso devem ser corrigidos nas etapas anteriores quando encontrados.

**Pontos de entrada:** `src/theme.css`, `src/index.css`, `src/workspace.css`, estilos dos componentes e componentes React efetivamente alterados. Faça primeiro inventário, depois uma tela piloto e migração gradual. Para revisão visual, use `web-design-guidelines` com a fonte atual indicada em seu `SKILL.md`; para novas interfaces, use `frontend-design` antes de escrever JSX/CSS.

#### Item 60 — teclado, foco, leitura e contraste

**Como fazer:** inventarie mapa, notas, ficha, dados, Mesa 3D e ferramentas do mestre. Revise semântica, nomes de botões, ordem de foco, Escape, retorno de foco e navegação de diálogos. Verifique leitores de tela, contraste, alto contraste e zoom de página. Garanta alternativas sem arraste para operações essenciais.

**Concluído quando:** os fluxos principais podem ser concluídos com teclado e a informação essencial não depende só de cor, ícone ou posição.

**Skills:** `web-design-guidelines`, `frontend-design`, `vercel-react-best-practices`. **API:** nenhuma externa. Validação manual e testes de interação focados; scanner automático, se adotado, complementa a operação real.

#### Item 61 — estados de operação

**Como fazer:** padronize mensagens de carregando, vazio, erro, sem acesso e conexão indisponível, com uma ação útil de saída/repetição. Preserve rascunhos e diferencie “salvo”, “enviando” e “sem confirmação”. Reutilize o mecanismo de reconexão; não adicione fila offline que reenvie automaticamente mudanças sem um projeto específico para conflitos.

**Concluído quando:** cada tela alterada comunica o estado real, com foco coerente e sem apagar trabalho local.

**Skills:** `frontend-design`, `vercel-react-best-practices`, `web-design-guidelines`; `tdd` em salvamento/acesso, `web-animation-design` para feedback. **API:** interna existente; nenhuma externa.

#### Item 62 — toque e telas estreitas

**Como fazer:** confira 390 px e larguras menores pertinentes, orientação horizontal, teclado virtual e zoom. Use alvos de 44 × 44 px quando possível. Mantenha ações principais visíveis, áreas roláveis compreensíveis, campos acessíveis e alternativas para hover/arraste. Remova overflow da página sem esconder controles necessários.

**Concluído quando:** criar/editar/salvar uma nota, usar o mapa e operar ferramentas essenciais funciona no celular com feedback e foco corretos.

**Skills:** `frontend-design`, `web-design-guidelines`, `vercel-react-best-practices`; `web-animation-design` para gestos. **API:** nenhuma externa.

#### Item 63 — tokens do projeto

**Como fazer:** inventarie variáveis existentes e consolide cor, contraste, tipografia, espaçamento, bordas e movimento. Migre por componente, sem uma substituição cega em todos os CSS. Preserve particularidades funcionais de mapa, leitor, ficha e ferramentas, com tokens comuns onde realmente fazem sentido.

**Concluído quando:** novas telas reutilizam tokens e mudanças de contraste/espaçamento não dependem de corrigir dezenas de valores desconexos.

**Skills:** `frontend-design`, `web-design-guidelines`; `vercel-react-best-practices` para React alterado. **API:** nenhuma externa.

#### Item 64 — direção visual por tela

**Como fazer:** apresente uma direção curta e uma tela piloto antes de reformular uma área inteira. Use cartografia impressa no mapa; marginalia/leitura nas notas; ficha física no personagem; instrumentos táticos nas ferramentas. Preserve a identidade do universo, a hierarquia e as ações conhecidas. Evite grades de cards arredondados para tudo, vidro/neon, gradiente roxo automático, emojis como ícones e textos promocionais vagos.

**Referência:** Hallmark já foi autorizado como referência de design; consulte o conteúdo/licença se for reutilizar recursos. Referência visual não exige instalá-lo como dependência do site.

**Concluído quando:** cada tela tem organização adequada à sua função, permanece legível e não muda dados/regras por uma alteração de aparência.

**Skills:** `frontend-design`, `web-design-guidelines`, `vercel-react-best-practices`. **API:** nenhuma externa. `imagegen` só se houver necessidade concreta de um novo bitmap, não para substituir interface feita com HTML/CSS/SVG.

#### Item 65 — movimento reduzido

**Como fazer:** inventarie CSS, animações de dados, câmera, arrastes e loops. Aplique `prefers-reduced-motion` e equivalentes nos efeitos JavaScript. Mantenha feedback estático, legibilidade e resultados dos dados. Use transições com propriedades nomeadas; não use `transition: all` em código novo. Reduzir animação não deve mudar sorteio, física confirmada ou regras do jogo.

**Concluído quando:** alternar a preferência do sistema reduz movimento ornamental e todos os controles continuam comunicando o resultado.

**Skills:** `web-animation-design`, `web-design-guidelines`, `vercel-react-best-practices`. **API:** media query e recursos do navegador; nenhuma externa.

#### Item 66 — desempenho de fontes, imagens e componentes

**Como fazer:** meça carregamento, interação, tamanho do bundle e renderizações em cenários repetíveis. Avalie lazy loading de áreas pesadas com ferramentas compatíveis com Vite/React 18, cache correto, fontes usadas de fato e imagens com dimensões adequadas. Corrija o gargalo medido; não aplique memoização ou dependências em toda a aplicação por padrão. A divisão do bundle não substitui a gestão de memória da Mesa 3D.

**Concluído quando:** a medição antes/depois mostra o efeito da mudança e recursos pesados continuam acessíveis, com permissões, foco e conteúdo preservados.

**Skills:** `diagnosing-bugs`, `vercel-react-best-practices`, `web-design-guidelines`; `frontend-design` se mudar aparência. **API:** nenhuma externa.

### 12. Perguntas que devem aparecer somente na etapa correspondente

Não envie um questionário com todas as decisões agora. Agrupe apenas as perguntas necessárias para a próxima feature, com alternativas simples:

| Etapa | Escolha necessária |
| --- | --- |
| 16 | Lixeira sem exclusão automática ou prazo de retenção escolhido? |
| 17, se ampliar formatos | JSON completo apenas ou também TXT/PNG? |
| 23 | Retomar filtros? Usar campos atuais ou acrescentar região/etiquetas? |
| 48 | Confirmado: impedir mover, girar e mudar tamanho até desbloquear, inclusive números e API. |
| 51 | Confirmado e entregue: mestre define luz; cada pessoa controla sua câmera. |
| 53 | Como devem funcionar rolagens privadas e seu acesso? |
| 55 | Confirmado e entregue: escolher duração por efeito entre rodadas, próximo turno ou remoção manual. |
| 57 | Escrita pelo mestre apenas ou contribuição dos jogadores? |
| 58 | Qual sistema de RPG deve ser o primeiro pacote opcional? |
| 59, se houver IA | Manter resumo manual ou contratar/configurar geração assistida? Quais dados podem ser enviados? |

Se uma resposta não for necessária para continuar outra tarefa independente, continue essa tarefa enquanto aguarda. Não interprete ausência de resposta como aprovação de exclusão, custo ou envio de dados privados.

### 13. Formato do resumo final

Para cada feature entregue, informe:

- O que mudou e onde o usuário encontra a função.
- Por que a solução foi escolhida e quais skills foram aplicadas.
- Se houve novo endpoint, biblioteca ou serviço externo, e qual sua finalidade.
- Testes e validações realmente executados, com resultado.
- Limitações reais e decisões ainda pendentes.
- Próximo item, respeitando as áreas adiadas.

**Continue pelo item 57, preservando as entregas locais 42–52, 54–56, base pública do 53, ajustes de modelos e movimento do 67. Privacidade do 53 aguarda a resposta já perguntada. Apresente escolhas de produto antes da etapa que depende delas; respeite as frentes adiadas e faça validação proporcional ao risco.**

## Fim do prompt
