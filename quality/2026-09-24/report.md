# Histórico de qualidade — Grimório

Data: 24/09/2026. Base: `ede23c0` (`main`), com as alterações locais descritas neste relatório. Escopo: entrada, cadastro, lista de mesas, navegação da sala, fichas, status do grupo e mapas 2D/3D. Mesa e conta `qa_20260924` foram criadas apenas no servidor local para exercitar os fluxos; o arquivo `test-map.png` é um mapa de teste.

## Régua fixa das quatro rodadas

1. Identidade aprovada: preto fosco, dourado e vermelho contidos, com clima de RPG.
2. Texto legível, hierarquia clara e ações reconhecíveis sem depender da decoração.
3. Cadastro, entrada, mesa, fichas, mapas, status e pontos utilizáveis conforme o papel.
4. Layout funcional em celular, tablet e desktop, sem estreitar a área do mapa.
5. Nomes acessíveis, foco visível, alternativas de teclado e respeito a movimento reduzido.
6. Compilação, testes e fluxos reais sem falha impeditiva. A sincronização com dois clientes e tempos de carga não foram medidos nesta revisão.

Pesos mantidos: identidade 20%, hierarquia 20%, usabilidade 20%, responsividade 15%, acessibilidade 15%, funcionamento e desempenho 10%. Todas as seis dimensões receberam alguma verificação em cada rodada (cobertura ponderada da régua: 100%); a verificação funcional foi parcial nos cenários explicitados acima. As notas de funcionamento nas rodadas 1 e 2 incorporam a falha do visualizador descoberta na rodada 3. Uma média alta não aprovaria um fluxo essencial que abre tela vazia.

| Rodada | Identidade | Hierarquia | Usabilidade | Responsividade | Acessibilidade | Técnico | Nota ponderada | Faixa |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| 1 | 8,0 | 6,5 | 6,5 | 5,5 | 5,5 | 5,0 | **6,35** | Ruim |
| 2 | 8,0 | 7,0 | 7,0 | 7,5 | 6,0 | 5,0 | **6,93** | Bom |
| 3 | 8,0 | 7,0 | 7,4 | 7,5 | 6,7 | 3,0 | **6,91** | Bom, com bloqueio |
| 4 | 8,0 | 7,2 | 7,8 | 7,5 | 7,0 | 7,5 | **7,53** | Bom |

## Rodada 1 — diagnóstico e correções de maior impacto

**Qualidades preservadas:** identidade escura com dourado e vermelho, boa separação entre entrada e sala, funções de jogador/mestre/ADM descritas na entrada, fichas e bandeja existentes.

**Problemas:** [médio] rótulos e apoio de cadastro/lobby em 12 px, reduzindo leitura; [médio] erro de senha diferente sem foco ou associação ao campo; [baixo] frases genéricas na entrada e lobby; [alto] área de mapa estreita no tablet, confirmada na rodada seguinte; [crítico] visualizador de ponto 3D quebrado, reproduzido na rodada 3.

**Correções:** rótulos e textos de apoio a 14 px; confirmação de senha inválida recebe foco, estado e descrição; placeholder de senha adequado a login/cadastro; entradas de mesa e convite ganharam nomes; texto editado com `no-ai-slop` sem trocar o tom da marca: “Reúna o grupo, prepare a campanha...” → “Convide o grupo, organize as fichas e abra o mapa da campanha.”; “Seu grupo, suas histórias” → “Mesas e convites”. O rodapé passou a dizer “Mapa, fichas e dados.”

**Evidências:** [login antes](round1/before-login-desktop-1440x900.jpg) / [login depois](round1/after-login-desktop-1440x900.jpg); [mesas antes](round1/before-mesas-desktop-1440x900.jpg) / [mesas depois](round1/after-mesas-desktop-1440x900.jpg); [erro de cadastro após correção](round1/after-cadastro-error-desktop-1440x900.jpg). Cadastro com senhas diferentes mostrou erro e moveu o foco ao campo de confirmação. Capturas de partida também registram [ficha](round1/before-fichas-desktop-1440x900.jpg), [grupo](round1/before-status-desktop-1432x895.jpg) e [mapa 2D](round1/before-mapa2d-desktop-1440x900.jpg). A captura móvel de entrada tem 390×844 pixels; a captura parcial de 390×436 foi preservada, mas não usada para pontuar responsividade.

**Pendência ao fim:** mapa de tablet espremido; interação com ponto ainda sem teste. Responsável: agente principal.

## Rodada 2 — estrutura, navegação e responsividade

**Qualidades preservadas:** quatro áreas principais no mesmo espaço, status ativo na navegação, câmera do mapa independente por pessoa.

**Problemas:** [alto] em 768 px, a especificidade das regras de CSS deixava o mapa 3D em ~190 px e as ferramentas no restante da linha; [médio] “Mestre · fichas” e “Status do Grupo” quebravam em linhas no menu móvel; [baixo] slogan da barra lateral não indicava sua função.

**Correções:** em telas de até 1100 px, a cena ocupa a largura disponível e as ferramentas ficam abaixo; rótulos móveis “Ficha” e “Grupo” mantêm nomes completos para tecnologia assistiva; botões de navegação expõem estado pressionado; kicker da marca passa a “Sua mesa de RPG”.

**Evidências:** [mapa tablet antes](round2/before-mapa-tablet-760x1013.jpg) / [mapa tablet depois](round2/after-mapa-tablet-760x1013.jpg); [menu móvel antes](round2/before-grupo-mobile-382x827.jpg) / [menu móvel depois](round2/after-grupo-mobile-382x827.jpg). As imagens mantêm a mesma dimensão raster em cada par; o viewport configurado foi 768×1024 e 390×844, respectivamente.

**Pendência ao fim:** seletor nativo de arquivo mostrava “Choose Files”; mapa 2D ainda dependia do mouse; visualizador de ponto não testado. Responsável: agente principal.

## Rodada 3 — texto, acessibilidade e exploração funcional

**Qualidades preservadas:** cena 3D ampla, seleção de arquivos múltiplos com tipos existentes, mapa 2D e pontos sincronizados com a sala.

**Problemas:** [médio] rótulo inglês do seletor nativo aparecia dentro da interface em português; [médio] upload 2D ocultava o input com `display:none`, removendo o acesso pelo teclado; [médio] mapa 2D não tinha botões para zoom ou inclusão de ponto; [alto] dica “Clique: ver ponto” não correspondia ao bloqueio do clique para jogadores; [crítico] ao abrir o ponto, `Scene3D` lançava `ReferenceError: X is not defined` e deixava a página preta.

**Correções:** seletor de arquivo 3D com rótulo próprio e quantidade selecionada; input 2D visualmente oculto, mas acessível por teclado; texto dos controles em português; botões de zoom, centralização e criação de ponto no centro; cálculo de coordenadas do clique ajustado ao retângulo renderizado do canvas; clique em ponto existente permitido a jogadores. A falha crítica foi registrada para a rodada final antes da aprovação.

**Evidências:** [mapa 3D antes](round3/before-mapa-desktop-1440x900.jpg) / [mapa 3D depois](round3/after-mapa-desktop-1440x900.jpg); [mapa 2D antes](round1/before-mapa2d-desktop-1440x900.jpg) / [mapa 2D depois](round3/after-mapa2d-desktop-1440x900.jpg); [2D com imagem e ponto real](round3/after-mapa2d-com-ponto-desktop-1432x895.jpg). Upload de PNG local, zoom de 100% para 120% e criação do marcador por botão foram confirmados no navegador. A queda técnica de 5,0 para 3,0 reflete a falha reproduzida, não uma regressão atribuída aos ajustes desta rodada.

**Pendência ao fim:** bloqueio crítico do visualizador; aprovação negada. Responsável: agente principal.

## Rodada 4 — correção final e regressões

**Qualidades preservadas:** mapa 2D e marcador em modo jogador, modal de local com visualização 3D, edição de ponto pelo mestre.

**Problemas:** [crítico] importação ausente do ícone `X` no visualizador; [médio] modal de novo ponto sem nomes programáticos dos campos; [baixo] abertura do visualizador animava mesmo sob preferência de movimento reduzido.

**Correções:** importação do ícone; visualizador com nome de diálogo, botão “Fechar local”, foco inicial, fechamento por Escape e renderização estática para movimento reduzido; formulário de ponto com `label`/`htmlFor`, foco no nome, grupo de tipo com estado, botão de inclusão inativo sem nome e Escape para fechar.

**Evidências:** [abertura do ponto antes — página preta](round4/before-ponto-jogador-desktop-1440x900.jpg) / [abertura do ponto depois](round4/after-ponto-jogador-desktop-1440x900.jpg); [mapa 2D no celular](round4/after-mapa2d-mobile-382x827.jpg). No navegador, ADM em modo jogador abriu o marcador persistido, viu descrição e cena 3D e fechou com Escape. `npm run build` e `npm test` passaram (18/18); o build avisou que o bundle principal tem ~1 MB antes de gzip. Não houve medição de carga em rede lenta nem teste simultâneo com dois navegadores.

**Pendências:** avaliar divisão do bundle e desempenho em aparelho fraco; validar sincronização de edição e visualização com dois clientes reais; revisar fluxo completo de teclado no canvas e contenção de foco dos diálogos. Responsável: próxima revisão do agente principal, se solicitada.

## Resultado e continuidade

A melhor versão validada é a árvore local após a quarta rodada: **7,53/10 (Bom)**, acima dos 6,35/10 da rodada 1. A faixa “Muito bom” (8,5) não foi alcançada e nenhuma quinta rodada foi iniciada. O bloqueio de página preta foi eliminado no fluxo testado; o desempenho em dispositivos modestos e a experiência multiusuário seguem sem verificação completa. As capturas originais permanecem em `quality/2026-09-24/round1` a `round4`.

Referência técnica de interface: [Web Interface Guidelines](https://github.com/vercel-labs/web-interface-guidelines), aplicadas à legibilidade, foco, formulários e movimento reduzido. A skill `no-ai-slop` orientou as alterações mínimas de texto. Nenhuma dependência ou skill nova foi instalada; não foram usados agentes auxiliares.

Complemento posterior: [teste com dois clientes e acesso pela rede local](../2026-09-25/multiscreen.md). As pendências acima registram o estado ao final das quatro rodadas de 24/09.
