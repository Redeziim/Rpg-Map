# 021 — Confirmar e cancelar importações 3D por identificador

- Data: 2026-10-03
- Estado: aceito

## Contexto

O progresso precisa corresponder aos bytes enviados. Uma resposta pode se perder depois de o modelo ser publicado; abortar HTTP não prova que a transação foi desfeita. Repetir sem conferir pode duplicar um modelo pesado.

## Decisão

Usar XMLHttpRequest nativo para o upload binário e AbortController para o ciclo de vida. Medir somente o envio; preparação e conferência permanecem indeterminadas. Acrescentar uma confirmação privada em SQLite por identificador aleatório emitido pelo servidor, com prazo de operação de três minutos e retenção de sete dias. A migração 004 preserva dados, revisões e descritores dos bancos anteriores.

Publicar arquivos, objeto e confirmação na mesma transação. Cancelamento pendente impede publicação; uma confirmação existente é devolvida, sem desfazer a mesa. Repetição do mesmo identificador confirmado devolve a visão atual sem recriar objetos. Conferir participação atual e autoria em todas as consultas; a permissão de publicação é revalidada após a conferência de conteúdo.

Guardar apenas o identificador pendente no navegador, separado por conta e mesa. Bloquear outro envio quando o resultado está desconhecido; oferecer Verificar resultado e reconciliar após recarga. Não reenviar arquivos automaticamente. Manter clientes sem identificador compatíveis, com seu contrato anterior.

## Consequências

Não muda o transporte/persistência canônicos nem acrescenta API externa ou biblioteca. SQLite recebe uma tabela pequena e índice de vencimento; a manutenção remove registros expirados em lotes. Cancelamento confirmado não deixa pacote parcial; cancelamento após COMMIT precisa informar o objeto já adicionado. Perder o identificador local ou deixar sua retenção expirar ainda exige conferir a lista da mesa.

Três testes públicos e o navegador cobrem confirmação, cancelamento, resposta perdida, reinício e backup/restauração. Contrato, evidências e limites em [MODEL_IMPORT_PROGRESS.md](../MODEL_IMPORT_PROGRESS.md). A futura prévia do item 47 deve conservar essa confirmação e a propriedade explícita dos recursos 3D.
