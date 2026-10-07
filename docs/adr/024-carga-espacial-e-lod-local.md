# 024 — Carga espacial e LOD local

- Estado: aceita, implementação local
- Data: 2026-10-03
- Escopo: restante do item 49

## Decisão

Priorizar seleção, visão e proximidade antes de buscar pacotes; limitar a duas operações, incluindo a prévia privada, e cancelar/reordenar usando a câmera atual. Encerrar trabalhos e modelos fora de uso pelo contrato de propriedade existente.

Usar `THREE.LOD` com geometria distante real, derivada pelo worker meshoptimizer instalado. Originais e persistência permanecem canônicos. Original manual conserva todo o detalhe; seleção conserva a qualidade próxima. Materiais/imagens são compartilhados sem alteração pela derivação distante. Histerese evita alternâncias frequentes. Não criar loop de renderização permanente.

## Consequências

Menos download/preparação inicial quando parte da mesa está longe; menor carga de desenho à distância. Preparar LOD acrescenta CPU e geometria residente; não reduz o pacote individual ou elimina parsers síncronos. Variantes anteriores ao download e cache de modelos compartilhado foram avaliados e permanecem extensões futuras. Sem nova API externa, dependência, migração ou publicação de poses. Contrato, medições, três testes e limites em [TABLETOP_STREAMING.md](../TABLETOP_STREAMING.md).
