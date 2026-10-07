# Qualidade e movimento da Mesa 3D

Entrega local de 2026-10-02, solicitada após o item 43. Em **Mapa → Mesa 3D → Ferramentas**, escolha **Automática**, **Original** ou **Leve**. A qualidade é pessoal, guardada por conta/mesa no localStorage versionado; a interface avisa se só puder conservá-la na sessão. O SQLite, backups, exportação e arquivos originais permanecem iguais. Não usa API externa.

## Qualidade

Original conserva malhas/texturas. Leve usa `meshoptimizer@1.3.0`, [MIT](https://github.com/zeux/meshoptimizer), em worker com prazo de 10 segundos. Após a escolha de redução automática, o alvo é relativo ao original: conserva entre 10% e 50% dos triângulos, mirando 60 mil, com erro geométrico alvo de 1%. Preserva bordas, grupos de materiais, UV, normais e cores; compacta também atributos dos vértices. Topologia e limites podem impedir a redução pretendida. Malhas pequenas, com esqueleto, morph targets, instâncias ou intervalo de desenho particular são preservadas. Texturas comuns reduzem metade das dimensões, ou um quarto acima de 16 MP originais, com maior lado de até 1.024 px; imagens de até 64 px e formatos especiais permanecem. O painel informa triângulos/pixels antes e depois, porcentagem real e recursos mantidos. Contrato/evidências atualizados em [MODEL_DETAIL_AND_SCALE.md](MODEL_DETAIL_AND_SCALE.md), ADR 027.

Automática começa em Leve se houver indicação de até 4 GB de memória, até 4 processadores lógicos ou textura máxima abaixo de 4.096 px. Dados ausentes não significam aparelho fraco. A cena também muda para Leve acima de 500 mil triângulos, 32 milhões de pixels de textura ou média superior a 24 ms em 30 renderizações observadas. Amostras acima de 250 ms e página oculta não alimentam esse último critério. Ele mede trabalho síncrono/driver, **não todo o tempo de GPU ou FPS**. São pistas locais, sem telemetria. O perfil não oscila para Original até uma nova escolha/reabertura. Escolhas manuais prevalecem.

Trocar qualidade conserva câmera/seleção, cancela cargas anteriores e recarrega com fila de dois modelos. O original pode ser restaurado a qualquer momento. Leve limita também o pixel ratio a 1. A primeira leitura/decodificação de cada pacote ainda usa o original; não reduz todo o pico inicial nem garante qualquer pacote em qualquer aparelho. Em 2026-10-03, o restante do item 49 acrescentou [carga espacial e LOD](TABLETOP_STREAMING.md): modelos distantes aguardam aproximação/seleção e geometrias reais alternam detalhes. Original manual conserva todos os detalhes. Variantes prontas antes do download foram avaliadas e não foram acrescentadas.

## Movimento recebido

Posição, rotação e escala recebidas por SSE são interpoladas por 180 ms, com aceleração/desaceleração contida e quaternion pelo caminho mais curto. Atualizações durante a transição partem da pose exibida; duplicatas não reiniciam e revisões antigas são ignoradas. Novos objetos entram diretamente na pose confirmada.

Arraste e campos numéricos locais são imediatos. A pose aguardando confirmação fica protegida de ecos anteriores usando a revisão retornada pela API; falha permite retornar ao estado confirmado. A animação não publica poses ou reenvia modelos. A regra atual de última alteração recebida entre dois editores permanece. Não elimina latência de rede nem prevê movimentos ainda não recebidos.

O loop funciona apenas enquanto há movimento. Remoção, saída, troca de qualidade e desmontagem cancelam recursos associados; ocultar a página conclui a transição. **Movimento suave** começa respeitando `prefers-reduced-motion`; ligar/desligar explicitamente vale nesta sessão da Mesa 3D e não altera o sistema.

## Evidências e revisão

Três testes novos de qualidade: redução/restauração com loaders reais; política automática/manual e armazenamento pessoal; cancelamento/opções inválidas e preservação de morph targets. Três de movimento: poses intermediárias/finais; retomada/duplicatas/revisões; movimento reduzido/edição imediata/encerramento. Suíte: **107 testes aprovados**, build aprovado.

`npm run dev`, SQLite descartável, 1440/390 px: escolhas, teclado, reabertura, modo jogador, câmera/seleção e clientes com qualidades diferentes. Esfera: **3.968 → 1.984 triângulos**; terreno: **8.388.608 → 524.288 pixels**. Original restaurado. Arraste direto do eixo X confirmou 8 → 9,273.

Duas abas com SSE real, movendo X de −8 para 8: 25 capturas mostraram o centro dos pixels claros avançar por aproximadamente 456, 467, 484, 507, 534, 562, 589, 608 e 617 px antes de estabilizar. Com movimento reduzido sem override, o fluxo foi imediato. Evidência de poses renderizadas, sem promessa de FPS em outro aparelho.

| Antes | Depois |
| --- | --- |
| Pose recebida aplicada de uma vez | Transição retomável de 180 ms, terminando no destino exato |
| Nenhuma escolha de qualidade | Automática/Original/Leve e resultado da redução |
| Movimento sem controle pessoal | Preferência do aparelho como padrão e escolha explícita nesta sessão |
| Erro da importação coberto no celular | Erro junto dos arquivos, com foco acessível |

Revisão com `web-design-guidelines`: controles novos rotulados, foco visível, checkbox com alvo de 44 px, status/erro acessíveis, quebra de texto e contenção da rolagem. React não recebe atualizações por quadro; simplificador fica em chunk/worker separado.

Depois desta entrega foram concluídos [propriedade/liberação dos recursos](TABLETOP_RESOURCE_LIFECYCLE.md), [recuperação WebGL](WEBGL_RECOVERY.md), [grupos e bloqueios](TABLETOP_OBJECTS.md) e [carga espacial/LOD](TABLETOP_STREAMING.md). A redução de qualidade atualiza a propriedade também em cancelamentos. As transformações agora usam versões e lotes atômicos do item 48, com preservação do ajuste em conflito; a descrição anterior de última alteração recebida registra o comportamento da entrega inicial.
