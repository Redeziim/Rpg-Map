# 019 — Propriedade e liberação dos recursos 3D

Data: 2026-10-02. Estado: aceita, implementação local.

## Contexto

A limpeza existente liberava repetidamente os mesmos recursos e não distinguia proprietários de geometria, textura ou ImageBitmap compartilhados. Uma falha durante o carregamento podia deixar imagens já decodificadas fora da cena retornada.

## Decisão

Registrar modelos por WeakMap, com contagem de referências por recurso. O loader registra a cena entregue; consumidores registram clones antes de remover a origem. `retainModel` atualiza o conjunto de recursos após alterações e `disposeModel` é idempotente e definitivo. Skeleton mantém a propriedade de sua boneTexture alocada tardiamente.

Acompanhar dependências parciais até sua resolução, liberar entradas não utilizadas e revogar URLs de pacote e imagens incorporadas. Atualizar a propriedade na redução de qualidade, inclusive em erro/cancelamento. Remover listeners próprios, controles, observers, frames, referências de cena, renderer e contexto ao desmontar.

## Consequências

Clones deixam de liberar recursos dos demais proprietários. O contrato exige registro explícito de novos clones e atualização após substituir recursos. A adaptação síncrona de URLs do FBX e os hooks de dependências glTF devem ser conferidos em atualização de Three.js. Encerrar a tela não interrompe parsers síncronos já executando; entregas tardias são descartadas. Não há novo cache permanente, dependência, API ou mudança de persistência.

Testes, medições e limites estão em [TABLETOP_RESOURCE_LIFECYCLE.md](../TABLETOP_RESOURCE_LIFECYCLE.md).
