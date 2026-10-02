# RPG Map Explorer

Aplicação web para condução e acompanhamento de campanhas de RPG. Reúne mapa interativo, pontos de interesse, ficha configurável, barras de status do grupo e rolagem de dados em uma interface única.

## Resumo e próximos passos

As entregas concluídas e as features que ainda faltam estão em [docs/RESUMO_DA_ENTREGA.md](docs/RESUMO_DA_ENTREGA.md). A última feature concluída é a exportação portátil da mesa; a próxima é a limpeza e os limites de sessões, convites e temporários.

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

ADM em modo mestre e mestres consultam **Mesa → Registro da mesa** para conferir data, autor e tipo de mudanças confirmadas. O [registro de alterações](docs/ROOM_AUDIT.md) tem filtro e páginas, preserva até 1.000 entradas por mesa e não copia conteúdo de notas, imagens ou códigos de convite.

Defina `BACKUP_DIR` com uma pasta absoluta privada para [ativar backups automáticos](docs/AUTOMATIC_BACKUPS.md). Por padrão, o servidor cria uma cópia a cada 24 horas, mantém 14 pares verificados e tenta novamente após falha. O trabalho roda em processo separado; backups manuais são preservados. `npm run backup:auto -- --status` informa a saúde e retorna código 1 em falha/atraso; alertas aparecem nos logs do serviço.

## Validação

```bash
npm run build
npm test
```

O resultado de produção é gerado em `dist/` e não deve ser versionado.

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

No primeiro envio, use **Publicar imagem**. Em **Ferramentas 2D → Trocar imagem**, a prévia informa quais dados serão removidos e exige marcar **Conferi a prévia e quero trocar a imagem**. A troca apaga traços e rotas (incluindo arquivadas), desativa e limpa a névoa, remove escala, medida local e posições dos jogadores. A legenda é mantida. Os pontos mantêm nomes, vínculos e coordenadas; **Reposicionar os pontos proporcionalmente à nova imagem** ajusta suas coordenadas quando o tamanho muda. Os círculos da prévia mostram o resultado. Cancelar mantém o mapa atual. Se outra tela mudar a imagem, ou os pontos escolhidos para reposicionar, a publicação exige revisão da troca.

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

Em **Ferramentas 2D → Rotas de exploração**, mestre e ADM no modo mestre usam **Nova rota**, dão nome e cor e escolhem entre **Planejada** (tracejada) e **Percorrida** (contínua). **Escolher paradas no mapa** fecha o painel: clique/toque para marcar cada parada, ou use Enter para marcar, setas para mover o cursor e Shift para passos menores. Escape ou **Voltar aos detalhes da rota** volta à edição. **Remover última parada** corrige o caminho; **Salvar rota na mesa** publica de 2 a 100 paradas, somando a distância dos trechos na escala atual ou em pixels.

A rota começa em **Só mestres**. **Compartilhada com a mesa** permite leitura aos jogadores quando todo o caminho estiver revelado. Mudanças concorrentes preservam os ajustes e exigem revisão; mudar a imagem exige desenhar o caminho novamente. **Baixar cópia do rascunho da rota** guarda os dados em JSON; a edição também avisa antes de fechar/recarregar a página. **Arquivar** retira a rota do mapa e da visão dos jogadores; **Ver rotas arquivadas → Restaurar** recupera o caminho. O limite é de 100 rotas por mapa, incluindo arquivadas. **Mostrar rotas nesta visão** muda somente sua tela.

Em **Legenda do mapa → Editar nomes e cores**, o mestre ajusta os cinco tipos de ponto e usa **Salvar legenda na mesa**. A mudança aparece nos pontos, na criação/edição de pontos e na legenda, preservando os vínculos existentes. Uma edição concorrente exige revisão. **Mostrar legenda nesta visão** é uma preferência pessoal, assim como mostrar rotas; ambas ficam guardadas por conta e mesa no navegador.

**Exportar vista → Preparar PNG da vista** captura o mapa com zoom, deslocamento e camadas visíveis. Confira a prévia e use **Baixar PNG**. Entram imagem, pontos, rotas salvas, traços, grade, medida local, posições compartilhadas e legenda exibida. Painéis, notas e prévias de edição ficam fora do PNG. O modo jogador mantém a névoa e esconde rotas/traços privados, inclusive para ADM; a visão de mestre inclui o conteúdo privado visível. O arquivo é gerado localmente, com até 4096 px por lado e 8 milhões de pixels. Consulte [a decisão de exploração e exportação](docs/adr/004-exploracao-e-exportacao.md).

Os pontos mostram quantas **notas e cenas** você pode abrir, tanto na imagem quanto na lista das ferramentas. Uma nota conta uma vez por ponto, mesmo que vários cartões estejam ligados ao mesmo local. Abra o ponto para consultar esses vínculos; conteúdo privado e cenas arquivadas ficam fora dos indicadores.

Na aba **Cenas**, mestre e ADM no modo mestre criam fichas de texto com título, descrição e até 30 pontos vinculados. **Criar cena neste ponto**, nos detalhes do mapa, já seleciona o local. Uma cena começa em **Só mestres**; escolha **Compartilhada com a mesa** e **Salvar cena** para permitir a leitura pelos jogadores. Com pontos vinculados, ela aparece quando pelo menos um deles está revelado; sem pontos, aparece para toda a mesa. Se os pontos forem removidos, os vínculos ficam marcados como indisponíveis para o mestre revisar. Há um limite de 100 cenas por mesa.

Se outra tela alterar a cena, **Revisar cena** permite escolher título, texto, pontos e visibilidade antes do salvamento explícito. Ao fechar uma edição, **Fechar e manter rascunho** guarda a cópia no navegador para retomar na mesma aba; **Descartar rascunho e fechar** remove essa cópia. Rascunhos usam `localStorage` e IndexedDB e oferecem **Baixar cópia** em JSON. **Arquivar cena** retira a cena da leitura dos jogadores e dos pontos; o mestre pode restaurá-la pelo aviso ou pela lista **Arquivadas**. As cenas salvas ficam no SQLite e são sincronizadas com a mesa.

O servidor Node.js armazena contas e mesas em SQLite. Salas online têm permissões de jogador, mestre e ADM e eventos em tempo real, incluindo a bandeja 3D de dados compartilhada.

As janelas de notas guardam rascunhos automaticamente no navegador em `localStorage` e IndexedDB, inclusive texto, imagens e mapa mental. Ao voltar à mesa na mesma aba, os rascunhos são reabertos; para publicar mudanças na mesa, clique em **Salvar**. Se os dois armazenamentos locais falharem, a nota oferece **Baixar cópia** em JSON. O arquivo contém o conteúdo da nota e deve ser guardado como informação privada.

Clique em **Nova nota** para abrir uma nota em branco. Dê um nome, escreva o texto ou monte o mapa mental e clique em **Salvar** para guardar na mesa.

Cada caderno permite buscar títulos, texto e ideias do mapa mental. A busca mostra apenas as notas visíveis naquele caderno.

Dentro de uma nota aberta, clique em **Buscar** ou use **Ctrl+F** (⌘+F no Mac). Digite uma palavra ou trecho: as ocorrências são destacadas, sem distinguir acentos ou maiúsculas. Use os botões **Resultado anterior** e **Próximo resultado**, ou Enter e Shift+Enter, para percorrê-las. Escape fecha a busca. Na visualização **Texto**, a busca percorre somente as anotações; em **Mapa mental**, percorre textos dos cartões, legendas de imagens e rótulos das conexões, levando o quadro até o resultado. Ao navegar, filtros de cartões são removidos para revelar a ocorrência. Buscar não altera o conteúdo nem cria uma versão da nota.

No quadro, use **Novo cartão**, escreva e arraste para organizar. Arraste o círculo lateral até outro cartão para ligar as ideias, ou escolha **Conectar a outro cartão** em **Detalhes do cartão** e clique no destino. As conexões são traços sem setas e acompanham o movimento dos cartões. **Detalhes do cartão** reúne tipo (pessoa, local, cena ou pista), até 8 etiquetas e vínculo com ponto 2D. **Mais opções** contém filtros, edição de rótulos das conexões, atalhos e **Aumentar área de desenho**. Shift+clique (ou Shift+Enter) seleciona vários cartões para alinhar ou distribuir posições, com Ctrl+Z para desfazer. Os controles de zoom vão de 5% a 200%; arraste o fundo ou use as barras para percorrer o quadro.

Ao abrir **Mapa mental**, a janela fica no canto inferior esquerdo. Use **Soltar** para arrastar a janela livremente e **Fixar** para voltar ao canto. **Aumentar janela** ocupa o espaço disponível; **Restaurar tamanho** retorna ao tamanho escolhido. O controle no canto permite ajustar largura e altura por arraste ou pelas setas do teclado. Posição, tamanho e visualização da janela são guardados no navegador junto ao caderno.

**Imagem** coloca PNG, JPEG ou WebP de até 2 MB no quadro e tenta guardá-la na coleção da mesa. **Coleção de imagens**, em **Mais opções**, permite usar a mesma referência em outras notas sem copiar o arquivo novamente. Se a conexão falhar, a imagem permanece no rascunho; uma imagem antiga pode entrar na coleção pelo botão **Guardar esta imagem na coleção**. A coleção só mostra arquivos enviados por você ou presentes em notas que você pode abrir. Salve a nota para publicar os novos cartões e vínculos.

**Histórico de versões** compara o rascunho com uma versão salva, incluindo a miniatura do quadro. Selecione nome, texto ou mapa mental para restaurar somente esses campos, revise e clique em **Salvar** para criar uma nova versão. **Desfazer restauração** recupera o rascunho anterior enquanto você não fizer outras edições. O compartilhamento atual é preservado. São retidas até 30 versões e 20 MB por nota; versões anteriores à ativação do histórico não podem ser recuperadas. Participantes compartilhados só veem versões em que já tinham acesso e precisam continuar autorizados na nota atual.

Consulte [ONLINE.md](ONLINE.md) para publicar com Docker, configurar armazenamento persistente e convidar jogadores. Banco local, sessões, dependências e arquivos de ambiente não são versionados.

## Orientação para agentes

Leia `AGENTS.md` antes de alterar o projeto. As skills locais ficam em `.agents/skills/` e orientam design, acessibilidade, animação, desempenho em React, diagnóstico de bugs, testes de comportamentos importantes e revisão de alterações. `setup-matt-pocock-skills` configura onde guardar tarefas e documentação.


### Exportação portátil

A aba **Mesa** permite preparar uma cópia JSON com o conteúdo autorizado, histórico de notas, imagens e arquivos 3D incorporados. A exportação respeita notas privadas, compartilhamento histórico e névoa no modo jogador. O formato ainda não tem importação na interface. Veja [docs/ROOM_EXPORT.md](docs/ROOM_EXPORT.md).
