# 013 — Manutenção limitada e propriedade de exportações

- Estado: aceita
- Data: 2026-10-02
- Escopo: item 39

## Decisão

Manter as validades existentes e deslocar a limpeza de sessões do heartbeat SSE para uma rotina própria, com início e encerramento explícitos. Remover sessões e convites vencidos em lotes de até 100 por rodada, com índices SQLite criados pela migração 003. Uma falha da manutenção não interrompe operações válidas da API.

Cada processo grava suas exportações numa pasta privada com marcador de propriedade. A recuperação após encerramento abrupto só exclui arquivos conhecidos quando o dono comprovadamente não está ativo. Processos concorrentes, identidade desconhecida, links ou conteúdo inesperado são preservados e geram aviso controlado. Diretórios do formato anterior não são apagados automaticamente porque não há prova do dono.

## Consequências

A limpeza pode levar mais de uma rodada após acúmulo grande. Um processo encerrado com PID reutilizado ou uma pasta sem marcador pode continuar ocupando espaço até revisão manual; preservar um arquivo incerto evita apagar trabalho ativo. A verificação de PID pressupõe uma pasta temporária local do host, não um compartilhamento entre máquinas. Não há nova dependência, serviço externo, prazo de sessão ou API pública.
