# 001 — Névoa de guerra protegida no servidor

Data: 2026-09-30. Estado: adotado.

## Contexto

O item 25 do plano pede névoa de guerra e áreas reveladas por mesa. Cobrir a imagem apenas no navegador ainda enviaria o mapa completo e dados de locais ocultos a jogadores.

## Decisão

- Guardar `mapFog` no estado SQLite existente da mesa: ativação, dimensões e até 200 retângulos revelados. Mapas antigos começam sem névoa.
- Mestre e ADM no modo mestre alteram áreas pela API. Uma versão calculada com a imagem e a névoa bloqueia seleções antigas após mudanças concorrentes ou troca da imagem.
- Jogadores recebem uma URL autenticada de imagem protegida. A rota gera PNG com os pixels ocultos cobertos e remove metadados do arquivo original. GET, respostas de alterações e SSE filtram pontos e traços antes de enviar o estado.
- Um traço parcialmente oculto fica indisponível até seu caminho inteiro ser revelado. Isso preserva a geometria e o desfazer por autor. Desenho e exclusão em áreas ocultas também são rejeitados na API.
- A interface do ADM no modo jogador aplica a cobertura e os filtros, sem reduzir o papel real da conta na sessão.
- Revelar e cobrir funciona por arraste, dois cliques/toques ou teclado. A seleção é uma prévia local; só o término publica a área. Cobrir novamente não apaga conhecimento ou imagens que alguém já recebeu.
- Desativar mantém as áreas para reativação. Trocar a imagem limpa as áreas, desativa a névoa e mantém os pontos, conforme o fluxo de confirmação existente.

## Dependência e limites

[Sharp](https://sharp.pixelplumbing.com/api-composite/) 0.35.5, licença Apache-2.0, instalada por npm e fixada em `package-lock.json`. Processamento local no servidor; não há conta, chave de API ou envio de conteúdo a terceiros. A imagem deve abrir corretamente e ter até 32 milhões de pixels e 16.000 pixels por eixo para ativar a névoa. GIF protegido usa o primeiro quadro. Atualizações da biblioteca devem manter os testes de pixels e permissões.

A renderização é serial, agrupa pedidos iguais e limita a fila a quatro imagens. O cache tem até oito resultados e 32 MB; respostas HTTP usam `no-store` e revalidam acesso e versão antes do envio. Falhas oferecem uma nova tentativa e não enviam a imagem original como fallback.

O Docker instala todas as dependências de produção em uma etapa própria, incluindo o binário Sharp correspondente à plataforma. O contêiner não foi executado nesta validação porque Docker não está disponível neste ambiente.

## Verificação

Três testes cobrem subtração de áreas, caminhos atravessando trechos ocultos, permissões reais e modo, versões antigas, pixels PNG, proteção do estado, limite da fila, SSE, reinício e troca da imagem. Validação HTTP no navegador com mestre e jogador, desktop e 390 px, teclado, dois cliques, foco visível, alvos de 44 px e desenho restrito a áreas reveladas. A sincronização da névoa mantém o histórico local de traços.
