# 018 — Qualidade pessoal e interpolação visual

- Estado: aceita
- Data: 2026-10-02
- Escopo: qualidade do item 49 e movimento remoto do item 67

## Decisão

Preservar os arquivos originais e preparar a representação leve no cliente, com simplificação em worker e redução de texturas. Automática é o padrão; Original/Leve manuais prevalecem. Preferência pessoal por conta/mesa no navegador.

Interpolar transformações recebidas por 180 ms fora do estado React, sem publicar poses intermediárias. Conservar edição local imediata e preferência de movimento reduzido, com ativação explícita opcional nesta sessão.

## Consequências

Sem migração, API externa ou alteração de backup/exportação. `meshoptimizer@1.3.0` é local MIT. Primeira leitura/download ainda usa o original; LOD por distância/carga espacial permanecem. Movimento não remove atraso de rede. Limites e evidências em [TABLETOP_QUALITY_AND_MOTION.md](../TABLETOP_QUALITY_AND_MOTION.md).
