# 017 — Conferência de modelos em workers

- Estado: aceita
- Data: 2026-10-02
- Escopo: item 43, Mesa 3D independente

## Decisão

Conferir o conteúdo antes da transação de publicação, em até dois workers com prazo, limites de geometria/imagens e cancelamento. GLTF/GLB usa o validador local Khronos; OBJ/FBX usam também os parsers Three.js. Não renderizar no servidor nem buscar dependências externas. Reler permissão e estado depois do trabalho assíncrono.

## Motivo

Extensão e tamanho não comprovam que o conteúdo é uma malha válida ou que todas as texturas acompanham o pacote. Arquivos pequenos podem expandir para geometrias grandes. Separar esse trabalho mantém a API disponível durante a conferência.

## Consequências

Sem migração de dados ou API externa. Pacotes antigos permanecem recuperáveis em JSON/exportação/backup; a representação binária nova recusa os incompatíveis. Hashes compartilham trabalhos e resumos limitados, com acesso verificado por pedido. O heap do worker não limita toda memória nativa. Contratos, limites e evidências em [MODEL_VALIDATION.md](../MODEL_VALIDATION.md).
