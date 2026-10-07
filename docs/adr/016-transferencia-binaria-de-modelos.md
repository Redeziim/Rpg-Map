# 016 — Transferência binária opcional de modelos

- Estado: aceita
- Data: 2026-10-02
- Escopo: item 42, Mesa 3D independente

## Decisão

Usar File/Blob no navegador e um transporte binário versionado opcional nos endpoints existentes de pacotes 3D. O formato `application/vnd.grimorio.map-asset` contém prefixo, metadados limitados e arquivos concatenados. O servidor continua persistindo JSON/base64 no SQLite e atendendo clientes antigos. O cliente novo lê também a representação JSON antiga.

O loader prepara somente os recursos usados e evita ler o principal duas vezes. Downloads têm cache privado, ETag específico da representação, validação de acesso e cancelamento ao sair da cena. Escritas da interface enviam o modo de visualização; ADM em modo jogador conserva as permissões de jogador na Mesa 3D.

## Motivo

A transferência JSON/base64 ampliava o corpo e exigia decodificações e URLs antecipadas no navegador. Uma migração de arquivos para outro armazenamento mudaria a persistência, os backups e a exportação. O transporte opcional reduz esse trabalho preservando esses contratos.

## Consequências

Não há migração, serviço externo ou biblioteca nova. O servidor ainda lê o JSON persistido e converte os arquivos para base64 ao salvar; a mudança não elimina todo o custo de memória nem estabelece um limite global de heap. O binário tem limites explícitos e precisa conservar acesso/cache equivalentes aos do JSON.

Validação profunda do conteúdo, descarte completo, recuperação WebGL e progresso/cancelamento de importação continuam nos itens 43–46. Contrato, medições e evidências em [MODEL_TRANSFER.md](../MODEL_TRANSFER.md).
