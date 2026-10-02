# 004 — Rotas, legenda e exportação da vista

Data: 2026-10-01. Estado: aceita.

## Contexto

Traços livres não guardam nomes, sequência de paradas ou estado de exploração. A mesa precisa consultar e recuperar caminhos, reconhecer seus pontos por uma legenda própria e baixar uma imagem da vista atual, respeitando a névoa e o conteúdo privado.

## Decisão

- Guardar rotas e legenda no estado SQLite já existente. Rotas têm identificador, nome, cor, paradas, estado planejada/percorrida, visibilidade e arquivo. Caminhos planejados usam linha tracejada; percorridos usam linha contínua.
- Permitir escrita a mestre e ADM no modo mestre. Criar rotas privadas e compartilhar por ação explícita. Jogadores recebem somente rotas ativas compartilhadas cujo caminho inteiro está revelado; a API/SSE também retiram identificadores de versões de rotas ocultas. ADM no modo jogador aplica os mesmos filtros na interface e no PNG.
- Validar de 2 a 100 paradas em pixels inteiros, dentro da imagem, com ao menos dois locais diferentes. Pixels inteiros também mantêm a representação de caminho compatível com a verificação da névoa, sem notação exponencial. Limitar a 100 rotas por mapa, incluindo arquivadas, nome de 120 caracteres e cor RGB. Somar distâncias de todos os segmentos na escala da mesa, ou em pixels.
- Exigir versão da imagem e versão individual da rota em edição/arquivo/restauração. Reler estado, permissão e versões depois de consultar as dimensões da imagem; impedir recriação por uma edição antiga. Preservar rascunhos ao revisar conflitos e nas mudanças de aba durante a sessão. Avisar antes de fechar/recarregar e oferecer cópia JSON. Rascunhos de rotas não recebem salvamento automático de conteúdo; a publicação continua explícita.
- Arquivar sem perder o caminho e oferecer restauração pela lista de arquivadas. Trocar a imagem remove rotas, incluindo arquivadas, com aviso na prévia; a legenda permanece. Um rascunho da imagem anterior precisa refazer as paradas antes de publicar no mapa atual.
- Editar nomes/cores dos cinco tipos existentes de ponto, com versão própria e publicação explícita. Essa configuração é compartilhada com toda a mesa. Guardar somente preferências de exibição por pessoa/mesa no navegador.
- Gerar PNG local a partir do canvas e dos dados visíveis, com o mesmo zoom e deslocamento. Incluir pontos, rotas salvas, traços, grade, régua, posições compartilhadas e legenda exibida. Excluir painéis, conteúdo de notas e prévias de edição. Mostrar a imagem gerada antes de baixar e identificar a visão de mestre/jogador.
- Reaplicar névoa opaca ao PNG de jogador, inclusive quando o canvas original pertence ao ADM. Cobrir limites inteiros de pixels e revelar somente pixels inteiramente dentro das áreas abertas, evitando bordas parcialmente descobertas pela escala. Filtrar novamente rotas, traços, pontos e posições durante a composição.
- Limitar o canvas de exportação a 4096 pixels por lado e 8.000.000 pixels. Liberar canvas auxiliar e URLs de objetos ao concluir/fechar. Exportar somente o PNG final, sem metadados ou original incorporado. Nenhum conteúdo é enviado a serviço externo.

## Consequências

O mestre organiza caminhos sem apagar o histórico quando arquiva uma rota. A legenda usa os identificadores já presentes nos pontos, preservando seus vínculos. Distância e estado de exploração ajudam a conduzir a jornada; regras de deslocamento/combate continuam na etapa correspondente do plano.

O PNG é uma captura da vista ao prepará-lo; mudanças posteriores na mesa não alteram o arquivo. A visão de mestre pode conter locais e rotas privados. Fontes do PNG usam a família serifada disponível no renderizador local; o arquivo mantém conteúdo e geometria, sem ser uma captura dos controles HTML. Imagens já baixadas não podem ser revogadas por uma cobertura posterior da névoa.

## Verificação

Três testes cobrem cálculo dos trechos, limites de geometria/exportação, coordenadas inválidas, privacidade em lacunas da névoa, permissões, alterações concorrentes em rotas/legenda, limite de 100 rotas, arquivo/restauração, SSE, reinício e limpeza na troca de imagem.

Navegador validado em desktop e 390 px: edição, seleção por teclado e toque, conflito mantendo texto, foco de retorno, cores, arquivo/restauração, contas de jogador e ADM e prévia/download do PNG. A verificação do arquivo baixado confirmou posição do ponto após zoom/deslocamento e faixas opacas com 38.948 pixels na conta de jogador e 64.428 no ADM em modo jogador. Essa verificação usa mapa e contas descartáveis em banco separado.
