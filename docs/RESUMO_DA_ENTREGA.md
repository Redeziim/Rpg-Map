# Resumo da entrega — 2026-10-04

Esta entrega local conclui a Mesa 3D (42–51), movimento remoto suave (67), modelos detalhados com tamanho proporcional e Leve relativo automático, estado único de combate (52), recuperação dos comandos sem confirmação (54) e condições/efeitos (55). O mestre pode reorganizar, dar/retirar/pular turnos e definir efeitos com duração em rodadas, próximo turno ou remoção manual. Item 53 em andamento: histórico público implementado e validado; privacidade das futuras rolagens do mestre depende da escolha já enviada.

## O que mudou

| Área | Entregas |
| --- | --- |
| Notas | Criação em branco, busca no caderno e na janela aberta, destaque de resultados, rascunhos em localStorage/IndexedDB, revisão de conflitos por campo, compartilhamento e histórico com restauração seletiva. Coleção de imagens com validação e deduplicação. |
| Mapa mental | Zoom e quadro expansível, janela fixa no canto inferior esquerdo com opção de soltar/redimensionar, vínculos com pontos 2D, conexões sem setas acompanhando o arraste, rótulos, tipos/etiquetas, seleção múltipla, alinhamento e distribuição. Controles agrupados em opções/detalhes. |
| Mapa 2D | Prévia de imagem, troca controlada, revisão de conflitos por campo nos pontos, permissões do modo jogador, cores livres para traços, camadas, névoa protegida no servidor, grade/régua/escala, posições e vínculos a cenas/notas. Rotas, legenda editável e exportação PNG da vista foram entregues e depois removidas em 2026-10-08 (ADR 036). |
| Dados e confiabilidade | Backup verificável, restauração em banco novo, migrações explícitas, backups automáticos com retenção/alertas, revisão de transações, retomada de sessão/conexão, preservação de rascunhos, transferência de imagens por cache/referências, registro de alterações da mesa, limpeza limitada de registros vencidos, diagnóstico de requisições sem conteúdo privado e CLI de integridade/ocupação SQLite. |
| Exportação da mesa | Arquivo JSON com estado permitido, fichas/status, notas/quadros, versões autorizadas, imagens incorporadas e pacotes completos da mesa 3D. Resumo de conteúdo/tamanho, cancelamento, prazo e download nativo. Notas privadas de terceiros e versões anteriores ao compartilhamento ficam fora; o modo jogador mantém pixels e geometria ocultos protegidos. Arquivos deixados após crash agora são removidos quando a propriedade e o fim do processo podem ser comprovados. |
| Mesa 3D | Validação de conteúdo antes de publicar, qualidade pessoal Automática/Original/Leve, malhas/texturas reduzidas sem alterar o original e movimentos remotos interpolados. File/Blob e transferência binária opcional, com JSON legado, backups e exportação preservados. Recursos compartilhados liberados após o último proprietário; cargas parciais e desmontagem limpas. WebGL tenta reabrir uma vez automaticamente, depois oferece Reabrir 3D; estado autorizado atual preservado sem repetir publicações. ADM em modo jogador usa somente exploração/câmera; edição/importação seguem permissões no servidor. |
| Organização do projeto | Skills de desenvolvimento, instruções em AGENTS.md, convenções de issues/documentação e decisões de arquitetura registradas. Framework e persistência canônica preservados. |
| Objetos 3D | Seleção múltipla, grupos com identidade estável e pose preservada, duplicação sem copiar pacotes e bloqueio de transformações no servidor. Versões/lotes atômicos, rascunho numérico preservado em conflito, confirmação de remoção e migração explícita do estado para 2. |
| Combate | Ordem, NPCs, exclusões, iniciativa opcional, rodada e ativo em uma fonte confirmada. Controles do mestre, migração JSON 5, versão para conflitos e acesso no servidor, transações/SSE e rascunhos de iniciativa preservados em conflito. |

A cena 3D aberta por um ponto 2D foi removida. A **Mesa 3D independente** permanece. A rolagem usa a bandeja; a documentação foi alinhada. Modelos de nova nota, visão geral/Enquadrar tudo e PDF permanecem fora da interface conforme as decisões do projeto.

## O que ainda falta

### Notas e mapa mental

- **2, validação restante:** aprofundar recuperação de rascunhos quando o navegador falha totalmente ou uma aba é duplicada. As cópias locais e o aviso/arquivo de emergência já existem.
- **16:** arquivamento, lixeira e recuperação de notas.
- **17:** exportação individual de notas/quadros. A cópia por mesa já inclui as notas permitidas.
- **18:** ajuda de atalhos dentro do quadro e acabamento das preferências pessoais de zoom.
- Refinamento amplo do mapa mental: adiado a pedido do projeto.

### Mapa 2D

- **23:** organização/filtros dos pontos por região, etiqueta, estado e tipo — adiado quando o foco mudou para buscar palavras nas notas.

### Mesa 3D

- Estabilidade de conteúdo, recursos e WebGL concluída nos itens 43–45. A recuperação tenta uma vez automaticamente e oferece Reabrir 3D, sem repetir publicações.
- Progresso real e cancelamento concluídos no **46**, com confirmação privada e proteção contra repetição após resposta perdida.
- Prévia local concluída no **47**: escala, giro e posição antes de adicionar; cancelamento conserva a mesa e os arquivos.
- **48 concluído:** seleção, grupos, duplicação e bloqueios, com proteção no servidor e revisão de conflitos. Contrato em [TABLETOP_OBJECTS.md](TABLETOP_OBJECTS.md).
- **49 concluído:** carga gradual, prioridade espacial, LOD por distância e qualidade pessoal. Contrato e custos separados em [TABLETOP_STREAMING.md](TABLETOP_STREAMING.md).
- **50 concluído:** vários vínculos a ponto/cena/nota, resolução autorizada atual, nome atualizado, abertura/retirada e exportação. Minhas notas em todas as abas, criação por jogadores e privacidade pessoal diante de mestre/ADM. Contrato em [TABLETOP_REFERENCES.md](TABLETOP_REFERENCES.md).
- **51 concluído:** mestre escolhe a luz para todos; cada pessoa controla e conserva sua câmera no navegador. Vistas prontas e restauração por teclado. Contrato em [TABLETOP_LIGHTING_AND_CAMERA.md](TABLETOP_LIGHTING_AND_CAMERA.md).
- Cena 3D por ponto: ideia guardada, só deve voltar após nova decisão do projeto.

### Combate e campanha

- **52 concluído:** estado único de combate e controles do mestre. Contrato em [COMBAT_STATE.md](COMBAT_STATE.md).
- **53 em andamento:** histórico público da bandeja implementado, com resultado/contexto, repetição protegida, retenção e backup; falta a escolha sobre rolagens privadas. Contrato em [DICE_HISTORY.md](DICE_HISTORY.md).
- **54 concluído:** recuperação após reconexão/reinício e resposta perdida, sem repetir avanço. Contrato em [COMBAT_RECOVERY.md](COMBAT_RECOVERY.md).
- **55 concluído:** condições/efeitos com duração por efeito (rodadas, próximo turno ou remoção manual), acesso e avisos textuais. Contrato em [COMBAT_EFFECTS.md](COMBAT_EFFECTS.md).
- **56 concluído conforme definição do usuário:** vídeos/animações que o mestre libera para exibição e permite ou bloqueia para rever depois. MP4/WebM/GIF salvos, controles compartilhados/pessoais e acesso validado no servidor. Contrato em [SCENE_MEDIA.md](SCENE_MEDIA.md).
- **57–59:** linha do tempo, regras opcionais por sistema e resumos/preparação de sessões.

### Visual e acessibilidade

- **60–62:** revisão geral de teclado, foco, contraste, leitores de tela, estados de erro/carregamento/offline e controles em telas estreitas.
- **63–66:** consolidar tokens e direção visual por tela, movimento reduzido em todo o site e desempenho de fontes/imagens/componentes pesados.

O detalhamento e as prioridades continuam em [PLANO_DE_MELHORIAS.md](../PLANO_DE_MELHORIAS.md).

O [prompt de continuidade](PROMPT_PROXIMAS_ETAPAS.md) detalha 15 itens ainda restantes (16–18, 23, 53 e 57–66), com skills e necessidade de API por etapa. A recuperação de rascunhos do item 2 foi concluída localmente e documentada em ADR 033. A autoria da linha do tempo 57 foi definida: só o mestre/ADM no modo mestre escreve; jogadores consultam registros liberados. O bloqueio do item 48 foi entregue conforme a escolha: impedir mover, girar e mudar tamanho até desbloquear. O item 50 usa vários vínculos e mantém notas pessoais privadas. O item 51 compartilha a luz e mantém a câmera pessoal. A redução relativa do Leve é automática, conforme as respostas do usuário.

## Limites da entrega

No combate, comandos sem confirmação bloqueiam novas ações até a consulta do resultado. Reenvio conserva identidade/versão e depende de clique explícito; não existe execução offline automática. Confirmações duram sete dias, e apagar dados do navegador remove a cópia local da intenção. Consulte [COMBAT_RECOVERY.md](COMBAT_RECOVERY.md).

Diretórios de exportação do formato antigo, sem marcador de dono, não são excluídos automaticamente. Um PID reutilizado ou uma pasta com conteúdo inesperado também pode exigir inspeção manual. O procedimento está em [MAINTENANCE.md](MAINTENANCE.md). O JSON exportado ainda não pode ser importado pela interface; consulte [ROOM_EXPORT.md](ROOM_EXPORT.md).

Os [eventos de diagnóstico](DIAGNOSTICS.md) são limitados a 60 por minuto; a rotação do log do processo é externa. A [ocupação do banco](DATABASE_DIAGNOSTICS.md) é uma estimativa de payload, separada dos bytes físicos de índices, páginas e WAL. A verificação completa de um banco grande pode demorar; use uma cópia consistente para uma análise pesada.

A [transferência binária de modelos](MODEL_TRANSFER.md) reduz cópias no transporte/loader; o pacote permanece JSON/base64 no SQLite. A [conferência de conteúdo](MODEL_VALIDATION.md) e a [liberação dos recursos](TABLETOP_RESOURCE_LIFECYCLE.md) estão concluídas. Parsers síncronos já executando terminam antes do descarte; os contadores de recursos não medem todo o heap ou a memória do driver. [Qualidade e movimento](TABLETOP_QUALITY_AND_MOTION.md) preservam os originais; a primeira leitura/download ainda usa o original. Em uma fixture de 18 MiB, o corpo passou de 25.165.984 para 18.874.554 bytes. Isso não é uma medição de todo o heap ou FPS.

## Validação

- Item 55: um teste HTTP integrado cobre duração em transições confirmadas, repetição, participante único, pausa/exclusão, acesso/validação/conflito, SSE/exportação, rollback, backup/restauração e migração 5→6 idempotente. Suíte 133/133. `npm run dev` aplicou uma mesa JSON, sem SQL novo; navegador 1440/390 px validou adicionar por Enter, encerramento/rodada, rascunho após mudança de outro mestre, revisão explícita, remoção/cancelamento e foco de 2 px. Modo jogador sem nome/origem/contagem de efeitos privados; controles 44 px, página 382 px, duração após recarga e console sem erros. Contrato COMBAT_EFFECTS.md, ADR 031 e `quality/55-*`.

- Item 54: confirmação por identidade e consulta do combate atual; um teste HTTP cobre perda de resposta, repetição/concorrência, reinício, mudança de acesso, rollback e backups SQL 5/6. Teste ampliado passou isoladamente após a suíte 132/132. Build final em 3,77 s. Navegador 1440/390 px: resposta descartada, recarga/reconexão/reinício, reenvio explícito, resposta antiga após SSE, Enter, botões de 44 px e nome digitado preservado durante salvamento. Aplicação normal (`npm run dev`) conferida após remover o proxy: rodada/ordem preservadas, ação nova confirmada, conteúdo 382 px e aba nova sem erros. Contrato COMBAT_RECOVERY.md, ADR 030 e `quality/54-*`.

- Os nove testes dos itens 39–41 cobrem manutenção de sessões/temporários, privacidade dos eventos, falha do destino de log, integridade/contagens, referência inválida, arquivo ilegível e WAL ativo. O item 42 acrescentou três testes de transferência/compatibilidade, acesso/cache/limites e loaders reais. O diretório de trabalho dos subprocessos de diagnóstico usa `fileURLToPath`, corrigindo a falha de caminho no Windows.
- Migração a partir do banco 2, backup antigo, exportação existente e rollback permanecem cobertos pelos testes relacionados.
- Suíte completa: **134 testes, sem falhas**. Build de produção passou, com o aviso já conhecido de tamanho do pacote Three.js.
- Diagnósticos dos itens 40–41: `/api/health` com `X-Request-ID`; CLI `--full --json` aprovou integridade, referências e esquema do banco descartável ativo.
- Item 42: `npm run dev` com SQLite descartável, desktop de 1440 px e celular de 390 px. Importados OBJ com MTL/textura, GLTF com BIN/textura, GLB com textura incorporada, FBX, imagem como terreno e pacote de 18 MiB. Conferidos erro de material ausente, teclado, reabertura depois de reiniciar, saída/retorno da cena, ausência de controles de edição no modo jogador e ausência de overflow horizontal na tela estreita.
- Item 43: três testes novos, cinco formatos reais importados, pacotes antigos carregados, seleção preservada ao recusar e erro acessível em 390 px.
- Qualidade e movimento: três testes novos por feature, desktop/390 px, teclado, preferências, modo jogador, duas abas SSE e poses intermediárias capturadas. Esfera de 3.968 para 1.984 triângulos, textura de 8.388.608 para 524.288 pixels; Original restaurado e arraste direto confirmado.
- Item 44: três testes novos; ciclos repetidos no navegador, troca de qualidade/mesa, saída com carga pendente e compartilhamento real de recursos. Mesmas contagens ao reabrir, recursos do renderer encerrado liberados e clone restante visível. Instrumentação e página temporária removidas; evidências em `TABLETOP_RESOURCE_LIFECYCLE.md`.
- Item 45: três testes novos; perda WebGL nativa, falha inicial de construtor injetada, limite automático, SSE durante indisponibilidade, recuperação manual pelo teclado, modo jogador e saída. Validado em 1440/390 px; foco devolvido à cena e botão de 46 px sem obstrução. Instrumentação temporária removida; evidências em `WEBGL_RECOVERY.md`.
- Item 46: três testes novos; confirmação privada, cancelamento antes/durante envio e validação, resposta perdida após gravação, reinício, backup/restauração e repetição sem duplicar ou ressuscitar objetos. Migração do banco 3 para 4 ensaiada no banco descartável. Navegador em 1440/390 px: percentual medido de pacote de 18 MiB, teclado, foco, cancelamento, confirmação anterior ao cancelamento, falha de rede/recarga/Verificar resultado, arquivos ausentes, modo jogador e envio normal. Simulação temporária retirada; contrato e limites em `MODEL_IMPORT_PROGRESS.md`, decisão 021.
- Item 47: três testes novos; pose publicada equivalente à prévia e original intacto, cancelamento/cargas/recursos sem publicação, acesso/valores inválidos, exportação e reinício. Navegador em 1440/390 px: arraste, números, restauração, Original/Leve, segunda aba, cancelamento e publicação única, arquivo ausente, modo jogador, teclado, toque e perdas WebGL. Correção da validação da pose na interface e instrumento temporário retirado; evidências em `MODEL_PREVIEW.md`, decisão 022.
- Item 48: três testes novos; grupos/transformações/duplicação, acesso/bloqueios/conflitos e backup antigo/migração/reinício/última referência ao pacote. Navegador em 1440/390 px: seleção por marcação e Enter, grupos, arraste real, tamanho 0,5, desagrupamento sem perda, duplicação, bloqueio sincronizado em duas abas, modo jogador, Original/Leve, confirmação/cancelamento de remoção e foco. Conflito real preservou X=21 enquanto outra aba salvou X=22; reaplicação exigiu escolha explícita. Estado da mesa migra de 1 para 2; nenhuma dependência ou API externa nova. Evidências em `TABLETOP_OBJECTS.md`, decisão 023.
- Item 49 restante: três testes com HTTP real, fila/cancelamento/reserva da prévia, falha/retomada e LOD/seleção/original/descarte. Navegador em 1440/390 px: 3/12 modelos inicialmente, detalhes 5.952 → 1.488 à distância, seleção/foco distante, teclado, Original/Leve, prévia privada, grupo bloqueado e desmontagem/reabertura. Página 382 px em tela de 390 px, console sem erros. Custos de download, CPU/preparação, geometria e desenho registrados separadamente em `TABLETOP_STREAMING.md`, decisão 024. Sem dependência, migração ou API externa nova.
- Item 50: um teste HTTP integrado conforme pedido de validação rápida; criação por jogador, privacidade, vários vínculos, duplicatas/conflito, compartilhamento/revogação, SSE, ADM em modo jogador, névoa, ligação oculta preservada ao salvar texto, arquivamento, duplicação, remoção/reinício/exportação. Estado 2→3 conferido na mesa descartável. Navegador 1440/390 px: três tipos abertos, nome atualizado, seleção ao retornar, retirada sem apagar destino, teclado e nota criada no mapa/reaberta após recarga. Documento 382 px, nota 374 px, botões 44 px e console final sem erros. Sem nova API externa/dependência; decisão 025.
- Item 51: um teste HTTP integrado cobre presets, permissões/modo jogador, dados inválidos, conflito, SSE, exportação, restauração, reinício e migração 3→4 idempotente. Navegador 1440/390 px: vistas/restauração por teclado, câmera após recarga, luz compartilhada sem mover a câmera da outra aba e modo jogador sem seletor de luz. Documento 382 px, botões 44 px e console das duas abas sem erros. Sem nova API externa/dependência; decisão 026.
- Ajuste de modelos: um teste HTTP integrado e um teste pelo carregador público. Mais faces quadradas/triângulos, tamanho proporcional com pose/arquivo preservados e redução maior em modelos densos. Navegador 1440/390 px: OBJ com 352.800 triângulos/1.058.400 vértices expandidos aceito; aproximadamente 60 mil no Leve, 83% menos triângulos e 75% menos pixels de textura. Prévia numérica/arraste preservaram proporção; metade/dobro por botão/teclado salvos. Falha do envio de tamanho isolado corrigida e fluxo repetido; aba nova final sem erros, página 382 px e botão 44 px. Contrato em [MODEL_DETAIL_AND_SCALE.md](MODEL_DETAIL_AND_SCALE.md), decisão 027. Sem nova API externa/dependência/endpoint/migração.

- Item 52: combate único/versionado, controles do mestre para mover/dar/retirar/pular, iniciativa opcional e rodada. Migração 4→5, ações concorrentes 200/409, SSE, mudanças de participantes, reinício/exportação/audit/backup/restauração e rollback integral. Navegador 1440/390 px: conflito preservou 19 diante do atual 8, revisão confirmou 19; Enter salvou 15, ordenação conservou ativo/rodada, modo jogador sem ações, foco 2 px e controles ≥44 px. Reabertura conservou rodada/NPC/iniciativas; console sem erros. Contrato COMBAT_STATE.md e ADR 028. Suíte 130/130; sem API externa ou dependência.

- Item 56: definição alterada pelo usuário para apresentação de vídeo/animação, leitura posterior sob controle do mestre, upload real, pausa em duas telas e vídeo/GIF conferidos em 1440/390 px. SQL/JSON 007 e mídia nos backups/exportações autorizadas. Um teste HTTP integrado, sem API externa/dependência nova na aplicação. Contrato SCENE_MEDIA.md, ADR 032 e quality/56-*.
