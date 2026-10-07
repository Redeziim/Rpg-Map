# 006 — Migrações explícitas de banco e estado

- Estado: aceita
- Data: 2026-10-01
- Escopo: item 32; complementa [005 — recuperação](005-restauracao-de-banco.md)

## Contexto

O servidor criava tabelas por `CREATE TABLE IF NOT EXISTS` e preenchia cadernos/legenda ao ler uma mesa. O backup reconhecia o esquema, mas o SQLite e os documentos JSON não tinham versão própria persistida. Uma leitura bem-sucedida não provava que o estado armazenado já estava no formato atual.

## Decisão

1. Numerar o banco com `PRAGMA user_version=1` e identificar a aplicação por `application_id=0x4752494d`. Manter o DDL das tabelas de dados e acrescentar ledgers de banco e estado. Reconhecer explicitamente os esquemas anteriores sem numeração; recusar versões/esquemas desconhecidos.
2. Aplicar migrações de SQL e JSON no início, sob `BEGIN IMMEDIATE`, antes de ativar WAL e abrir a API. Reler a versão depois de obter o lock para que inícios concorrentes não repitam a atualização. Falha em qualquer mesa reverte DDL, marcadores, ledgers e estados juntos.
3. Gravar `stateVersion: 1`, normalizar campos anteriormente implícitos e registrar a mudança com aumento único de revisão. Preservar valores existentes, campos extras, conteúdo, versões de notas e acesso. Não reescrever histórico nem binários. Estado já atualizado é validado e não regravado.
4. Novas mesas, fichas e perfis nascem no formato atual. Caminhos de escrita salvam dimensões de quadro e acesso dos traços explicitamente. Endpoints de texto legado mantêm o espelho da nota `legacy` e seu histórico na transação da alteração.
5. Remover a conversão de cadernos e legenda no snapshot. Filtragem por papel, névoa e compartilhamento, e composição de turnos a partir dos participantes atuais, continuam sendo leitura da visão autorizada.
6. Atualizar o recuperador para conferir ambos os formatos e os ledgers atuais. Manter a verificação de manifestos da etapa anterior, inclusive sem `roomStateVersions` para SQLite legado. Restaurar conserva bytes; a migração acontece somente na cópia aberta pelo servidor.

## Consequências

Atualização em 2026-10-03: a [ADR 028](028-combate-confirmado-e-versionado.md) substitui a composição dos turnos na leitura prevista no item 5 por um combate persistido e confirmado. A migração 005 materializa a ordem anterior; alterações de participantes reconciliam o combate na transação de escrita. Filtros de acesso e as demais decisões desta ADR continuam vigentes.

- O primeiro início pode demorar enquanto percorre as mesas. O processamento usa uma mesa por vez; não decodifica arquivos grandes durante a migração.
- Migração de estado ausente para 1 aumenta a revisão uma vez. Versões por ponto e o conteúdo dos pontos são preservados; dados cujo formato foi completado podem exigir nova leitura de um editor antigo.
- Um campo existente com tipo inválido não é corrigido descartando conteúdo: a aplicação não abre até que a cópia seja investigada. Formatos futuros não são reduzidos silenciosamente.
- Backups continuam necessários antes de atualizar o projeto. Não há downgrade, promoção ou merge automático. O retorno usa outro banco e a versão correspondente do código.
- A estrutura está preparada para acrescentar migrações novas; descritores publicados e esquemas compatíveis precisam ser conservados, como documentado em `docs/MIGRATIONS.md`.
- SQLite, npm e a arquitetura do projeto permanecem; nenhuma dependência ou serviço externo foi introduzido.

## Verificação

Três testes novos conferem legado sem biblioteca/histórico, com biblioteca e com histórico; texto, quadros, vínculos, privacidade, binários e campos extras; igualdade de registros preservados; reinício sem regravação; falha em segunda mesa com rollback integral e arquivo intacto; marcadores futuros e ledgers incompatíveis; dois processos de início; manifestos anteriores; API/SSE, novas mesas e escritas atuais. A suíte de 68 testes e o build passaram. Cópia de duas mesas descartáveis foi restaurada de manifesto antigo, migrada em `npm run dev` e aberta em 1440 e 390 px.
