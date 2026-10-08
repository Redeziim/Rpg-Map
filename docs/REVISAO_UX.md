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

## O que ficou de fora de propósito

- **Escolha de resolução ao enviar o mapa** ("Mais leve" ou "Mais detalhe"): não alterado; pode ficar atrás de "Opções" se atrapalhar.
- **Janela de nota**: histórico, compartilhar, exportar e lixeira continuam na janela. Se ainda parecer pesado, o próximo passo é juntar esses quatro num menu único.
