# RPG Map Explorer

Aplicação web para condução e acompanhamento de campanhas de RPG. Reúne mapa interativo, pontos de interesse, ficha configurável, barras de status do grupo e rolagem de dados em uma interface única.

## Resumo e próximos passos

As entregas e pendências estão em [docs/RESUMO_DA_ENTREGA.md](docs/RESUMO_DA_ENTREGA.md). A Mesa 3D possui [transferência binária](docs/MODEL_TRANSFER.md), [conferência de conteúdo](docs/MODEL_VALIDATION.md), [qualidade Automática/Original/Leve e movimento suave](docs/TABLETOP_QUALITY_AND_MOTION.md), [liberação dos recursos](docs/TABLETOP_RESOURCE_LIFECYCLE.md), [recuperação de WebGL](docs/WEBGL_RECOVERY.md), [progresso/cancelamento com confirmação da importação](docs/MODEL_IMPORT_PROGRESS.md), [prévia local antes de adicionar](docs/MODEL_PREVIEW.md), [seleção, grupos, duplicação e bloqueios](docs/TABLETOP_OBJECTS.md), [carga gradual com detalhe por distância](docs/TABLETOP_STREAMING.md), [vínculos com pontos, cenas e notas](docs/TABLETOP_REFERENCES.md) e [iluminação compartilhada com câmera pessoal](docs/TABLETOP_LIGHTING_AND_CAMERA.md). [Modelos detalhados, tamanho proporcional e Leve relativo automático](docs/MODEL_DETAIL_AND_SCALE.md) também estão entregues. O [combate confirmado](docs/COMBAT_STATE.md) reúne ordem, rodada, iniciativa e controles do mestre (52). O [histórico público da bandeja](docs/DICE_HISTORY.md) está implementado; o item 53 aguarda a escolha sobre rolagens privadas do mestre. O [prompt de continuidade](docs/PROMPT_PROXIMAS_ETAPAS.md) detalha pendências, skills e APIs.

Em **Cenas**, mestre/ADM pode enviar MP4, WebM ou GIF, salvar a cena e usar **Liberar e tocar para todos**. A apresentação abre para participantes conectados; o mestre pausa, continua, recomeça ou encerra. **Permitir assistir depois** libera a cena para reprodução individual; **Bloquear visualização posterior** retira essa disponibilidade. Volume e tela cheia são pessoais. Limites, autoplay e formatos em [Cenas de vídeo](docs/SCENE_MEDIA.md).

## Requisitos

- Node.js 24 ou superior
- npm

## Rodar localmente

Na raiz do repositório, instale as dependências e inicie o site e a API com um único comando:

```bash
npm ci
npm run dev
```

Abra `http://localhost:5173/` no navegador. O Vite encaminha as chamadas `/api` ao servidor Node.js em `http://127.0.0.1:3001/`; não é preciso iniciar a API separadamente. No primeiro acesso, crie uma conta e depois uma mesa. Não há usuário ou senha padrão.

O banco SQLite é criado em `data/grimorio.sqlite`. Essa pasta e os arquivos `.env` ficam fora do Git. Use `Ctrl+C` no terminal para parar os dois servidores. Se uma das portas já estiver ocupada, encerre a instância anterior antes de executar o comando novamente.

Para instruções de convites, papéis e publicação, consulte [ONLINE.md](ONLINE.md).

## Backup e restauração

`npm run backup` cria uma cópia SQLite consistente e um manifesto com versão, esquema e SHA-256. Guarde os dois arquivos. `npm run restore -- --verify backup.sqlite` confere uma cópia; `npm run restore -- backup.sqlite banco-novo.sqlite` restaura em um caminho novo, com relatório e recusa de sobrescrita. O comando não muda `DB_PATH`. O [procedimento completo](docs/RESTORE.md) inclui backups antigos, teste isolado e troca do banco em uso.

Ao iniciar, o servidor aplica [migrações numeradas de banco e mesas](docs/MIGRATIONS.md) numa transação, antes de abrir a API. Textos antigos são preservados em notas e os padrões de estado ficam gravados no SQLite. Faça backup e ensaie numa cópia antes de atualizar o projeto; formatos incompatíveis interrompem a abertura, sem migração parcial.

A [manutenção local](docs/MAINTENANCE.md) remove sessões e convites vencidos em lotes e recupera exportações temporárias deixadas por processos encerrados, preservando pastas cujo dono não possa ser verificado. Para escolher uma pasta privada para esses arquivos, defina `EXPORT_TMP_DIR` com um caminho absoluto. O [diagnóstico de requisições](docs/DIAGNOSTICS.md) usa `X-Request-ID` e eventos controlados sem conteúdo privado.

`npm run db:diagnose -- --full --json` verifica [integridade e ocupação do SQLite](docs/DATABASE_DIAGNOSTICS.md) em modo somente leitura. O comando informa tamanhos físicos e estimativas por mesa sem imprimir o conteúdo salvo.

ADM em modo mestre e mestres consultam **Mesa → Registro da mesa** para conferir data, autor e tipo de mudanças confirmadas. O [registro de alterações](docs/ROOM_AUDIT.md) tem filtro e páginas, preserva até 1.000 entradas por mesa e não copia conteúdo de notas, imagens ou códigos de convite.

Defina `BACKUP_DIR` com uma pasta absoluta privada para [ativar backups automáticos](docs/AUTOMATIC_BACKUPS.md). Por padrão, o servidor cria uma cópia a cada 24 horas, mantém 14 pares verificados e tenta novamente após falha. O trabalho roda em processo separado; backups manuais são preservados. `npm run backup:auto -- --status` informa a saúde e retorna código 1 em falha/atraso; alertas aparecem nos logs do serviço.

## Validação

```bash
npm run build
npm test
```

O resultado de produção é gerado em `dist/` e não deve ser versionado.

## Recuperação de combate

Em **Condições e efeitos**, o mestre escolhe o alvo, quem vê e a duração: rodadas, até receber o próximo turno ou remoção manual. Efeitos automáticos terminados ficam **Encerrados** até serem removidos; avisos aparecem no turno. A contagem usa as transições confirmadas e não repete ao reconectar. Consulte [COMBAT_EFFECTS.md](docs/COMBAT_EFFECTS.md).

Se um comando perder a resposta, **Verificar resultado** confere o estado antes de liberar outra ação. Reabrir a mesa ou reconectar não avança o turno novamente. **Reenviar a mesma ação** só aparece quando a consulta não encontra confirmação e conserva a intenção original. Nomes e iniciativas digitados permanecem diante de falhas. Contrato, prazos e compatibilidade em [COMBAT_RECOVERY.md](docs/COMBAT_RECOVERY.md).

## Estrutura

- `src/components/RPGMapExplorer.jsx`: estado principal, mapa e navegação.
- `src/components/CharacterSheet.jsx`: ficha de personagem e campos configuráveis.
- `src/components/StatusBars.jsx`: identidade do jogador e barras individuais.
- `src/components/GroupStatus.jsx`: visão consolidada do grupo.
- `src/components/DiceRoller.jsx`: composição e histórico das rolagens.
- `src/components/Dice3D.jsx`: geometria e animação tridimensional dos dados.
- `src/components/tabletop/TabletopMap.jsx`: mesa 3D independente do mapa de pontos 2D.
- `src/components/sheetHelpers.jsx`: tipos, abas e avaliação de fórmulas da ficha.

## Persistência

No **Mapa 2D e pontos**, selecionar uma imagem abre **Confira a imagem** antes de qualquer envio à mesa. Escolha **Mais leve · até 2048 px** ou **Mais detalhe · até 4096 px**, confira dimensões e tamanho do arquivo e use **Ver em tamanho real** para inspecionar textos pequenos. O navegador prepara uma imagem fixa em WebP; GIF e WebP animados usam uma imagem fixa. O arquivo escolhido aceita PNG, JPEG, WebP ou GIF de até 20 MB, 16.000 px por lado e 32 milhões de pixels. A versão publicada tem até 5 MB e 8 milhões de pixels, sem ampliar a imagem original.

No primeiro envio, use **Publicar imagem**. Em **Ferramentas 2D → Trocar imagem**, a prévia informa quais dados serão removidos e exige marcar **Conferi a prévia e quero trocar a imagem**. A troca apaga traços, desativa e limpa a névoa e remove escala, medida local e posições dos jogadores. Os pontos mantêm nomes, vínculos e coordenadas; **Reposicionar os pontos proporcionalmente à nova imagem** ajusta suas coordenadas quando o tamanho muda. Os círculos da prévia mostram o resultado. Cancelar mantém o mapa atual. Se outra tela mudar a imagem, ou os pontos escolhidos para reposicionar, a publicação exige revisão da troca.

Mapas antigos dentro dos limites de abertura mantêm suas dimensões lógicas para pontos, traços, névoa e régua, enquanto a imagem desenhada usa até 8 milhões de pixels. Imagens que excedem os limites apresentam uma mensagem para reduzir e substituir o arquivo. Consulte [a decisão sobre imagens](docs/adr/003-imagens-do-mapa.md).

Ao editar um ponto, o salvamento usa a versão que você abriu. Se o ponto mudar em outra tela, seu rascunho permanece na janela e **Revisar alterações** permite escolher por nome, descrição e tipo. Campos que você não editou usam a versão da mesa. **Aplicar escolhas** atualiza somente o rascunho; confira e clique em **Salvar alterações**. Alterações em outros pontos não interrompem essa edição. Se o ponto for excluído, a janela mantém o texto para copiar e bloqueia o salvamento; ela não recria o ponto.

No mapa 2D, jogadores desenham e apagam somente seus próprios traços e consultam os pontos. Mestres e o ADM em **modo mestre** também alteram a imagem, criam, editam e excluem pontos e apagam ou restauram traços de outras pessoas. O ADM em **modo jogador** usa os mesmos controles de um jogador, inclusive no desfazer e refazer. A lista de traços mostra ações apenas para os traços permitidos. Excluir um ponto pede confirmação.

Para escolher a cor, use **Desenhar → Cor**: clique ou arraste no círculo, ajuste entre **Escuro** e **Claro**, escolha uma cor rápida ou digite o código `#RRGGBB`. No círculo, as setas laterais mudam a cor e as verticais ajustam a intensidade; Shift amplia o ajuste. **Pronto**, Escape ou um clique fora fecha a paleta. Cada traço guarda sua cor na mesa, incluindo ao desfazer e refazer.

Em **Ferramentas 2D → Mostrar traços**, **Meus traços** e **Traços dos outros** escondem ou mostram grupos somente na sua tela. A escolha fica guardada por pessoa e mesa no navegador. No modo mestre, **Traço para** escolhe entre **Todos** e **Só mestres**; a lista **Traços do mapa** também permite alterar a visibilidade de um traço existente, com desfazer/refazer. Traços privados não são enviados a jogadores pela API ou pela sincronização. ADM no modo jogador também não os vê. A borracha atua somente nos traços visíveis que você pode apagar.

Em **Ferramentas 2D → Névoa de guerra → Ativar névoa**, o mestre passa a escolher quais trechos do mapa aparecem para jogadores. Use **Revelar área** ou **Cobrir área** e arraste um retângulo, ou clique/toque em dois cantos. Pelo teclado, foque o mapa: Enter inicia, setas ajustam o tamanho, Alt+setas movem a área, Enter salva e Escape cancela; Shift usa passos menores. O mestre vê uma cobertura translúcida para se orientar. As áreas são compartilhadas pela mesa e sobrevivem ao reinício do servidor.

Jogadores recebem uma imagem processada com os pixels ocultos cobertos, somente os pontos revelados e somente os traços cujo caminho inteiro está revelado. Não podem desenhar em áreas ocultas. **Mostrar mapa inteiro** desativa a névoa; ativá-la novamente recupera as áreas guardadas. Cobrir uma área não apaga conteúdo que alguém já viu. A proteção da imagem usa Sharp no servidor, sem enviar mapas para serviços externos, com limite de 32 milhões de pixels para ativação da névoa. GIF usa o primeiro quadro na imagem protegida. Veja [a decisão de implementação](docs/adr/001-nevoa-de-guerra.md).

Em **Ferramentas 2D → Grade e régua**, **Mostrar grade** muda somente sua tela e guarda a preferência por pessoa e mesa no navegador. O mestre define a unidade, o tamanho do quadrado em pixels, a distância por quadrado e o alinhamento à imagem. **Calibrar pelo trecho medido** calcula a escala a partir de uma distância conhecida; confira e use **Salvar escala na mesa** para publicar. Se outra pessoa mudar a escala durante a edição, seus ajustes ficam preservados para revisão.

Use **Medir** e arraste ou toque em dois pontos. Pelo teclado, foque o mapa: Enter inicia, setas movem o destino, Alt+setas movem o trecho, Enter fixa e Escape limpa; Shift usa passos menores. A régua mede em linha reta e fica só na sua tela. Sem escala definida, mostra pixels. Jogadores fixam medidas entre pontos revelados. A medida acompanha zoom e deslocamento; em zoom distante, a grade agrupa quadrados e informa a distância de cada quadrado mostrado. A régua não aplica regras de movimento ou combate.

Em **Ferramentas 2D → Posições dos jogadores**, o mestre pode **Liberar posições para a mesa**. A função começa desativada e não posiciona ninguém automaticamente. Cada jogador, inclusive ADM no modo jogador, usa **Minha posição**, escolhe no mapa e confirma **Compartilhar posição**. A escolha é uma prévia local; o painel fecha para liberar a área do mapa e a confirmação aparece junto dele. Pelo teclado, Enter inicia, setas movem, Enter compartilha e Escape cancela; Shift usa passos menores. Isso indica uma posição fictícia na imagem, sem usar a localização do dispositivo.

Cada pessoa pode mover e remover somente seu marcador. A névoa esconde coordenadas e marcadores de áreas ocultas para jogadores; ainda é possível remover sua posição se a área tiver sido coberta. A API bloqueia posições fora da imagem ou de áreas reveladas. Uma alteração pela mesma pessoa em outra tela exige revisão, mantendo a prévia. Posições salvas sobrevivem ao reinício e continuam visíveis após a pessoa sair; não são um indicador de presença online. Desativar pede confirmação e limpa os marcadores; liberar novamente exige novas escolhas. Trocar a imagem, remover um participante ou promovê-lo a mestre também remove seu marcador.

Rotas de exploração, legenda editável e exportação da vista do mapa foram removidas da interface em 2026-10-08, por serem pouco usadas. Os cinco tipos de ponto têm nome e cor fixos. Consulte [a decisão](docs/adr/036-remocao-de-rotas-legenda-e-exportacao-de-vista.md). Antes de atualizar uma instalação que usava rotas ou legenda editada, faça `npm run backup`: o primeiro salvamento de cada mesa apaga esses dados antigos, e uma versão anterior do aplicativo só abre a mesa a partir de um backup feito antes da atualização.

Os pontos mostram quantas **notas e cenas** você pode abrir, tanto na imagem quanto na lista das ferramentas. Uma nota conta uma vez por ponto, mesmo que vários cartões estejam ligados ao mesmo local. Abra o ponto para consultar esses vínculos; conteúdo privado e cenas arquivadas ficam fora dos indicadores.

Na aba **Cenas**, mestre e ADM no modo mestre criam fichas de texto com título, descrição e até 30 pontos vinculados. **Criar cena neste ponto**, nos detalhes do mapa, já seleciona o local. Uma cena começa em **Só mestres**; escolha **Compartilhada com a mesa** e **Salvar cena** para permitir a leitura pelos jogadores. Com pontos vinculados, ela aparece quando pelo menos um deles está revelado; sem pontos, aparece para toda a mesa. Se os pontos forem removidos, os vínculos ficam marcados como indisponíveis para o mestre revisar. Há um limite de 100 cenas por mesa.

Se outra tela alterar a cena, **Revisar cena** permite escolher título, texto, pontos e visibilidade antes do salvamento explícito. Ao fechar uma edição, **Fechar e manter rascunho** guarda a cópia no navegador para retomar na mesma aba; **Descartar rascunho e fechar** remove essa cópia. Rascunhos usam `localStorage` e IndexedDB e oferecem **Baixar cópia** em JSON. **Arquivar cena** retira a cena da leitura dos jogadores e dos pontos; o mestre pode restaurá-la pelo aviso ou pela lista **Arquivadas**. As cenas salvas ficam no SQLite e são sincronizadas com a mesa.

O servidor Node.js armazena contas e mesas em SQLite. Salas online têm permissões de jogador, mestre e ADM e eventos em tempo real, incluindo a bandeja 3D de dados compartilhada.

As janelas de notas guardam rascunhos automaticamente no navegador em `localStorage` e IndexedDB, inclusive texto, imagens e mapa mental. Ao voltar à mesa na mesma aba, os rascunhos são reabertos; para publicar mudanças na mesa, clique em **Salvar**. Se os dois armazenamentos locais falharem, a nota oferece **Baixar cópia** em JSON. O arquivo contém o conteúdo da nota e deve ser guardado como informação privada.

Abra **Minhas notas → Nova nota** em qualquer aba para criar uma nota em branco, inclusive como jogador. Dê um nome, escreva o texto ou monte o mapa mental e clique em **Salvar** para guardar na mesa. Suas notas pessoais são privadas também para mestre/ADM; **Compartilhar** libera acesso apenas às pessoas escolhidas. **Notas do mestre** é o caderno da campanha gerenciado por mestres/ADM.

Em **Mapa → Mesa 3D → Ferramentas**, marque um objeto e use **Vínculos** para relacioná-lo a vários pontos, cenas ou notas salvas. O nome abre o conteúdo atual; **Retirar** remove somente a relação. Vincular uma nota não muda seu compartilhamento. Jogadores abrem apenas destinos permitidos. Consulte [uso e permissões](docs/TABLETOP_REFERENCES.md).

Em **Iluminação e câmera**, o mestre escolhe a luz para todos. Cada pessoa escolhe sua vista e conserva a câmera no próprio navegador. **Restaurar câmera** enquadra a mesa inteira. Para mudar o tamanho de um objeto, use **Multiplicar tamanho → Aplicar tamanho**; na prévia, use **Tamanho proporcional**. 2 dobra e 0,5 reduz à metade mantendo as proporções, inclusive ao arrastar os eixos. O limite de geometria foi ampliado para 2 milhões de triângulos/6 milhões de vértices desenhados. **Leve** reduz automaticamente em relação ao original e mostra a porcentagem real; **Original** conserva os detalhes enviados. Consulte [iluminação/câmera](docs/TABLETOP_LIGHTING_AND_CAMERA.md) e [detalhe/tamanho/qualidade](docs/MODEL_DETAIL_AND_SCALE.md).

Cada caderno permite buscar títulos, texto e ideias do mapa mental. A busca mostra apenas as notas visíveis naquele caderno.

Dentro de uma nota aberta, clique em **Buscar** ou use **Ctrl+F** (⌘+F no Mac). Digite uma palavra ou trecho: as ocorrências são destacadas, sem distinguir acentos ou maiúsculas. Use os botões **Resultado anterior** e **Próximo resultado**, ou Enter e Shift+Enter, para percorrê-las. Escape fecha a busca. Na visualização **Texto**, a busca percorre somente as anotações; em **Mapa mental**, percorre textos dos cartões, legendas de imagens e rótulos das conexões, levando o quadro até o resultado. Ao navegar, filtros de cartões são removidos para revelar a ocorrência. Buscar não altera o conteúdo nem cria uma versão da nota.

No quadro, use **Novo cartão**, escreva e arraste para organizar. Arraste o círculo lateral até outro cartão para ligar as ideias, ou escolha **Conectar a outro cartão** na barra que aparece junto do cartão selecionado e clique no destino. As conexões são curvas com uma ponta de seta no cartão de destino (como no Obsidian) e acompanham o movimento dos cartões; clique numa conexão para dar um rótulo ou removê-la. O tipo do cartão (pessoa, local, cena ou pista) é escolhido pelas bolinhas coloridas dessa barra, e **Detalhes do cartão** (o ícone de ajustes na mesma barra) reúne até 8 etiquetas e o vínculo com ponto 2D. **Mais** (os três pontos junto do zoom) contém a coleção de imagens, os filtros, a lista de conexões e os atalhos. O quadro cresce sozinho, até 3840 × 2480, quando um cartão chega perto da borda. Shift+clique (ou Shift+Enter) seleciona vários cartões para alinhar ou distribuir posições, com Ctrl+Z para desfazer. Os controles de zoom vão de 5% a 200% (Ctrl + roda do mouse também aproxima e afasta); arraste o fundo ou use as barras para percorrer o quadro.

Ao abrir **Mapa mental**, a janela abre solta e grande, como uma nota qualquer. Use **Fixar** para encaixá-la no canto inferior esquerdo e **Soltar** para liberá-la de novo. **Aumentar janela** ocupa o espaço disponível; **Restaurar tamanho** retorna ao tamanho escolhido. O controle no canto permite ajustar largura e altura por arraste ou pelas setas do teclado. Posição, tamanho e visualização da janela são guardados no navegador junto ao caderno.

**Imagem** coloca PNG, JPEG ou WebP de até 2 MB no quadro e tenta guardá-la na coleção da mesa. **Coleção de imagens**, em **Mais**, permite usar a mesma referência em outras notas sem copiar o arquivo novamente. Se a conexão falhar, a imagem permanece no rascunho; uma imagem antiga pode entrar na coleção pelo botão **Guardar esta imagem na coleção**. A coleção só mostra arquivos enviados por você ou presentes em notas que você pode abrir. Salve a nota para publicar os novos cartões e vínculos.

**Histórico de versões** compara o rascunho com uma versão salva, incluindo a miniatura do quadro. Selecione nome, texto ou mapa mental para restaurar somente esses campos, revise e clique em **Salvar** para criar uma nova versão. **Desfazer restauração** recupera o rascunho anterior enquanto você não fizer outras edições. O compartilhamento atual é preservado. São retidas até 30 versões e 20 MB por nota; versões anteriores à ativação do histórico não podem ser recuperadas. Participantes compartilhados só veem versões em que já tinham acesso e precisam continuar autorizados na nota atual.

Consulte [ONLINE.md](ONLINE.md) para publicar com Docker, configurar armazenamento persistente e convidar jogadores. Banco local, sessões, dependências e arquivos de ambiente não são versionados.

## Orientação para agentes

Leia `AGENTS.md` antes de alterar o projeto. As skills locais ficam em `.agents/skills/` e orientam design, acessibilidade, animação, desempenho em React, diagnóstico de bugs, testes de comportamentos importantes e revisão de alterações. `setup-matt-pocock-skills` configura onde guardar tarefas e documentação.


### Exportação portátil

A aba **Participantes** permite preparar uma cópia JSON com o conteúdo autorizado, histórico de notas, imagens e arquivos 3D incorporados. A exportação respeita notas privadas, compartilhamento histórico e névoa no modo jogador. O formato ainda não tem importação na interface. Veja [docs/ROOM_EXPORT.md](docs/ROOM_EXPORT.md).
