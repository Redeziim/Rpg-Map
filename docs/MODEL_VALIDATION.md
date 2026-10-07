# Conferência de modelos da Mesa 3D

Item 43, validado localmente em 2026-10-02. A conferência acontece no servidor antes de salvar pacote e objeto na mesma transação. Aceita transporte binário e JSON antigo. Falhas mantêm a seleção de arquivos na interface e informam o arquivo a corrigir, junto da importação, com foco acessível.

## Conteúdo conferido

- OBJ: comandos, números finitos, índices, faces, malhas visíveis, bibliotecas MTL e materiais usados. O parser real do Three.js confere a geometria resultante.
- GLTF/GLB: estrutura 2.0, blocos, buffers, accessors, texturas e cena principal. Usa `gltf-validator@2.0.0-dev.3.10`, do [KhronosGroup](https://github.com/KhronosGroup/glTF-Validator), Apache-2.0, executado localmente. Extensões obrigatórias precisam estar disponíveis no loader atual; compressões Draco, BasisU e Meshopt ainda não estão habilitadas.
- FBX: estrutura, arrays comprimidos, valores, geometria e texturas, usando o parser real sem renderer. Modelos animados recebem aviso de pose inicial.
- PNG/JPEG/WebP: assinatura, formato, dimensões e decodificação real com Sharp. Imagens animadas não são aceitas como texturas.
- Referências: somente recursos do pacote ou dados incorporados. Caminhos relativos são normalizados; um nome simples pode resolver um único arquivo selecionado sem pasta. Recursos ausentes, ambíguos ou URLs externas são recusados. A conferência não busca texturas na internet.

Arquivos de apoio não usados continuam preservados. A conferência pesada de malha corresponde ao arquivo principal; ela não pretende validar todos os formatos possíveis de arquivos extras.

## Limites

Os limites existentes de 100 arquivos/50 MiB por pacote permanecem. Após o ajuste solicitado em 2026-10-03, a malha principal tem limite de **6 milhões de vértices desenhados e 2 milhões de triângulos**, considerando instâncias, e 20.000 elementos. Faces quadradas OBJ são aceitas e contam como dois triângulos; a margem de vértices também considera a expansão de três vértices por triângulo. Hierarquias GLTF/FBX têm até 128 níveis; arrays FBX descomprimidos somam no máximo 64 MiB. Texturas reutilizam os limites das imagens do mapa: 16.000 px por lado e 32 milhões de pixels. Recursos incorporados decodificados somam até 50 MiB. Limites de memória/prazo adicionais permanecem; contrato e evidências em [MODEL_DETAIL_AND_SCALE.md](MODEL_DETAIL_AND_SCALE.md).

Uma fixture OBJ de apenas 800.024 bytes, com 100 mil faces, gerou 300 mil vértices no parser: aproximadamente 44,8 MB de heap e 7,2 MB de ArrayBuffers adicionais em uma execução Node 24/Windows de 72 ms. Essa medição sintética orientou a proteção de geometria; não é uma promessa de desempenho no navegador.

Até dois workers por aplicação fazem a conferência, com prazo de 20 segundos. Não há fila ilimitada: ocupação devolve 503 para tentar novamente. Cada worker limita o heap JavaScript a 256 MiB; esse limite **não cobre toda memória nativa**, ArrayBuffers ou Sharp. Limites de payload, pixels e arrays complementam a proteção.

Resultados positivos são guardados por hash em um cache de até 64 resumos, sem arquivos. Pedidos do mesmo pacote compartilham o trabalho; cancelar um deles não cancela o outro. Quando o último pedido termina a conexão, o worker é interrompido. Permissão e estado da mesa são relidos depois da conferência para evitar publicar após revogação ou substituir alterações concorrentes.

## Modelos antigos

Os registros antigos não são alterados. O carregamento binário novo também confere pacotes antigos antes de entregá-los ao loader. Se forem incompatíveis, a cena informa o problema. A leitura JSON legada, a exportação e o backup conservam os bytes originais para recuperação. A autorização continua sendo verificada mesmo com resultado em cache.

## Evidências e limites restantes

Três testes HTTP novos cobrem pacotes válidos nos dois transportes, formatos inválidos/abusivos sem gravação, cancelamento, prazo, API disponível, concorrência, revogação e recuperação de registros antigos. Suíte: 101 testes aprovados; build aprovado. `npm run dev`: OBJ/MTL/PNG, GLTF/BIN/PNG, GLB, FBX e terreno importados, registros antigos carregados, apoio ausente preservando seleção, desktop de 1440 px e celular de 390 px sem overflow. Erro no celular está ao lado da seleção e recebe foco.

Auditoria completa de descarte, recuperação WebGL, progresso real e cancelamento visível de importação continuam nos itens 44–46. A conferência não transforma um modelo em uma versão mais leve.
