# Carga gradual e detalhe por distância da Mesa 3D

Entrega local de 2026-10-03, restante do item 49. Em **Mapa → Mesa 3D → Ferramentas**, o painel informa quantos objetos estão carregados e quantos aguardam aproximação ou seleção. Nenhuma API externa, dependência ou migração foi acrescentada. Pacotes, permissões, backups e exportações existentes permanecem canônicos.

## Carregamento

`createSceneStream` é a interface pública consumida pelo renderer. Recebe o snapshot de objetos, câmera, seleção e qualidade; entrega modelos Three.js, remoções, falhas e um resumo. Sua fronteira de download usa a API autenticada existente. Os três testes usam pacotes HTTP reais e os mesmos parsers, sem substituir colaboradores internos por mocks. Esta fronteira foi confirmada pelo projeto.

Prioridade: objetos selecionados, objetos visíveis e, depois, objetos próximos fora da câmera. Antes de decodificar o pacote, usa um volume conservador de raio `30 × maior escala`, pois o snapshot não contém as dimensões ou o tipo do pacote. Objetos a menos de quatro raios também podem começar a carregar fora da câmera. Grupos selecionam seus membros inteiros pelo contrato do item 48.

No máximo duas operações de download/preparação ficam ativas. A prévia privada reserva vagas na mesma capacidade. Abortos continuam contando até a operação terminar: um parser síncrono já executando não libera uma vaga antecipadamente. Seleção pode substituir uma requisição de prioridade menor. Há uma pausa de execução antes de cada parse para permitir entrada/câmera entre modelos.

A fila é revista ao mudar objetos, seleção, qualidade, visibilidade da página ou tamanho da tela. Mudanças de câmera são agrupadas em uma janela de 80 ms; não há polling ou renderização contínua de cena parada. Cargas sem destino útil são canceladas. Modelos fora da visão, não selecionados e além de oito raios são liberados; voltar pode exigir novo download. A página oculta interrompe trabalhos pendentes, conservando os modelos já prontos até a retomada.

**Focar seleção** funciona antes de o arquivo terminar: usa limites conservadores e ajusta aos limites reais quando todos os objetos pedidos chegam. Um movimento manual de câmera cancela esse ajuste pendente. **Enquadrar** inclui também os objetos ainda não carregados. Erros não entram em repetição automática; **Tentar carregar novamente** solicita uma nova tentativa com a câmera atual.

## Representações reais

Cada modelo compatível tem a representação próxima na qualidade escolhida e uma malha distante derivada no worker existente. `THREE.LOD` alterna entre geometrias reais. A distante tenta conservar 25% dos triângulos da próxima, com erro alvo de 3%, mantendo bordas, UV, normais, cores e grupos de material. Se a redução for menor que 10%, não mantém uma segunda representação. Modelos pequenos, com esqueleto, morph targets ou instâncias ficam preservados.

O limite é 18 vezes o raio do modelo normalizado, considerando a escala atual, com histerese de 18%. Seleção força a representação próxima, inclusive em grupos e objetos bloqueados. **Original manual desativa a redução por distância.** Automática/Leve a usam. A variante distante compartilha materiais e imagens; não altera as texturas compartilhadas. A base Leve continua reduzindo texturas pelo contrato anterior.

Poses, identidade, seleção, gizmos, bloqueios e interpolação pertencem ao objeto externo estável. Alternar detalhe não publica poses, duplica objetos ou baixa o arquivo novamente. A propriedade de recursos segue `retainModel`/`disposeModel`: ambas as geometrias são liberadas somente após o último proprietário. Reconstrução do renderer usa o estado autorizado atual.

## Custos separados e limites

Fixture: esfera OBJ de 3.968 triângulos, 463.884 bytes de arquivo, pacote binário de 464.010 bytes com nome `sphere.obj`.

| Custo | Evidência |
| --- | --- |
| Download inicial | Na cena de 12 objetos, 9 distantes, o navegador passou de carregar todos para carregar 3. Cada pacote necessário continua usando o original. Para 12 pacotes iguais ao da medição, payload passa de 5.568.120 para 1.392.030 bytes; headers/nomes e protocolo HTTP não estão nessa estimativa. |
| Preparação/CPU | Ensaio local Node, três ciclos: Original parse 9,35–16,63 ms, derivação 16,95–32,18 ms; Leve parse/redução 23,24–25,51 ms, derivação adicional 2,55–2,62 ms. No Node o simplificador usa fallback local; estas medidas não são latência de navegador nem tempo do worker em outro aparelho. Gerar a variante adiciona trabalho de CPU. |
| Desenho | Original próximo 3.968, distante 992 triângulos; Leve próximo 1.984, distante 496. No navegador, três modelos Leve passaram de 5.952 para 1.488 ao afastar a câmera. Triângulos são carga de desenho, não uma medição de tempo de GPU ou FPS. |
| Geometria residente | Original + distante: 413.664 bytes, contra 380.928 da base isolada. Leve + distante: 79.392 bytes. São arrays de geometria, não heap total, texturas ou memória do driver. Ambas as variantes podem ficar alocadas após serem desenhadas. |

Foram avaliadas variantes prontas antes do download: exigiriam produção, armazenamento/cache, validação e manutenção para todos os formatos, incluindo materiais e malhas especiais. Esta entrega conserva a derivação local autorizada; não introduz outro pacote canônico ou cache permanente. Download de cada arquivo, parse inicial e preparação de atributos ainda usam o original. Não promete eliminar travamentos de qualquer arquivo de 50 MB: parsers Three.js síncronos podem bloquear enquanto executam. Duplicatas reutilizam o pacote persistido, mas cada objeto ainda possui sua preparação local; não há cache compartilhado de modelos decodificados entre objetos.

## Validação

Exatamente três testes novos em `tests/tabletop-streaming.test.js`, cada um observado falhando antes da implementação:

1. HTTP real: seleção/proximidade antes dos distantes, duas operações no máximo e carga adiada.
2. Câmera, seleção, reserva da prévia, página oculta, qualidade, falha HTTP 503, tentativa explícita e encerramento: somente os trabalhos atuais chegam à cena.
3. Geometria real: redução distante, retorno ao aproximar/selecionar/Original, pose/normalização preservadas, pacote HTTP intacto e descarte somente após a última cópia.

Suíte completa: 125 testes aprovados. Build aprovado; aviso conhecido do chunk Three.js de aproximadamente 550 kB. `npm run dev`, banco descartável, 1440/390 px: carga 3/12, afastar/aproximar, seleção/foco de objeto distante, Enquadrar, câmera por teclado, Original/Leve, prévia privada com troca de qualidade/cancelamento, grupo bloqueado, desmontagem/reabertura e console sem erros. Em 390 px, a página mede 382 px, sem transbordamento horizontal. Não foi simulada nova perda nativa de contexto WebGL neste item; os testes existentes de recuperação continuam passando.

Revisão visual: instrumentos táticos existentes, resumo em linguagem simples, estados reais de espera/falha e botão nomeado por ação. `web-design-guidelines` aplicado aos JSX alterados; `vercel-react-best-practices` aplicado a callbacks estáveis e atualizações deduplicadas, sem estado React por quadro.

| Interação anterior | Interação atual |
| --- | --- |
| Movimento remoto em 180 ms e edição local imediata | Mantidos, com redução de movimento e sem escritas por quadro |
| Todos os modelos carregam na ordem da lista | Fila espacial com capacidade limitada e cancelamento |
| Detalhe constante após a redução inicial | Troca de geometria sem animação ornamental ou loop permanente |

Próximo: item 50, referências entre objetos 3D, pontos 2D, cenas e notas, preservando privacidade e identidade.
