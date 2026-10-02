# 008 — Transações de operações da aplicação

- Estado: aceita
- Data: 2026-10-01
- Escopo: item 34; complementa migrações (006) e backups (007)

## Decisão

Conservar o armazenamento SQLite atual de JSON, pacotes e BLOBs. Usar uma transação síncrona para operações com escritas relacionadas em várias tabelas, publicar eventos e resposta de sucesso após a confirmação e preservar o erro original quando o SQLite já tiver revertido.

Incluir conta e primeira sessão numa transação. Incluir alteração/remoção de participação, limpeza de turnos/posição, revogação de convites e aumento único da revisão numa transação. Não excluir pacote 3D ainda referenciado por outro objeto da mesma mesa.

Preservar o histórico transacional de notas e a independência da coleção de imagens. Um upload concluído não é desfeito por falhar um salvamento posterior de nota. A remoção de participantes conserva conteúdo para um eventual retorno e retira as posições.

## Verificação e limites

A revisão abrangeu todos os caminhos persistentes de `server/app.js`; a matriz está em [TRANSACTIONS.md](../TRANSACTIONS.md). Três testes observam HTTP/SSE sob falhas temporárias de SQLite, limite de tamanho e reinício. Erros nos três caminhos corrigidos foram reproduzidos antes das alterações. Validação local também comparou promoção recusada/completa em desktop e celular.

A API mantém a arquitetura de instância única. Transações não incluem trabalho assíncrono de scrypt/decodificação nem anulam um COMMIT porque a conexão caiu. Backups no sistema de arquivos e rascunhos locais continuam sob seus procedimentos próprios. Não foram adicionados esquema, dependência, serviço externo ou UI.
