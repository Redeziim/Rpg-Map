# 003 — Preparação e limites das imagens do mapa 2D

Data: 2026-10-01. Estado: aceita.

## Contexto

O envio direto podia publicar imagens grandes sem prévia e criar um canvas na resolução original. Pontos e traços usam coordenadas em pixels; reduzir a imagem de uma mesa existente sem preservar essas coordenadas deslocaria seu conteúdo. A troca também remove traços, névoa, escala e posições, e precisa mostrar esses efeitos antes da publicação.

## Decisão

- Abrir uma prévia local para todo envio. Publicar somente por ação explícita; trocas exigem confirmação adicional.
- Aceitar origens PNG, JPEG, WebP ou GIF de até 20 MiB, 16.000 pixels por lado e 32.000.000 pixels. Ler assinatura e dimensões no primeiro MiB antes de abrir a imagem. Cabeçalhos não identificáveis nessa janela pedem nova exportação.
- Preparar WebP com qualidade 0,9 e sem ampliar a origem. Oferecer até 2048 ou 4096 pixels por lado, sempre limitado a 8.000.000 pixels e 5 MiB. Navegadores sem codificação WebP podem retornar PNG, sujeito aos mesmos limites. Usar uma imagem fixa de arquivos animados e respeitar orientação EXIF no preparo.
- Mostrar o arquivo preparado na prévia, incluindo inspeção em tamanho real. Redução e compressão podem afetar textos pequenos; o mestre confere a versão efetivamente publicada.
- Manter pontos nas coordenadas existentes por padrão. Reposicionar proporcionalmente somente por escolha explícita, com os círculos da prévia mostrando o resultado. Manter nomes, identificadores e vínculos.
- Enviar a versão da imagem aberta e, ao reposicionar, a versão dos pontos. Mudanças exigem revisão, sem atualizar silenciosamente a base. A API confere a imagem antes e depois da decodificação, relê permissões/estado e aplica imagem e pontos na mesma atualização. A versão da imagem continua opcional para clientes legados, que precisam adotá-la para proteger uma prévia antiga.
- Validar no servidor Base64, assinatura, limites e decodificação com Sharp existente. Recusar arquivos animados enviados diretamente à API. Executar uma validação de imagem por vez, com até quatro pendentes por aplicação e resposta 503 ao exceder a fila.
- Nos mapas antigos dentro dos limites de abertura, separar dimensões lógicas da mesa da resolução do canvas. O canvas fica limitado a 4096 pixels por lado e 8.000.000 pixels; pontos, traços, névoa, posições e medidas continuam usando a dimensão original. Mapas acima dos limites de origem exigem redução/substituição e exibem erro recuperável.
- Cancelar trabalhos antigos, serializar o preparo da prévia, fechar bitmaps, revogar URLs de objetos e zerar canvases temporários ao liberar recursos. Esses limites não equivalem a um teto de toda a memória do navegador ou do processo.

## Consequências

A mesa recebe uma imagem menor e a troca fica verificável antes do envio. A origem ainda precisa ser decodificada no navegador, por isso também tem limites. A otimização pode reduzir detalhes e remover animação/metadados; o arquivo original não é guardado pelo site. O cancelamento mantém o estado atual da mesa. Trocas continuam removendo traços, névoa, escala, medida local e posições, como nos fluxos anteriores.

A imagem permanece no SQLite/Base64 e no protocolo SSE existente. Esta decisão não muda a persistência, adiciona serviço externo ou transforma os pontos em cenas 3D. Separar imagens de atualizações comuns permanece no catálogo de confiabilidade.

## Verificação

Três testes de integração cobrem formatos reais, arquivos incompletos/disfarçados, limites antes da abertura, fila, permissões, versões, alterações paralelas, atualização conjunta de pontos e imagem, SSE e reinício. Navegador validado em desktop e 390 pixels, incluindo cancelamento, orientação EXIF, foco de erro, revisão após edição concorrente, tamanho real sem overflow da página e coordenadas de uma mesa antiga de 6400 × 4000.

## Referências

- [MDN: createImageBitmap e orientação da imagem](https://developer.mozilla.org/en-US/docs/Web/API/Window/createImageBitmap).
- [Sharp: opções de entrada e limites de pixels](https://sharp.pixelplumbing.com/api-constructor/).
- [Google: estrutura RIFF do WebP](https://developers.google.com/speed/webp/docs/riff_container).
