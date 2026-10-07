# Recuperação da Mesa 3D — item 45

## Comportamento

Ao entrar na Mesa 3D, o navegador prepara a cena. Se não conseguir criar o renderer ou perder o contexto WebGL durante o uso, tenta reconstruí-lo **uma vez automaticamente por entrada nessa visualização**. Depois de consumir essa tentativa, outra falha mostra **Reabrir 3D**. O botão permite uma nova tentativa manual; não inicia um ciclo automático. Sair e entrar novamente na Mesa 3D renova a tentativa automática.

O aviso aparece dentro da área da cena. As ferramentas se recolhem ao perder o 3D, para não cobrir a recuperação em tela estreita. Câmera, importação e transformação ficam indisponíveis até o renderer estar pronto. Notas, mapa 2D, seleção na lista e preferências pessoais continuam acessíveis. Reabrir pelo botão devolve o foco à região navegável por teclado, sem deslocar a página.

## Estado e recursos

- A recuperação não grava, importa ou duplica objetos. Recria a apresentação a partir das propriedades atuais autorizadas recebidas da mesa, inclusive alterações SSE durante a falha.
- Câmera e alvo são preservados somente para a mesma mesa. Seleção, qualidade escolhida e movimento pertencem ao componente da mesa e continuam disponíveis.
- Somente alterações confirmadas têm garantia de persistência. Requisições de transformação já em andamento seguem sua confirmação normal; um contexto perdido não as reenvia. Um movimento ainda não confirmado não é descrito como salvo.
- A geração de cada tentativa invalida callbacks antigos. Desmontar encerra o controlador; eventos de uma cena encerrada não podem reabrir a tela ou repor estado antigo.
- Perder o contexto suspende o runtime e executa a limpeza do item 44: aborta cargas, libera modelos, controles, frames, observers e listeners. A limpeza é idempotente; não força uma segunda perda em um contexto já perdido.
- Cada reconstrução cria um canvas/renderer novo. O evento de restauração do canvas antigo não é usado para ressuscitar seus recursos. Downloads/decodificações necessários à nova apresentação podem acontecer novamente, seguindo o cache e os limites existentes.

Implementação: `TabletopScene.jsx`, `webglRecovery.js`, `TabletopMap.jsx` e `TabletopMap.css`. Não há biblioteca, endpoint, serviço externo ou mudança de persistência nova.

## Validação

Três testes novos em `tests/tabletop-webgl.test.js` verificam a política pública: falha inicial e tentativa manual; callbacks antigos/desmontagem; perda, recuperação e limite automático. A suíte completa passou com **113 testes** e o build de produção passou. O aviso de tamanho do pacote Three.js permanece.

`npm run dev`, SQLite descartável, larguras de 1440 e 390 px:

| Ensaio | Resultado observado |
| --- | --- |
| Perda nativa pelo `WEBGL_lose_context` | Extensão disponível e contexto realmente perdido; navegador registrou `THREE.WebGLRenderer: Context Lost.`. Novo canvas apareceu automaticamente, com dois objetos e posição preservada. |
| Nova perda depois da tentativa automática | Aviso com Reabrir 3D; controles de câmera e transformação desativados. Sem repetição automática. |
| Outra tela alterando a posição durante a falha | SSE atualizou X para 12 no inspetor indisponível. Reabertura manual exibiu o estado atual com dois objetos, sem duplicação. |
| Tentativa automática seguida de falha de criação | Falha de construtor injetada temporariamente; aviso manual apareceu. Instrumentação removida após o ensaio. |
| Falha persistente de criação inicial | Falha de construtor injetada enquanto o ambiente estava indisponível; após liberar a simulação, Reabrir 3D funcionou por Enter e devolveu foco à cena. Isto verifica o caminho de erro; não é um ensaio de hardware sem WebGL. |
| Modo jogador e saída durante indisponibilidade | Reabertura sem ferramentas de edição/importação; sair levou à lista de mesas, sem ressuscitar a cena anterior. |
| Celular | Botão com 46 px de altura, ponto central livre para toque e página sem overflow horizontal; aviso legível e notas/mapa 2D acessíveis. |

As provas de perda nativa e falha de construtor são distintas. Nenhuma alteração foi feita no banco real. Controles e atributos temporários de diagnóstico foram removidos da implementação final.

## Limites

Reabrir depende de o navegador conseguir disponibilizar WebGL; não corrige drivers nem amplia a memória da GPU. A cena pode voltar antes de todos os modelos terminarem de carregar, mantendo o estado de carregamento já existente. O original ainda é baixado/decodificado antes da redução local de qualidade. [Progresso e cancelamento da importação](MODEL_IMPORT_PROGRESS.md) foram concluídos no item 46; reabrir a cena não repete a publicação.

Decisão: [ADR 020](adr/020-recuperacao-da-mesa-3d.md). Referência da API nativa: [webglcontextlost](https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/webglcontextlost_event).
