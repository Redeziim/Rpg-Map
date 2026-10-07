# 020 — Recuperação da Mesa 3D

Data: 2026-10-02. Estado: aceita, implementação local.

## Contexto

Perda de contexto WebGL e falha ao criar o renderer precisam de uma saída operável sem apagar dados da mesa. O projeto escolheu uma tentativa automática, seguida do botão Reabrir 3D se necessário.

## Decisão

Limitar a recuperação automática a uma tentativa por entrada na Mesa 3D. Reconstruir um renderer novo a partir do snapshot autorizado atual; não restaurar recursos do canvas encerrado. Depois de consumir a tentativa, apresentar recuperação manual sem repetição automática. Identificar cada tentativa por geração e invalidar callbacks antigos ao falhar ou desmontar.

Preservar câmera/alvo da mesma mesa, seleção e preferências pessoais. Suspender controles visuais inválidos e aplicar a limpeza idempotente do item 44. Recolher ferramentas para expor o aviso no celular; manter notas e mapa 2D acessíveis. Não usar a recuperação para repetir uploads ou transformações.

## Consequências

O usuário recebe uma saída clara quando o navegador permanece sem WebGL. A reconstrução pode refazer downloads/decodificações; o cache e a fila existentes continuam valendo. Somente alterações confirmadas são garantidas no banco. Uma recuperação bem sucedida não renova a tentativa automática dentro da mesma entrada, evitando ciclos de falha contínuos.

Não há dependência, API externa, migração ou mudança de persistência. Evidências e limites em [WEBGL_RECOVERY.md](../WEBGL_RECOVERY.md).
