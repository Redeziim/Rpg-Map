# Item 57 — revisão da preparação do leitor

Data: 2026-10-04. Estado: preparação, não integração concluída.

## Escopo

Leitor React e funções de data/projeção/páginas. A prévia HTTP contém somente dados fictícios, com identificação visível, e não grava nem lê registros de mesas. Criação/edição dependem da escolha já enviada sobre autoria. Acesso no servidor, persistência, conflitos, SSE, revisão de cursor e exportação ainda não foram implementados/validados para a linha do tempo.

## Direção e revisão

Diário de campanha, datas na margem ocre, registros em lista com divisórias, título Cinzel e texto Source Sans 3. Uma coluna no celular. Sem animação nova.

Skills: `frontend-design`, `vercel-react-best-practices`, `web-design-guidelines`. Fonte atual consultada: [Web Interface Guidelines](https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md). A etapa HTTP usará `tdd` nos limites públicos já autorizados após a escolha de edição.

- `src/components/CampaignTimeline.jsx:13` — foco no título somente após navegação solicitada; sem foco automático inicial. Paginação por botões nativos operáveis por teclado.
- `src/components/CampaignTimeline.jsx:17` — seletor rotulado, name/autocomplete; desabilitado durante consulta ou desconexão.
- `src/components/CampaignTimeline.jsx:19` — estados carregando/reconectando em status; erro com tentativa; vazio específico por tipo. Listas anteriores podem permanecer visíveis durante carregamento.
- `src/components/CampaignTimeline.jsx:22` — ol/article/time, hierarquia de títulos, texto sem HTML arbitrário e vínculos limitados aos destinos fornecidos pelo pai. O componente não decide permissões.
- `src/components/CampaignTimeline.css:5` — layout por CSS, textos quebráveis, cores e tipos em tokens. Botões ≥44 px, foco visível, hover contido e cores forçadas; sem transição genérica.
- `quality/57-timeline-preview.jsx` — cabeçalho h1, dados fictícios identificados, controles nomeados; raiz React reutilizada em HMR para eliminar aviso de montagem duplicada observado durante edição.

## Evidências de consulta

Normal `npm run dev` confirmado ao iniciar a validação: Vite 5178/API 3106. A prévia foi compilada/aberta pelo Vite em `/quality/57-timeline-preview.html`; build da aplicação existente aprovado, 3,17 s. Não foi alegado que o componente ainda não integrado faça parte do bundle principal.

Desktop 1440×900:

- Primeiro Acordo com a guarda, depois Sessão 12, na mesma data, segundo horário de criação.
- Enter em Ver registros mais antigos mostrou 29/09 e 19/09, sem repetir a primeira página; foco voltou ao título.
- Filtro Decisões mostrou somente os dois registros correspondentes.
- Erro exibiu Tentar novamente; usar a ação retirou o erro. Vazio não mostrou paginação vazia. Desconexão preservou registros e desabilitou consulta/página.
- Na projeção fictícia de mestre, apareceram o registro reservado e seus destinos; na de jogador, nenhum desses títulos/nomes apareceu no DOM. Isso valida a projeção da prévia, não autenticação de API futura.

Celular 390×844:

- Uma coluna e quebra de texto. clientWidth/scrollWidth 390 px, sem overflow horizontal.
- Botões Abrir ponto/cena e Ver registros mais antigos medidos em 358×44 px.
- Estado carregando comunicou espera e desabilitou filtro/página; estado normal restaurou os controles.
- Aba final nova: zero avisos/erros no console. O aviso transitório de raiz duplicada em HMR foi corrigido antes dessa observação.

Exemplos executados pelo módulo público: 29/02/2024 válido; 29/02/2025, 31/04/2026 e ano 0000 recusados. Data 04/10/2026 formatada sem troca por fuso. Empate de data/criação ordenou identificadores c, a, b em páginas individuais, última sem continuação; array de origem permaneceu a, c, b.

Imagens: `57-timeline-preview-desktop.png` e `57-timeline-preview-mobile.png`. Nenhuma dependência nova/API externa; nenhuma nova suíte automatizada foi escrita para esta preparação reversível. Os 134 testes da entrega anterior não foram apresentados como evidência da API ainda ausente.

## Trabalho restante do 57

Escolha de autoria/edição; armazenamento/migração e validador; API e acesso real; editor e proteção de rascunhos/conflitos; arquivar/restaurar; snapshots/SSE/páginas versionadas; exportação/backup/reinício; navegação e verificação da feature integrada. Não marcar o item 57 concluído com esta prévia.
