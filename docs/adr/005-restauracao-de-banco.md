# 005 — Recuperação em banco novo

- Estado: aceita
- Data: 2026-10-01
- Escopo: item 31 do plano de confiabilidade

## Contexto

O banco SQLite contém contas, mesas, sessões, histórico e arquivos binários. Na entrega do item 31, o backup existente usava `VACUUM INTO` e `quick_check`, mas não havia comando de restauração, identificação de formato ou ensaio completo da cópia. O banco ainda usava `user_version=0`; migrações explícitas estavam previstas no item 32.

## Decisão

1. Centralizar o DDL existente em `server/databaseSchema.js`, preservando tabelas e estratégia de persistência. A conferência compara o esquema efetivo, além de `user_version` e `application_id`. Aceitar somente o esquema atual, o legado anterior à biblioteca/histórico de notas e a etapa com biblioteca anterior ao histórico. Histórico sem biblioteca é esquema incompleto.
2. Produzir manifesto versão 1 em cada novo backup, com versão do produtor, runtime, identidade do esquema, contagens e checksum. O checksum detecta divergência; não autentica a origem nem cifra os dados.
3. Restaurar apenas para destino novo explícito, sem usar `DB_PATH` como destino e sem opção de sobrescrita. Recusar arquivos associados e origem acompanhada de WAL/SHM/journal. Backups antigos sem manifesto exigem `--allow-legacy`; essa opção não ignora verificações nem manifesto inválido.
4. Validar SQLite, referências, JSON persistido e checksum dos BLOBs de notas. Copiar em estágio local, conferir novamente e publicar arquivos completos por hard link exclusivo, com o relatório primeiro e o banco por último. A origem é aberta em leitura; não se executa checkpoint, migração ou alteração no backup.
5. Preservar todos os registros e bytes do backup, inclusive sessões e convites com seus vencimentos. Testar login, permissões, histórico, imagens, 3D, SSE e edição independente na cópia antes de trocar o `DB_PATH` de um serviço parado.

## Consequências

- O destino precisa de volume com hard links; falha de publicação é informada, sem fallback que sobrescreva arquivos.
- Interrupção de processo pode deixar estágio ou relatório sem banco. A retomada usa outro destino e nova conferência; o procedimento não chama esses restos de sucesso.
- O manifesto e relatório não guardam conteúdo de notas ou credenciais. O SQLite continua sendo uma cópia completa e privada. Modos Unix não substituem ACLs no Windows nem a proteção da pasta de backups.
- A comparação de esquema recusa alterações desconhecidas, inclusive colunas, índices, views e triggers extras. O procedimento documenta a versão do projeto correspondente.
- Não há merge de bancos nem promoção automática da cópia testada. Não há backup automático ou retenção nesta etapa; são o item 33.
- A política foi complementada no item 32 por [migrações numeradas e normalização persistida](006-migracoes-explicitas.md), mantendo compatibilidade do recuperador com os formatos conhecidos da etapa anterior.

## Verificação

Três testes novos cobrem recuperação completa de WAL ativo com igualdade de todos os registros e BLOBs, API/SSE, acesso privado e edição independente; caminhos, arquivos associados, publicação concorrente e CLI; corrupção, versões, esquema, JSON, referências, manifesto e legado. O teste anterior de backup passou a usar uma mesa real em WAL. O procedimento e os relatórios permitem repetir o ensaio fora dos testes.
