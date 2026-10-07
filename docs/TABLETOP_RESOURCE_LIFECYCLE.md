# Recursos da Mesa 3D — item 44

## Contrato de propriedade

`loadMapAsset` entrega um modelo registrado. `disposeModel(root)` encerra sua propriedade e pode ser chamado novamente sem repetir a liberação. Geometrias, materiais, texturas, imagens com `close`, uniformes de shader, esqueletos e recursos de InstancedMesh são considerados. Recursos compartilhados só são liberados depois do último proprietário.

Antes de usar um clone, chame `retainModel(clone)` enquanto o modelo de origem ainda está vivo. Chame novamente após substituir recursos de um modelo registrado: a função atualiza a propriedade e libera os recursos retirados. Um modelo descartado não pode voltar a ser registrado. Não reutilize recursos já liberados. O esqueleto mantém a propriedade da boneTexture, inclusive quando o renderer a cria depois do registro.

A redução de qualidade atualiza a propriedade em `finally`, inclusive em cancelamentos intermediários. Assim, as geometrias substituídas e as imagens originais são liberadas sem destruir recursos ainda usados por outro proprietário. A invalidação da textura para reenviar sua imagem reduzida à GPU continua distinta da liberação definitiva do modelo.

## Importações e saída da cena

- Materiais pré-carregados de OBJ/MTL e dependências de glTF são acompanhados até resolverem ou falharem; recursos de cenas secundárias e materiais não usados também são liberados.
- Em falha parcial, a limpeza aguarda as dependências já iniciadas e descarta seus resultados. Uma imagem que chega após cancelamento é fechada. Fontes Blob/base64 e mensagens existentes são preservadas.
- URLs do pacote e URLs de imagens incorporadas são revogadas uma vez após as leituras. O FBX r170 cria URLs mesmo para imagens incorporadas não usadas. Sua chamada síncrona de `parse` captura essas URLs e restaura `URL.createObjectURL` em `finally`, antes de qualquer suspensão assíncrona. Essa adaptação deve ser revista ao atualizar Three.js.
- Sair, trocar de mesa ou de qualidade cancela cargas e descarta modelos. Entregas tardias não voltam à cena.
- Sair desconecta ResizeObserver, eventos próprios de ponteiro/controles, preferência de movimento e visibilidade; encerra o frame de animação, controles, modelos, grade, renderer e contexto WebGL. A perda forçada ocorre somente no renderer encerrado.
- A [prévia local do item 47](MODEL_PREVIEW.md) segue o mesmo contrato: cancelar, mudar qualidade/acesso, desmontar ou perder WebGL libera cargas, malha e contorno; resultados tardios são descartados.

## Evidências de validação — 2026-10-02

Três testes em `tests/tabletop-resources.test.js`:

1. Cinco ciclos do loader OBJ real, verificando eventos de liberação e limpeza repetida.
2. Geometria/material/textura/imagem compartilhados por três modelos; uniformes de shader e boneTexture criada após o registro. A remoção de um proprietário não libera recursos dos demais.
3. Falha parcial e cancelamento durante decodificação de imagem de GLTF real, com entrega tardia, fechamento da imagem e revogação das URLs. Somente a fronteira de decodificação do navegador é simulada no teste Node.

`npm run dev` com SQLite descartável, navegador em 1440 e 390 px:

| Sequência | Resultado observado no renderer |
| --- | --- |
| Seis trocas Original/Leve, esfera e terreno | 3 geometrias, 1 textura e 4 programas após cada troca; 2 modelos, sem cargas pendentes. |
| Quatro ciclos sair/abrir o 3D | Mesmas contagens ao abrir; geometria, textura, programas e modelos em zero ao encerrar; canvas retirado. |
| Dois ciclos com 12 objetos OBJ/GLTF/GLB/FBX/imagens | 13 geometrias, 11 texturas e 7 programas ao abrir, sem crescimento; zero no encerramento. |
| Troca de mesa | Renderer anterior encerrado, sem modelos ou cargas registrados. |
| Saída com carga pendente | 11 modelos e 1 carga antes de sair; modelos/cargas/recursos em zero após limpeza, sem canvas ou erro no console. |
| Dois clones com geometria/textura reais compartilhadas | Remover o primeiro manteve o segundo visível, com 1 geometria, 1 textura e 1 programa; todos liberados no fim. |

Em 390 px, qualidade e câmera por teclado continuaram operáveis; página de 382 px, sem overflow horizontal. Instrumentação temporária e página do ensaio foram retiradas após a medição. Suíte completa e build também foram executados.

Esses números são contadores de recursos dessas cenas, não uma medição de todo o heap, memória do driver ou FPS. Caches internos estáveis do Three.js podem permanecer em outras cenas. Parsers síncronos e decodificações nativas já em execução não podem ser interrompidos no meio: seus resultados são liberados ao terminar. [Progresso e cancelamento de upload](MODEL_IMPORT_PROGRESS.md) foram concluídos no item 46; a recuperação de WebGL durante uso foi concluída no item 45, conforme [WEBGL_RECOVERY.md](WEBGL_RECOVERY.md).

Referência: [limpeza de recursos no Three.js r170](https://raw.githubusercontent.com/mrdoob/three.js/r170/manual/en/cleanup.html). Nenhuma dependência, serviço externo, API ou persistência nova foi adicionada.
