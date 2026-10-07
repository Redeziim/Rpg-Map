# RPG Map Explorer — contexto atual

Atualizado em 2026-10-04. Fonte do código: [Redeziim/Rpg-Map](https://github.com/Redeziim/Rpg-Map). Registro do conhecimento e skills: [Redeziim/RPG-Dev-Vault](https://github.com/Redeziim/RPG-Dev-Vault).

## Arquitetura

- Vite 6, React 18, JavaScript e Three.js; Node.js 24+, SQLite e sincronização SSE.
- A implementação do mapa e modos mestre/jogador fica em `src/components/RPGMapExplorer.jsx`; API em `server/`; a mesa 3D é independente dos pontos do mapa 2D.
- Notas: `src/components/Notebook.jsx`; rascunhos em localStorage e IndexedDB; servidor aplica privacidade por conta, mesa, autoria e compartilhamento.
- Build: `npm run build`. Desenvolvimento: `npm run dev`. Dependências usam npm e package-lock.

## Skills de agente

Obrigatórias conforme a tela/tarefa:

- `frontend-design`: interface e direção visual.
- `vercel-react-best-practices`: React e desempenho.
- `tdd`: contratos de comportamento e testes proporcionais.
- `diagnosing-bugs`: falhas e regressões difíceis.
- `web-design-guidelines`: revisão de UI/acessibilidade depois da implementação.
- `web-animation-design`: movimento e transições.
- `code-review`: revisão de especificação e padrões.
- `setup-matt-pocock-skills`: configuração de instruções e acompanhamento por GitHub Issues.

Arquivos instalados e configuração: `Skills/`, `Skills/Configuracao-RPG-Map/`, `AGENTS.md` e `docs/agents/` neste projeto. O projeto aponta tarefas a GitHub Issues de `Redeziim/Rpg-Map` e decisões de domínio a `docs/adr/`. Os skills foram guardados no Vault para uso em outros projetos.

## APIs, dependências e referências

- API própria autenticada (Node/SQLite), SSE, mídia HTTP Range/HEAD e APIs nativas do navegador. Consulte os contratos em `docs/`.
- Nenhum serviço ou API externa foi integrado para IA, dados ou armazenamento do conteúdo de RPG.
- [public-apis](https://github.com/public-apis/public-apis) foi dado para pesquisa de opções; cada nova API precisa de decisão sobre finalidade, privacidade, licença, operação e custo antes da integração.
- [Nutlope/hallmark](https://github.com/Nutlope/hallmark), MIT, foi consultado como referência de padrões de interface. Não é dependência do produto e não envia dados das mesas.
- Dependências relevantes existentes: Three.js, Sharp, `gltf-validator` (Khronos) e `meshoptimizer`; servem processamento local/validação/otimização. Confira versões atuais em `package.json`.
- Repositório principal: `Redeziim/Rpg-Map`. Vault: `Redeziim/RPG-Dev-Vault`. Repositórios ou APIs externos adicionais ficam registrados aqui e no documento de recursos.

## Decisões confirmadas pelo usuário

- Notas pessoais privadas; jogadores também criam as próprias notas. Compartilhamento é explícito.
- Uma nota simples por vez; busca dentro da nota ou mapa mental aberto e destaque das ocorrências.
- O mapa mental ainda precisa de refinamento; essa frente foi adiada.
- O mapa 2D mantém pontos e vínculo entre nota/ponto. Cenas 3D iniciadas por ponto 2D foram removidas/adiadas; a mesa 3D independente permanece.
- PDF não é aceito. Formatos pendentes devem oferecer alternativas sem PDF.
- Atualizar prioritariamente notas, mapa 2D, confiabilidade, mesa 3D, campanha e acessibilidade conforme `PLANO_DE_MELHORIAS.md`.
- Para a linha do tempo (item 57), só o mestre/ADM no modo mestre cria e edita; jogadores consultam entradas liberadas.
- Mestre apresenta e salva vídeos/animações nas cenas; escolhe separadamente se jogadores podem rever.
- ADM em modo jogador atua como jogador no mapa: vê seus traços e não edita pontos.
- Conflitos de edição de mapa devem ser resolvidos por campo para nome, descrição e tipo.
- Preparação do mestre na linha do tempo é sempre reservada e nunca vai a jogadores (2026-10-07, ADR 034).
- Cores e fontes novas usam os tokens de src/theme.css; o limite de cores literais só desce (2026-10-07).
- Commits locais são permitidos sem pedir; push só quando o usuário pedir (2026-10-07).
- Usuário autorizou IndexedDB para cópias locais; novas APIs externas devem ser identificadas e aprovadas antes do uso no produto. Baixar código/repos de referência foi autorizado.

## Estado e próximo trabalho

- Itens 42–52 e 54–56, 67, ajuste de detalhe/escala de modelos e item 2 constam como concluídos localmente. Parte dessa implementação permanece em alterações não publicadas no clone do projeto.
- Item 2: erro de aba duplicada causado por `sessionStorage` clonado corrigido; documentos agora têm identidade de escrita própria e a aba anterior é somente origem de leitura. Caderno lista cópias; recuperação preserva o texto aberto antes da troca e não publica. localStorage, IndexedDB, migração de rascunhos legados e cópia JSON de emergência estão registrados em ADR 033.
- Item 53: concluído em 2026-10-07 (rolagens privadas por padrão, só a da mesa começa pública).
- Item 57: entregue em 2026-10-07 (SQL 008, API, aba Linha do tempo, editor, histórico, exportação). Contrato em `docs/CAMPAIGN_TIMELINE.md`, ADR 034. Item 59 entregue como tipo Preparação, sempre reservada.
- Itens restantes em 2026-10-07: 16–18, 23 (adiado), 58 e a tela-piloto do 64, todos à espera de resposta (`docs/PERGUNTAS_EM_ABERTO.md`). Itens 60–66 tiveram a primeira rodada. Não reabrir mapa mental ou item 23 sem novo escopo.

## Histórico da conversa (síntese)

1. Usuário solicitou auditoria geral do produto, busca no GitHub e catálogo de melhorias, APIs e repositórios com prompts de implementação.
2. Priorização definida pelo usuário; notas e mapa mental primeiro. Foram removidas cenas 3D abertas por pontos 2D, mantendo a mesa 3D independente. Notas continuam vinculadas a pontos 2D.
3. Hallmark adicionado como referência e o usuário pediu que skills, instruções de agentes e contexto do RPG também fossem guardados neste Dev Vault.
4. Novas solicitações no mapa: retirar modelos de categorias de nota; simplificar e refinar o quadro mental; adiar refinamento amplo; busca no conteúdo aberto. Regra de seleção múltipla foi preferência em etapa anterior, ainda sujeita ao escopo futuro do quadro.
5. Mesa 3D recebeu/planeja mudanças de qualidade de modelo, movimento remoto, objetos e seleção múltipla, grupos/bloqueio, mestre mover/retirar/pular participantes, iluminação/câmera e recuperação WebGL. Detalhes validados ficam nos ADRs e documentos da Mesa 3D.
6. Cenas de campanha foram definidas como vídeos/animações salvos: mestre libera e começa a reprodução para jogadores conectados; decide se depois podem assistir pelas cenas.
7. Nesta continuação, a duplicação de abas fazia uma sobregravar a cópia da outra. O bug foi reproduzido e corrigido; smoke QA confirmou isolamento, recarga, quota real, recuperação e JSON de emergência. Código ainda está no checkout local.

## Pendências e limites conhecidos

- Verificar queda abrupta do navegador/processo e recuperação de rascunho de cena duplicado em uma execução isolada futura.
- Qualquer fluxo que publique, integre uma API externa ou use um repositório precisa ter destino e alterações concretas revistos; manter dados de produção fora de QA.
- A pasta espelhada deste Vault contém documentação/contexto e skills, não uma cópia executável do código. O código permanece no repositório principal.

Veja também: [[Progresso-e-Planejamento]], [[APIs-e-Recursos]], [[Chat-Contexto-2026-10-04]], [[Dev-Vault-Sync]].
