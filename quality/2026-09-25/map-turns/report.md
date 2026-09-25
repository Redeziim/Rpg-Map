# Validação: mapa e ordem de turnos — 25/09/2026

Marco avaliado: ampliar os mapas 3D/2D e criar uma faixa de iniciativa inspirada nas referências de *For The King*. Jogadores entram automaticamente na ordem; mestre e ADM podem incluir inimigos/NPCs, retirar e recolocar jogadores no combate, avançar e reorganizar turnos. Retirar um jogador do combate preserva sua participação na mesa. O motor de dados, fichas e mapas foi mantido.

Régua fixa das quatro rodadas: adequação visual ao briefing (20%), composição (20%), usabilidade (20%), responsividade (15%), acessibilidade (15%) e funcionamento/desempenho (10%). Notas de 0 a 10; média ponderada arredondada a uma casa. A cobertura é de 90%: interface, permissões, persistência, sincronização SSE e build foram verificados; desempenho com um mapa 3D importado de tamanho real não foi medido porque a mesa de QA continha apenas a grade vazia. A nota geral é provisória.

| Rodada | Visual | Composição | Usabilidade | Responsividade | Acessibilidade | Técnico | Geral | Classificação |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| 1 — diagnóstico e impacto | 8,0 | 7,5 | 7,0 | 7,0 | 7,0 | 8,0 | **7,4** | Bom |
| 2 — estrutura e navegação | 8,5 | 8,0 | 8,0 | 8,0 | 7,5 | 8,0 | **8,0** | Bom |
| 3 — refinamento e acesso | 8,5 | 8,5 | 8,5 | 8,0 | 8,0 | 8,5 | **8,4** | Bom |
| 4 — regressão final | 8,5 | 8,5 | 8,5 | 8,0 | 8,5 | 8,5 | **8,4** | Bom |

## Rodada 1 — diagnóstico e maior impacto

- Preservado: tema fosco, cartografia dourada, controles de câmera e importação de objetos.
- Problema: no desktop, barra lateral fixa de 218 px e teto de 58dvh diminuíam a área 3D; a ordem ficava escondida em `<details>`.
- Correção: ferramentas em painel sobreposto, viewport maior e faixa horizontal de retratos sempre visível. Escopo: `TabletopMap.jsx`, `TurnTracker.jsx` e `workspace.css`.
- Evidência antes/depois, mesa de QA a 1440×900: [3D antes](before-map-3d-desktop-1440x900.jpg) · [3D depois](after-map-3d-desktop-1440x900.jpg). A cena de teste não tinha objetos importados.

## Rodada 2 — estrutura, navegação e responsividade

- Preservado: arrastar, zoom e coordenadas dos pontos do mapa 2D.
- Problema: a imagem 640×480 mantinha seu tamanho nativo num painel muito maior. Ferramentas laterais também reduziam a largura útil.
- Correção: ajuste proporcional ao espaço disponível com `ResizeObserver`; ferramentas 2D abertas sob demanda; modo de foco; breakpoint da barra de câmera ampliado para 1100 px.
- Evidência antes/depois: [2D desktop antes](before-map-2d-desktop-1440x900.jpg) · [depois](after-map-2d-desktop-1440x900.jpg); [2D celular antes](before-map-2d-mobile-390x844.jpg) · [depois](after-map-2d-mobile-390x844.jpg). Medição DOM no desktop: imagem de 648×488 para 939×704 px, sem mudar a proporção.

## Rodada 3 — visual, acessibilidade e qualidade técnica

- Preservado: exclusividade de mestre/ADM para editar turnos e leitura dos jogadores.
- Problemas: o editor novo podia sair pela direita no celular; remover o ator ativo reiniciava a sequência; a lista horizontal não recebia foco de teclado.
- Correções: editor ancorado à faixa no celular, foco navegável nos retratos, nomes completos no `title`, foco restaurado ao controle após remoção e passagem automática ao sucessor quando o ator ativo sai. Formulário recebeu nomes e rótulos acessíveis.
- Evidência antes/depois, 390×844: [editor antigo](before-turn-editor-mobile-390x844.jpg) · [editor novo](after-turn-editor-mobile-390x844.jpg). Medição do painel novo: esquerda 19 px, direita 367 px em viewport de 390 px.

## Rodada 4 — regressões e consolidação

- Preservado: visual móvel escuro e funcionamento do mapa, fichas e dados; nenhuma alteração no motor dos dados.
- Verificado: `npm test` (18/18), `npm run build`, `git diff --check`; inclusão e remoção de inimigo/jogador pela interface; entrada automática, permissões, persistência e transmissão SSE pelos testes da API; mapas 3D/2D em desktop e celular, 3D em tablet; foco e painel de ferramentas; ausência de transbordamento horizontal em 390 px.
- Evidência de regressão, mesma mesa: [3D tablet antes](before-map-3d-tablet-820x900.jpg) · [depois](after-map-3d-tablet-820x900.jpg); [3D celular antes](before-map-3d-mobile-390x844.jpg) · [depois](after-map-3d-mobile-390x844.jpg); [foco móvel final](after-map-focus-mobile-390x844.jpg). A avaliação final manteve 8,4 porque a grade vazia não comprova desempenho de cena 3D real.

A melhor versão validada é a atual. O agente auxiliar `qa_review` fez revisão independente e somente leitura de API, permissões, CSS e testes; os achados sobre painel móvel, sucessor do turno e foco por teclado foram corrigidos pelo agente principal. Estado: concluído para este marco. Pendência para um próximo marco: medir fluidez e enquadramento com o mapa 3D do usuário importado, sem alterar a mecânica dos dados.
