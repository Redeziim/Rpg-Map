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
| Dados | Duas bandejas: "Dados" na ficha e "Bandeja da mesa" em Status do Grupo. | Não alterado; ver perguntas. |
| Nome "Mesa" | A aba "Mesa" é de participantes e convites; "Mesa 3D" é o mapa; o nome da campanha também é "mesa". | Não alterado; ver perguntas. |
| Envio de mapa | O diálogo pede para escolher a resolução ("Mais leve" ou "Mais detalhe") antes de publicar. | Não alterado; ver perguntas. |

## O que foi feito

- **Barra lateral só de ícones** (`src/CompactShell.css`). Ocupa 64 px; ao passar o mouse ou navegar por teclado abre para 220 px, por cima do conteúdo, sem empurrá-lo. Depois de clicar, fecha quando o mouse sai (o foco do mouse não a mantém aberta, só o do teclado). Abaixo de 761 px a navegação continua em grade no topo.
- **Faixa de cima compacta**: turnos numa linha e os três cadernos como botões pequenos; a contagem de notas só aparece quando há notas. De cerca de 135 px para cerca de 58 px.
- **Ferramentas do mapa**: ficam à vista Pontos, Controles e zoom, Grade e régua, Névoa de guerra e Imagem do mapa. Posições, Rotas, Legenda, Exportar e Traços vão para "Mais ferramentas", que abre sozinho quando uma delas está em uso. A lista de traços entrou no mesmo grupo e o texto de ajuda caiu de cinco parágrafos para três linhas.
- **Notas**: "Recuperar rascunhos" e "Reunir janelas" foram para "Mais opções" dentro do menu de cada caderno. Nada foi removido.

Nenhuma função foi apagada. Tudo continua acessível, só menos à vista.

## Decisões em aberto

Estão no relatório da sessão: quais ferramentas do mapa tirar de vez, o que fazer com o Mapa mental, as duas bandejas de dados e o nome da aba "Mesa".
