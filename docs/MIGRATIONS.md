# Migrações de banco e mesas

O servidor atualiza formatos conhecidos **antes de abrir a API**. Banco, registro de migrações e estados das mesas são gravados na mesma transação SQLite. Um erro reverte a atualização inteira; o servidor não abre sobre uma migração parcial.

## Versões atuais

| Formato | Identificação | Migração |
| --- | --- | --- |
| Legado | `user_version=0`, `application_id=0` e esquema conhecido | Atualiza para banco 7 e estado 7 |
| Banco 1 | `user_version=1`, identificador `GRIM` e esquema/ledger conhecidos | Acrescenta registro e índices; estado 1 recebe a migração 002 |
| Banco 2 | `user_version=2`, identificador `GRIM` e esquema/ledger conhecidos | Acrescenta os índices de vencimento e confirmações; estado 1 recebe a migração 002 |
| Banco 3 | `user_version=3`, identificador `GRIM` e esquema/ledger conhecidos | Acrescenta confirmações de importação 3D e índice; estado 1 recebe a migração 002 |
| Banco 4 | `user_version=4`, identificador `GRIM` e esquema/ledger conhecidos | Acrescenta histórico, confirmação e última animação de rolagens |
| Banco 5 | `user_version=5`, identificador `GRIM` e esquema/ledger conhecidos | Acrescenta confirmações de combate e índice de vencimento |
| Banco 6 | `user_version=6`, identificador `GRIM` e esquema/ledger conhecidos | Acrescenta biblioteca binária de mídia das cenas |
| Banco atual | `user_version=7`, `application_id=0x4752494d` (`GRIM`) | Conferido; não regravado se já estiver atualizado |
| Estado 1 | `stateVersion: 1` no JSON persistido | Migração 002 acrescenta grupos, versões e bloqueios 3D |
| Estado 2 | `stateVersion: 2` no JSON persistido | Etapa 003 acrescenta listas de vínculos aos objetos 3D |
| Estado 3 | `stateVersion: 3` no JSON persistido | Etapa 004 acrescenta iluminação da Mesa 3D |
| Estado 4 | `stateVersion: 4` no JSON persistido | Etapa 005 reúne o combate confirmado |
| Estado 5 | `stateVersion: 5` no JSON persistido | Etapa 006 acrescenta efeitos, conservando os campos e a versão de alteração do combate |
| Estado 6 | `stateVersion: 6` no JSON persistido | Etapa 007 acrescenta arquivo opcional às cenas e apresentação parada; conserva combate/efeitos integralmente |
| Estado de mesa atual | `stateVersion: 7` no JSON persistido | Conferido; novos estados já nascem nessa versão |

O número sozinho não basta: o esquema efetivo e o histórico também são conferidos. Uma versão futura, esquema desconhecido, histórico inconsistente, referência quebrada ou estado incompatível impede a abertura. Não altere os marcadores manualmente para contornar esse erro.

## Antes de atualizar o projeto

1. Crie um backup com a versão que executa o banco e guarde SQLite e manifesto.
2. Restaure em **um caminho novo** e teste esse caminho com o novo código, seguindo [RESTORE.md](RESTORE.md).
3. Confira notas, mapa, fichas, permissões, arquivos 3D e sincronização na cópia.
4. Pare o serviço ativo e faça um backup final antes da atualização. Use uma única instância de servidor por banco, como definido em `ONLINE.md`.

No primeiro início bem-sucedido, o terminal informa somente quantas migrações e mesas foram atualizadas. Não imprime conteúdo das notas, nomes ou credenciais. Reiniciar um banco atualizado não cria novas entradas de migração nem aumenta a revisão das mesas novamente.

## Migração 001 do banco

`server/databaseMigrations.js` registra `001-versioned-database`, cria as tabelas de biblioteca/histórico de notas e feedback quando ausentes em bancos legados e acrescenta:

- `schema_migrations`: número, nome e data da migração do banco;
- `room_state_migrations`: mesa, versão anterior/nova, revisões anterior/nova e data.

Contas, sessões, convites, papéis, arquivos 3D, BLOBs de imagens e histórico de notas existentes são preservados. As versões históricas não são reescritas para parecer que já usavam o formato novo. As tabelas de dados anteriores conservam o mesmo DDL.

## Migração 002 do banco

`002-room-audit` acrescenta somente `room_audit`, com autoria, tipo, metadados permitidos, data, sequência e revisão. Estados permanecem na versão 1; esta migração não aumenta a revisão de mesas existentes nem cria registros fictícios. Inicialização e backup conferem o formato do registro e sua retenção de até 1.000 entradas por mesa.

O DDL original da migração 001 permanece em `DATABASE_SCHEMA_V1_SQL`, separado do esquema atual. Recuperação identifica o banco 1 pelas tabelas e ledger correspondentes, mantendo as contagens e a identidade esperadas nos seus manifestos. Restaurar preserva os bytes da origem; o servidor migra somente a cópia ao abri-la. Consulte [registro da mesa](ROOM_AUDIT.md).

## Migração 003 do banco

`003-expiry-indexes` cria `idx_sessions_expires` e `idx_invites_expires` para a [manutenção limitada](MAINTENANCE.md). Não remove registros durante a migração, não altera estados ou revisões e mantém os descritores de banco 1 e 2 para verificação de backups anteriores. A limpeza normal inicia depois que a migração termina.

## Migração 004 do banco

`004-model-import-receipts` acrescenta `map_imports` e `idx_map_imports_expires`, para [confirmar/cancelar importações 3D](MODEL_IMPORT_PROGRESS.md). São metadados privados de operação, sem duplicar arquivos. A migração não remove dados, não aumenta revisões de mesas e mantém a versão 1 do estado. Confirmação, arquivo e objeto são gravados na mesma transação de publicação; manutenção remove confirmações vencidas após sete dias.

Os descritores dos bancos 0–3 continuam reconhecidos para backup e restauração; as contagens dos manifestos seguem as tabelas daquela versão, sem acrescentar a tabela nova com zero registros. A restauração preserva a origem; ao abrir a cópia, o servidor aplica apenas as migrações restantes. O teste de importação confirma que o resultado da operação sobrevive a backup/restauração, sem republicar objetos, que o manifesto do banco 3 permanece compatível e que confirmação com JSON inválido impede criar um backup.

## Migração 001 do estado das mesas

A etapa 001 em `server/roomState.js` transforma os documentos antigos de texto/quadros descritos abaixo. A inicialização atual aplica também as etapas 002–006 antes de gravar o resultado como `stateVersion: 6`. A revisão aumenta **uma vez**, junto do registro, sem estados intermediários publicados.

- Textos antigos sem caderno viram a nota `legacy`, com o mesmo conteúdo e acesso privado. O texto original permanece no campo de compatibilidade.
- Notas existentes mantêm identificadores, nomes, corpos, versões, compartilhamento, imagens, vínculos e ordem. Quadros recebem explicitamente largura/altura e listas antes implícitas.
- Fichas e perfis dos participantes recebem os campos ausentes, sem substituir valores existentes. Cadernos de usuários que saíram da mesa permanecem armazenados; os filtros de acesso continuam em vigor.
- Campos ausentes de mapa, névoa, posições, legenda, rotas, cenas, objetos 3D e turnos recebem os padrões já usados pela aplicação.
- Traços antigos sem indicação de acesso ficam explicitamente em `table`, mantendo seu comportamento público anterior; traços `master` continuam privados.
- Imagens e arquivos não são decodificados, redimensionados ou publicados de novo. Campos extras de uma importação são preservados.

Valor inválido em campo existente gera erro, em vez de apagar ou substituir o conteúdo. A migração não cria versões fictícias no histórico de notas. Ao editar uma nota migrada, o histórico normal pode registrar a versão anterior como baseline.

Os endpoints antigos `masterNotes` e `observations` continuam aceitos. A escrita atualiza a nota `legacy` correspondente, mantém suas permissões e salva texto/nota/histórico na mesma transação. Novas notas salvam explicitamente as dimensões do quadro; novos traços salvam a visibilidade. A leitura deixa de reconstruir cadernos e legenda como conversão de formato.

## Migração 002 do estado das mesas

Acrescenta `mapGroups: []` e, em objetos 3D existentes, `version: 1`, `locked: false` e `groupId: null`. Identificadores, nomes, poses globais, pacotes, notas e acesso são preservados. O esquema SQL permanece no banco 4; campos inválidos continuam impedindo a migração inteira.

A etapa 002 definiu originalmente a passagem 1→2; seus registros anteriores continuam válidos. A inicialização atual inclui as etapas 003–005: estados 0–4 chegam diretamente a 5. Cada abertura que migra grava uma única revisão/transação por mesa; reiniciar não repete a gravação. Estados novos já nascem na versão 5 sem ledger fictício.

Recuperação verifica estados 1 pelo contrato migrável em memória, sem gravar no backup ou alterar as contagens do manifesto. Restaurar mantém os bytes da origem; só a API que abre a cópia aplica a migração. Os três testes de [grupos da Mesa 3D](TABLETOP_OBJECTS.md) incluem backup/restauração do estado 1, reinício, persistência dos grupos/bloqueios e conservação do pacote até desaparecer a última referência.

## Migração 003 do estado das mesas

Estado 2→3 acrescenta `references: []` a cada objeto 3D, preservando pose, grupo, bloqueio, versão, identidade e pacote. A validação exige identificadores tipados válidos, caderno para notas, ausência de duplicatas e até 90 vínculos por objeto. Estados 0/1 passam diretamente ao formato 3, sem revisões intermediárias. O ledger registra origem/destino e uma revisão por mesa na mesma transação; reiniciar não repete a gravação. SQLite continua em `user_version=4`.

Recuperação/backup reconhecem os formatos anteriores pelo migrador em memória; não alteram a origem. A suíte mantém os ensaios legados/rollback e a migração 2→3 foi também conferida no banco descartável do navegador. O teste HTTP de vínculos confirma reinício, duplicação, privacidade e exportação no formato atual. Contrato e decisão em [TABLETOP_REFERENCES.md](TABLETOP_REFERENCES.md) e [ADR 025](adr/025-vinculos-3d-e-notas-pessoais.md).

## Migração 004 do estado das mesas

Estado 3→4 acrescenta `tabletopLighting: 'default'`, preservando modelos, vínculos, grupos, poses, bloqueios, pacotes e os demais dados. Os presets válidos são `default`, `bright` e `dim`. Estados anteriores chegam ao formato 4 na transação existente com uma revisão por mesa; reinício não repete a atualização. SQLite permanece em `user_version=4`; os números de versão SQL e JSON são independentes. A câmera é uma preferência pessoal do navegador e não entra na migração.

O teste HTTP de iluminação ensaia a entrada da iluminação a partir do formato 3, conservação, exportação, reinício e ausência de gravação repetida; hoje o resultado inclui também a etapa 005. Os testes gerais mantêm cobertura de formatos antigos e rollback. Contrato em [TABLETOP_LIGHTING_AND_CAMERA.md](TABLETOP_LIGHTING_AND_CAMERA.md), decisão [026](adr/026-iluminacao-compartilhada-e-camera-pessoal.md).

## Migração 005 do estado das mesas

Estado 4→5 reúne `turnOrder`, `turnExcluded`, `turnNpcs` e `activePlayer` em `combat`, com formato 1 e versão de alteração. Preserva a ordem válida e acrescenta uma única vez os participantes que anteriormente só eram materializados na leitura. NPCs conservam identificador/nome/tipo; exclusões seguem as contas e papéis atuais. Ativo existente inicia rodada 1; sem ativo, rodada 0. Iniciativa começa vazia, pois esse campo não existia. Os quatro campos antigos são removidos, sem fontes concorrentes.

Estados 0–4 chegam diretamente a 5, com uma revisão/ledger/transação por mesa e rollback integral em erro. SQL continua no banco 4. Notas, pontos, imagens, modelos, grupos, iluminação e os demais campos são conservados. Estados novos nascem em 5; leituras não reconstroem o combate. Backup/restauração conferem o contrato e os papéis em memória, sem regravar a origem.

O fluxo HTTP integrado de combate cobre migração 4→5, reinício sem repetição, exportação e backup/restauração. O ensaio geral recusa ordem antiga de tipo inválido e conserva o arquivo inteiro. A suíte completa de 130 testes passou. A cópia descartável do navegador migrou uma vez e abriu em 1440/390 px. Contrato em [COMBAT_STATE.md](COMBAT_STATE.md), decisão [028](adr/028-combate-confirmado-e-versionado.md).

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

Execute `npm test` e `npm run build` e confira o site com uma cópia migrada em desktop e celular. Os três testes de `tests/databaseMigrations.test.js` incluem legado real de SQL/JSON, etapas de esquema antigo, conservação de dados, reinício sem duplicação, rollback, início concorrente, restauração de manifesto antigo, API e SSE.

## SQL 005 — histórico da bandeja

Acrescenta `dice_rolls`, `dice_receipts` e `dice_live`, com índices de consulta/vencimento. Não muda o JSON de combate 5. Esquemas e manifestos conhecidos das versões 1–4 conservam suas identidades ao conferir backups; a conversão ocorre ao abrir com o servidor atual. Registros incompatíveis impedem inicialização e recuperação. Contrato e limite de 500 registros/mesa em [DICE_HISTORY.md](DICE_HISTORY.md). Rolagens privadas do mestre ainda aguardam a decisão de produto.

## SQL 006 — confirmações de combate

Acrescenta `combat_operations` e `idx_combat_operations_expires`. Guarda identidade, horário, hash do comando, ação, versão resultante e indicação de mudança, por conta/mesa. A confirmação acompanha a escrita/revisão/auditoria na mesma transação; não copia a ordem de combate nem altera o JSON 5. A migração não aumenta a revisão de mesas já atualizadas.

O descritor imutável do banco 5 conserva as tabelas, índices, fingerprint e contagens de manifestos anteriores. Backups 0–5 continuam reconhecidos; restaurar preserva os bytes, e abrir a cópia aplica somente as migrações restantes. Inicialização e recuperação conferem os metadados persistidos. O teste HTTP integrado confirma rollback de falha durante a gravação da confirmação, restauração de confirmações e abertura de backup conhecido SQL 5 no esquema atual. Contrato em [COMBAT_RECOVERY.md](COMBAT_RECOVERY.md), decisão 030.

## Migração 006 do estado das mesas

O estado 5 contém combate no formato 1. A etapa 006 valida esse documento e o transforma no formato 2, com `effects: []`, conservando ordem, NPCs, exclusões, iniciativa, ativo, rodada e versão de alteração. Não usa os antigos campos de turno nem reconstrói a ordem. Estados 0–4 passam pelas transformações anteriores e recebem o formato completo na mesma gravação/ledger para JSON 6; revisão aumenta uma vez por mesa migrada.

SQL continua 6. Falha de validação impede abertura e reverte toda a transação; reinício de uma mesa atualizada não desconta duração nem repete migração. Backup/restauração de estados anteriores continuam reconhecidos e a origem não é reescrita. Contrato e teste HTTP integrado de restauração/migração 5→6 idempotente em [COMBAT_EFFECTS.md](COMBAT_EFFECTS.md), ADR 031.

## SQL e estado 007 — mídia das cenas

SQL 6→7 acrescenta `scene_media`, com BLOB, metadados e hash por mesa. JSON 6→7 acrescenta `mediaId: null` às cenas existentes e uma apresentação parada. Conserva integralmente o combate no formato 2, suas durações, rodada e versão. Estados anteriores recebem as transformações correspondentes na mesma transação; cada mesa migrada recebe uma única revisão.

Os descritores históricos do SQL 6 continuam imutáveis. Inicialização e recuperação conferem tamanho, hash e referências dos arquivos. Backup/restauração conservam a mídia; exportações aplicam a permissão atual. Teste HTTP integrado confirma reinício, backup/restauração, combate preservado e acesso reservado/público. Contrato em [SCENE_MEDIA.md](SCENE_MEDIA.md), ADR 032.
