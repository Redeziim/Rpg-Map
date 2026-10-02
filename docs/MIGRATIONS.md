# Migrações de banco e mesas

O servidor atualiza formatos conhecidos **antes de abrir a API**. Banco, registro de migrações e estados das mesas são gravados na mesma transação SQLite. Um erro reverte a atualização inteira; o servidor não abre sobre uma migração parcial.

## Versões atuais

| Formato | Identificação | Migração |
| --- | --- | --- |
| Legado | `user_version=0`, `application_id=0` e esquema conhecido | Atualiza para banco 2 e estado 1 |
| Banco anterior | `user_version=1`, identificador `GRIM` e esquema/ledger conhecidos | Acrescenta a tabela de registro; mantém estado e revisão das mesas |
| Banco atual | `user_version=2`, `application_id=0x4752494d` (`GRIM`) | Conferido; não regravado se já estiver atualizado |
| Estado de mesa atual | `stateVersion: 1` no JSON persistido | Conferido; novos estados já nascem nessa versão |

O número sozinho não basta: o esquema efetivo e o histórico também são conferidos. Uma versão futura, esquema desconhecido, histórico inconsistente, referência quebrada ou estado incompatível impede a abertura. Não altere os marcadores manualmente para contornar esse erro.

## Antes de atualizar o projeto

1. Crie um backup com a versão que executa o banco e guarde SQLite e manifesto.
2. Restaure em **um caminho novo** e teste esse caminho com o novo código, seguindo [RESTORE.md](RESTORE.md).
3. Confira notas, mapa, fichas, permissões, arquivos 3D e sincronização na cópia.
4. Pare o serviço ativo e faça um backup final antes da atualização. Use uma única instância de servidor por banco, como definido em `ONLINE.md`.

No primeiro início bem-sucedido, o terminal informa somente quantas migrações e mesas foram atualizadas. Não imprime conteúdo das notas, nomes ou credenciais. Reiniciar um banco atualizado não cria novas entradas de migração nem aumenta a revisão das mesas novamente.

## Migração 001 do banco

`server/databaseMigrations.js` registra `001-versioned-database`, cria as tabelas de biblioteca/histórico de notas quando ausentes e acrescenta:

- `schema_migrations`: número, nome e data da migração do banco;
- `room_state_migrations`: mesa, versão anterior/nova, revisões anterior/nova e data.

Contas, sessões, convites, papéis, arquivos 3D, BLOBs de imagens e histórico de notas existentes são preservados. As versões históricas não são reescritas para parecer que já usavam o formato novo. As tabelas de dados anteriores conservam o mesmo DDL.

## Migração 002 do banco

`002-room-audit` acrescenta somente `room_audit`, com autoria, tipo, metadados permitidos, data, sequência e revisão. Estados permanecem na versão 1; esta migração não aumenta a revisão de mesas existentes nem cria registros fictícios. Inicialização e backup conferem o formato do registro e sua retenção de até 1.000 entradas por mesa.

O DDL original da migração 001 permanece em `DATABASE_SCHEMA_V1_SQL`, separado do esquema atual. Recuperação identifica o banco 1 pelas tabelas e ledger correspondentes, mantendo as contagens e a identidade esperadas nos seus manifestos. Restaurar preserva os bytes da origem; o servidor migra somente a cópia ao abri-la. Consulte [registro da mesa](ROOM_AUDIT.md).

## Migração 001 do estado das mesas

`server/roomState.js` converte cada documento sem versão para `stateVersion: 1` e o grava no SQLite. A revisão aumenta **uma vez**, junto do registro da migração.

- Textos antigos sem caderno viram a nota `legacy`, com o mesmo conteúdo e acesso privado. O texto original permanece no campo de compatibilidade.
- Notas existentes mantêm identificadores, nomes, corpos, versões, compartilhamento, imagens, vínculos e ordem. Quadros recebem explicitamente largura/altura e listas antes implícitas.
- Fichas e perfis dos participantes recebem os campos ausentes, sem substituir valores existentes. Cadernos de usuários que saíram da mesa permanecem armazenados; os filtros de acesso continuam em vigor.
- Campos ausentes de mapa, névoa, posições, legenda, rotas, cenas, objetos 3D e turnos recebem os padrões já usados pela aplicação.
- Traços antigos sem indicação de acesso ficam explicitamente em `table`, mantendo seu comportamento público anterior; traços `master` continuam privados.
- Imagens e arquivos não são decodificados, redimensionados ou publicados de novo. Campos extras de uma importação são preservados.

Valor inválido em campo existente gera erro, em vez de apagar ou substituir o conteúdo. A migração não cria versões fictícias no histórico de notas. Ao editar uma nota migrada, o histórico normal pode registrar a versão anterior como baseline.

Os endpoints antigos `masterNotes` e `observations` continuam aceitos. A escrita atualiza a nota `legacy` correspondente, mantém suas permissões e salva texto/nota/histórico na mesma transação. Novas notas salvam explicitamente as dimensões do quadro; novos traços salvam a visibilidade. A leitura deixa de reconstruir cadernos e legenda como conversão de formato.

## Falha ou retorno à versão anterior

Se a migração falhar, pare e corrija a causa numa cópia do backup. O erro não precisa que seja apagado qualquer registro para tentar novamente: as mudanças da tentativa foram revertidas. O JSON do banco anterior permanece disponível para investigação.

Não execute código antigo sobre o banco já migrado nem baixe `user_version` manualmente. Para retornar, pare o servidor, guarde um backup do banco migrado e use o backup anterior com a versão de código correspondente. Não há downgrade nem merge automático; escritas posteriores à migração precisam ser preservadas antes do retorno.

Backups anteriores à migração continuam reconhecidos pelo recuperador. Manifestos antigos sem contagem de versões de estado também são aceitos para bancos legados, sem ignorar SHA-256, esquema ou contagens. A restauração não migra a origem; somente o servidor que abre a cópia faz a atualização.

## Acrescentar uma versão futura

1. Preserve os descritores e o DDL das versões já publicadas; acrescente uma migração numerada nova.
2. Registre o esquema compatível da versão anterior em `databaseSchemaIdentity` antes de aumentar `DATABASE_USER_VERSION`.
3. Para estado, acrescente a transformação da versão anterior, preserve conteúdo e acesso, e atualize o ledger e `ROOM_STATE_VERSION`.
4. Atualize a criação de estados novos e todos os caminhos de escrita afetados. Não faça migração somente em GET ou no navegador.
5. Mantenha backup/restauração compatíveis com as versões suportadas e acrescente um ensaio de migração, reinício, falha/rollback e API.

Execute `npm test` e `npm run build` e confira o site com uma cópia migrada em desktop e celular. Os três testes de `tests/databaseMigrations.test.js` incluem legado real de SQL/JSON, três etapas de esquema antigo, conservação de dados, reinício sem duplicação, rollback, início concorrente, restauração de manifesto antigo, API e SSE.
