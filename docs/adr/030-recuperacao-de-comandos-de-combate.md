# 030 — Recuperação de comandos de combate

Data: 2026-10-04. Estado: aplicado localmente.

## Contexto

O combate versionado impede duas alterações concorrentes sobre a mesma versão. Uma resposta perdida ainda deixa o navegador sem saber se sua própria ação foi aplicada. Reenviar com uma nova identidade ou versão poderia executar outra alteração.

## Decisão

Guardar a identidade e os dados da intenção no navegador antes de enviá-la. Confirmar identidade, comando, combate e revisão na mesma transação SQLite. SQL 006, JSON de mesa 5. Guardar confirmações por sete dias, com limpeza limitada; recusar preparações antigas mesmo depois da limpeza.

Consultar a confirmação por conta/mesa e retornar sempre o snapshot autorizado atual. Na retomada, consultar automaticamente uma vez por conexão; não reaplicar comandos automaticamente. Bloquear outras ações enquanto o resultado for desconhecido. Oferecer reenvio explícito da mesma intenção, com a versão original, ou conferência explícita quando a confirmação expirar.

## Consequências

Uma confirmação antiga não substitui uma ordem mais recente. Rebaixamento conserva a consulta própria para quem continua na mesa; retirada revoga o acesso. Sem confirmação por identidade para clientes legados. Backup preserva metadados; exportação de mesa exclui confirmações privadas. Nenhum serviço externo ou mudança da persistência canônica.

## Evidência

HTTP integrado com resposta perdida, concorrência, reinício/acesso, rollback e backup/restauração SQL 5/6. Suíte 132/132 e teste ampliado aprovados. Build e navegador desktop/celular; contrato e limites em [COMBAT_RECOVERY.md](../COMBAT_RECOVERY.md).
