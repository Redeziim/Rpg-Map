# Revisão de usabilidade do site inteiro

Feita em 2026-10-08, a pedido do usuário: achar o que é redundante ou pesado, deixar o app mais fácil de entender e recolher a barra lateral para ícones. Método: percorrer as seis abas como mestre, com um mapa carregado, contando botões e campos visíveis e olhando capturas em 1366, 900 e 420 px.

## O que a revisão achou

| Onde | Problema | Medida |
| --- | --- | --- |
| Todas as abas | A faixa de cima (turnos e três cartões de notas) ocupava cerca de 135 px e se repetia em toda aba. | 28 a 48 botões visíveis por aba, antes de abrir qualquer coisa. |
| Barra lateral | 220 px fixos, com nome da mesa, modo, conexão, conta e contador de pontos sempre à vista. | Tirava um sexto da largura. |
| Ferramentas do mapa 2D | Dez seções de peso igual, mais uma lista de traços solta no fim. "Mostrar traços" e "Traços do mapa" tratavam da mesma coisa em dois lugares. | 11 botões e 22 campos no painel. |
| Controles e zoom | Cinco parágrafos de instrução, repetindo o que a barra de cima e o teclado já dizem. | |
| Notas | Três cadernos com o mesmo menu longo (Recuperar rascunhos, Nova nota, Reunir janelas, lixeira). Cada janela de nota tem Texto, Mapa mental, Buscar, Compartilhar, Histórico, Exportar e Lixeira. | 23 botões só no código do caderno. |
| Dados | Duas bandejas: "Dados" na ficha e "Bandeja da mesa" em Status do Grupo, sem dizer a diferença. | Mantidas; a diferença passou a estar escrita (ver abaixo). |
| Nome "Mesa" | A aba "Mesa" é de participantes e convites; "Mesa 3D" é o mapa; o nome da campanha também é "mesa". | Renomeada para "Participantes" (ver abaixo). |
| Envio de mapa | O diálogo pede para escolher a resolução ("Mais leve" ou "Mais detalhe") antes de publicar. | Não alterado; ver o fim deste documento. |

## O que foi feito

- **Barra lateral só de ícones** (`src/CompactShell.css`). Ocupa 64 px; ao passar o mouse ou navegar por teclado abre para 220 px, por cima do conteúdo, sem empurrá-lo. Depois de clicar, fecha quando o mouse sai (o foco do mouse não a mantém aberta, só o do teclado). Abaixo de 761 px a navegação continua em grade no topo.
- **Faixa de cima compacta**: turnos numa linha e os três cadernos como botões pequenos; a contagem de notas só aparece quando há notas. De cerca de 135 px para cerca de 58 px.
- **Ferramentas do mapa**: ficam à vista Pontos, Controles e zoom, Grade e régua, Névoa de guerra e Imagem do mapa. Posições e Traços vão para "Mais ferramentas", que abre sozinho quando uma delas está em uso (as outras três foram removidas, ver abaixo). A lista de traços entrou no mesmo grupo e o texto de ajuda caiu de cinco parágrafos para três linhas.
- **Notas**: "Recuperar rascunhos" e "Reunir janelas" foram para "Mais opções" dentro do menu de cada caderno. Nada foi removido.

Esta primeira rodada não apagou nada: só reorganizou. As remoções vieram depois, por decisão do usuário (próxima seção).

## Decisões do usuário (2026-10-08) e o que foi feito com elas

| Pergunta | Resposta | Resultado |
| --- | --- | --- |
| Ferramentas do mapa a remover | Rotas de exploração, Legenda do mapa e Exportar vista. Ficam Posições dos jogadores e Traços. | Interface removida: seções do painel, desenho das rotas e da legenda sobre o mapa, modo "rota" do mapa, aviso de saída e os arquivos `MapExploration.jsx/.css` e `MapViewExport.jsx/.css`, `mapViewExport.js`. |
| Mapa mental nas notas | Manter, mas escondido | Nota nova abre só com título e texto; "Mapa mental" e "Buscar" viram botões discretos. Se a nota já tem um mapa mental, ou ele está aberto, o seletor completo volta. |
| Duas bandejas de dados | Manter as duas | A diferença está escrita: a da ficha diz quem vê a rolagem ("Sem marcar, só você e o ADM veem. Marque para todos verem.") e a da mesa diz "Todos na mesa veem os dados rolarem aqui." |
| Nome da aba "Mesa" | Participantes | Renomeada (no celular aparece "Pessoas"). |

## Segunda rodada (2026-10-08, mais tarde)

Pedido do usuário depois de ver a primeira rodada.

- **Servidor das rotas, legenda e exportação removido** (ver [ADR 036](adr/036-remocao-de-rotas-legenda-e-exportacao-de-vista.md)). Dados antigos não vazam e são limpos no próximo salvamento.
- **Barra lateral**: alinhada em um eixo (ícones centrados em 32 px, textos à esquerda), com animação simples: abre em 240 ms, o nome aparece um instante depois e o ícone avança 3 px ao passar o mouse. Sem animação para quem pede movimento reduzido.
- **Turnos**: somem em Cenas, Linha do tempo e Sobre (continuam montados, para não perder um comando pendente). No Mapa ficam numa linha só e menores (de 54 para 38 px).
- **Mesa 3D**: saíram os textos que explicavam o óbvio (qualidade, movimento suave, importar terreno, luz e câmera). A instrução de teclado continua para leitor de tela, fora da vista.
- **Notas**: o menu de cada caderno trocou o acordeão "Mais opções" por dois botões pequenos no rodapé ("Rascunhos" e "Reunir janelas"). O Mapa mental foi redesenhado: barra enxuta com contagem de cartões, o antigo "Mais opções" virou um painel flutuante "Mais" (coleção de imagens, aumentar área, filtros, conexões, atalhos) que não empurra o quadro, os detalhes do cartão e o arranjo da seleção ficam sobre o quadro, o cartão perdeu a faixa de título pesada e o fundo ganhou uma grade de pontos.

## Terceira rodada (2026-10-08, à noite)

- **Cadernos de notas**: saem também de Sobre e Linha do tempo (só o botão; as janelas de nota abertas continuam). Em Cenas ficam os cadernos e somem os turnos.
- **Turnos e cadernos no canto superior direito**: nas abas em que aparecem, formam um grupo compacto alinhado à direita, sem esticar (acima de 760 px). Os três cadernos viram um grupo unido. Sem combate, o rótulo \""Ordem de jogo\"" some; com combate, \""Rodada N\"" continua. \""Gerenciar turnos\"" virou \""Gerenciar\"". O bloco de turnos caiu de cerca de 650 px para cerca de 490 px.
- **Grade do Mapa mental**: no lugar dos pontos, uma grade de linhas translúcidas (a cada 28 px, e uma mais marcada a cada 140 px).

## Quarta rodada (2026-10-08, depois da avaliação)

Dois agentes (QA e revisor) e a skill de auditoria de interface avaliaram o resultado; os agentes só tinham ferramentas de leitura, então as notas deles (6,2 e 6,4 de 10) vêm de leitura de código, não de uso. O que se confirmou foi corrigido:

- **Painel de Turnos fora da tela** (confirmado no navegador: borda esquerda em −258 px a 900 px e −289 px a 420 px). O painel agora se ancora na faixa, com `width:min(560px,100%)`, e fica dentro da tela nos três tamanhos.
- **Avisos de turno escondidos.** O botão "Turnos" mostra "Confirmar comando", "Conferindo comando…" ou "Ver aviso" (`src/shared/turnAttention.js`, com teste), abre o painel sozinho quando há comando pendente e anuncia o estado para leitor de tela. Um aviso já visto não marca o botão de novo. O Esc devolve o foco ao botão. Dentro do painel o bloco já abre expandido, sem o segundo botão de recolher.
- **Fontes da ficha.** Cinco das seis opções de "Tipografia" tinham parado de carregar. Agora cada uma é pedida ao Google Fonts quando escolhida (`src/shared/sheetFonts.js`); os painéis de exportação e auditoria usam a fonte do tema.
- **Tela de erro** (`src/ErrorBoundary.js`) no lugar da página em branco quando algo quebra ao desenhar.
- **Servidor.** A lista dos campos removidos fica num só lugar (`REMOVED_STATE_FIELDS`), e há testes do SSE e de um backup com os campos antigos (`tests/removedMapTools.test.js`). A limpeza é definitiva; ver o [ADR 036](adr/036-remocao-de-rotas-legenda-e-exportacao-de-vista.md) sobre backup antes de atualizar.
- **Barra lateral:** "Minhas mesas" e "Sair da conta" no rodapé da faixa de ícones, títulos nos botões, `aria-current` na navegação, barra aberta em alto contraste. **Faixa de cima:** camada acima das mensagens do mapa e seletores mais fortes, para não dependerem da ordem em que as folhas lentas chegam (conferido no build de produção).
- **Notas:** o painel "Mais" do Mapa mental tem id único, fecha com Esc e devolve o foco; o menu "Mais" da nota fecha ao clicar fora e com Esc; "Notas compartilhadas" vazio explica como compartilhar; o modificador de atributo é lido por leitor de tela sem depender de `aria-label` em `<strong>`.
- **Código e documentação:** ícones, estados e regras de CSS que a remoção deixou sem uso saíram; `src/shared/mapExploration.js` virou `pointTypes.js`; README, ONLINE, DESIGN, PLANO, ADR 004 e os documentos de backup, exportação e auditoria deixaram de descrever as funções removidas.
- **Alvos de toque:** 44 px em tela de toque (`pointer:coarse`); no computador os controles novos seguem em 36 a 40 px, decisão registrada em `DIRECAO_GOTICA.md`.

Não corrigido, por ser maior: hospedar as fontes localmente, e um teste automatizado de interface (hoje a casca nova só é verificada à mão).

## Sexta rodada (2026-10-09): Mapa mental estilo Obsidian e barra lateral com as mesas

Pedido do usuário: o Mapa mental continuava feio e "preso num canto"; ele gosta do Canvas do Obsidian pela simplicidade. A barra lateral devia mostrar, em ícones, as mesas em que a pessoa está, quem ela é e o papel, com uma animação mais limpa. Pesquisa: o Canvas do Obsidian (cartões só de texto, alças nas bordas que viram conexões, conexões curvas com seta, barra flutuante junto da seleção, zoom e histórico num canto, cores por tipo).

- **Por que parecia preso num canto.** A janela do Mapa mental abria *fixa* no canto inferior esquerdo (a regra `docked = boardOpen && position.docked !== false`). Agora abre solta e maior (1000 × 720), como uma nota. "Fixar" continua existindo.
- **Cartão.** Só texto, com um ícone discreto e uma cor por tipo (pessoa, local, cena, pista; o ícone repete a informação, para não depender só da cor). O cartão inteiro é a alça: arrastar move, clicar seleciona, clicar de novo edita, Enter edita. Sem faixa de título nem "⋮⋮".
- **Conexões.** Curvas que saem do lado do cartão que olha para o outro, com ponta de seta no destino; as bordas são medidas de verdade (`ResizeObserver`), então a seta toca o cartão mesmo com texto longo. Clique numa conexão para dar rótulo ou remover. A documentação antiga dizia "sem ponta de seta"; a mudança é pedido do usuário.
- **Ferramentas.** Saiu a barra de texto, a contagem, o texto de ajuda e o botão "Aumentar área". À direita ficam zoom, 100%, desfazer, refazer e "Mais"; embaixo, Novo cartão, Imagem e Desenhar; junto do cartão selecionado, uma barra pequena com as cores de tipo, editar, conectar, detalhes e excluir. "Mais" abre um painel ao lado, com cada assunto recolhido (coleção de imagens, filtros, conexões, atalhos). O quadro cresce sozinho perto da borda.
- **Fora de propósito.** "Ajustar à janela" (Enquadrar tudo) foi recolocado por engano e retirado de novo, porque o projeto o rejeitou em 2026-10-04.
- **Barra lateral.** Fechada, mostra como ícones a marca, a mesa atual com um ponto de estado da conexão (verde, dourado enviando, vermelho sem conexão), as outras mesas da conta como quadrados com a inicial (um clique troca de mesa, com aviso se houver envio pendente), e quem você é com o ícone do papel (coroa para mestre, espadas para jogador, escudo para ADM, que também alterna o modo). Aberta, mostra nomes, papéis e o estado por extenso. Saiu o contador "N pontos". Nas telas baixas a barra rola em vez de cortar o rodapé, e em alto contraste tudo fica à vista.
- **Animação.** Só a máscara anda; os nomes aparecem depois e somem antes. Medido quadro a quadro: abre em cerca de 190 ms, com os nomes a partir de 80 ms; fecha com os nomes sumindo em 100 ms e a barra recolhendo 150 ms depois.
- **Achados das duas revisões que estas mudanças já resolvem:** rodapé da barra cortado em tela baixa, controles invisíveis em alto contraste, modo ADM e conexão invisíveis com a barra fechada, "Minhas mesas" duplicado no DOM, traço do quadro com cor fixa no tema claro, foco perdido depois do histórico da nota.

## O que ficou de fora de propósito

- **Escolha de resolução ao enviar o mapa** ("Mais leve" ou "Mais detalhe"): não alterado; pode ficar atrás de "Opções" se atrapalhar.
- **Janela de nota**: histórico, compartilhar, exportar e lixeira continuam na janela. Se ainda parecer pesado, o próximo passo é juntar esses quatro num menu único.
