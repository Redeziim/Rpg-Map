# 026 — Iluminação compartilhada e câmera pessoal

Data: 2026-10-03. Status: aceita e implementada localmente.

## Contexto

O usuário escolheu que o mestre define a luz e cada pessoa controla sua câmera. A Mesa 3D é independente dos pontos 2D e das cenas de texto da campanha.

## Decisão

Persistir um preset de iluminação no estado canônico da mesa e usar endpoint com autorização, modo de visualização e versão para conflitos. Reutilizar as duas luzes existentes; mudar o preset sem reconstruir a cena. Migrar o JSON para versão 4 na transação de inicialização. Preservar o esquema SQLite 4.

Guardar somente posição e alvo da câmera no navegador, por conta/mesa, usando a estratégia de preferências local já existente. Validar vetores e distância e manter cópia limitada à visita quando o armazenamento falhar. Não enviar câmera na API ou SSE. Prévia de importação não grava a câmera temporária como preferência.

Vistas prontas mudam diretamente, incluindo para pessoas que preferem movimento reduzido. Restaurar câmera enquadra toda a mesa; Enquadrar conserva a função de focar a seleção. Controles têm rótulos simples, foco e uso por teclado/toque.

## Consequências

A luz sobrevive a reinício/exportação e muda para todos. Câmeras abertas permanecem independentes, com preferência recuperada no mesmo navegador. Abas da mesma conta compartilham apenas o último valor salvo para uma abertura futura. Não há nova API externa, biblioteca, sombra ou loop permanente.

Contrato e evidências em [TABLETOP_LIGHTING_AND_CAMERA.md](../TABLETOP_LIGHTING_AND_CAMERA.md).
