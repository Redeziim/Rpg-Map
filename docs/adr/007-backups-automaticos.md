# 007 — Backups automáticos e retenção

- Estado: aceita
- Data: 2026-10-01
- Escopo: item 33; complementa recuperação (005) e migrações (006)

## Decisão

Ativar pelo ambiente de execução (`BACKUP_DIR`), com intervalo, retenção, nova tentativa e timeout configuráveis fora do código. Sem essa variável, a função fica desativada. A API agenda um processo filho usando o recuperador já existente; a cópia e as verificações SQLite não rodam no event loop HTTP.

Usar um SQLite operacional na pasta dedicada para identidade, resultado e lock transacional. Não armazenar conteúdo da aplicação nesse controle, nem alterar o esquema ou a persistência do banco de mesas. O lock coordena processos e cai com eles; não depende de remoção de arquivos de lock por PID.

Reconhecer cópias pela identidade do manifesto e pelo registro operacional, conferir todos os pares antes de limpar e manter pelo menos duas cópias. Preservar manualmente criados, desconhecidos, links simbólicos e material com falha de conferência. Remover somente arquivos exatos da pasta resolvida; nunca recursivamente. Uma nova cópia válida é publicada antes de aplicar retenção; ela é mantida mesmo com relógio recuado.

Persistir falhas quando o controle permitir; emitir `ALERTA:` no stderr e oferecer CLI de saúde com código 1 para falha/ausência/atraso. Integrar notificações ao monitor da hospedagem, sem enviar conteúdo privado a um serviço externo por padrão. Disponibilidade HTTP e saúde de backup são checagens separadas.

## Consequências

O serviço deve estar ligado para agendar; ao voltar, executa a rodada vencida. Cada pasta pertence a um caminho de banco; uma troca de `DB_PATH` usa outra pasta. A retenção pode exceder o limite durante falhas, priorizando conservação. Uma cópia local não protege contra perda do volume e precisa de armazenamento fora da máquina.

O volume exige locks SQLite e hard links. O worker limita concorrência e tempo, mas a leitura/verificação ainda usa disco e CPU. O comando de saúde verifica estado e metadados do último par; a conferência completa continua no comando de recuperação.

Procedimento e configuração em [AUTOMATIC_BACKUPS.md](../AUTOMATIC_BACKUPS.md). Evidência da entrega registrada no item 33 do plano.
