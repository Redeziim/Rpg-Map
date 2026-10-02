# Restaurar o banco do Grimório

Este procedimento restaura **todas as mesas** em um arquivo novo. Contas, papéis, sessões, convites, notas, histórico, imagens, arquivos 3D e registros de alterações estão no SQLite. Rascunhos que só existem no navegador e uma rolagem de bandeja ainda em memória não entram no backup.

Banco atual: versão 3. Backups conhecidos das versões 1 e 2 permanecem reconhecidos com seu esquema, ledger e contagens originais; a restauração não migra a origem. Abrir a cópia no servidor acrescenta as migrações pendentes, mantendo conteúdo e revisões das mesas. Consulte [MIGRATIONS.md](MIGRATIONS.md).

## 1. Criar e guardar uma cópia

Também é possível [agendar cópias verificadas com retenção](AUTOMATIC_BACKUPS.md) pelo ambiente do servidor. A cópia automática usa o mesmo formato SQLite/manifesto e o mesmo procedimento de restauração descrito aqui.

Na versão do projeto que usa o banco, execute:

```bash
npm run backup -- /caminho/seguro/campanha.sqlite
```

A origem é `DB_PATH`, ou `data/grimorio.sqlite` quando essa variável não estiver definida. No PowerShell, por exemplo:

```powershell
$env:DB_PATH = 'C:\Grimorio\data\grimorio.sqlite'
npm run backup -- 'C:\Grimorio\backups\campanha.sqlite'
```

Guarde **os dois arquivos**: `campanha.sqlite` e `campanha.sqlite.json`. O manifesto registra data UTC, versão do projeto e de Node/SQLite, esquema, contagens e SHA-256. Não contém senhas, texto das notas ou nomes de participantes.

O backup pode ser criado com o servidor ligado: `VACUUM INTO` captura uma visão consistente, incluindo o WAL. A cópia passa por `integrity_check`, `foreign_key_check`, leitura do JSON e conferência do tamanho/checksum das imagens de notas. A publicação usa arquivos completos, sem sobrescrever caminhos existentes. O diretório de destino deve estar em um volume local que suporte hard links.

O SQLite contém dados privados e credenciais derivadas. Mantenha a pasta restrita à conta responsável, inclusive no Windows; em sistemas Unix os arquivos novos usam modo `0600` e os diretórios novos `0700`. Mantenha cópias fora do servidor. O SHA-256 detecta mudanças no arquivo em relação ao manifesto; não é assinatura nem criptografia.

## 2. Conferir o backup

```bash
npm run restore -- --verify /caminho/seguro/campanha.sqlite
```

Isso abre a origem em leitura, sem criar ou alterar o banco de destino. Banco corrompido, JSON inválido, referências quebradas, esquema desconhecido, versão não suportada ou manifesto divergente encerram o comando com código `1`.

**Versão atual:** o banco usa `user_version=3` e `application_id=0x4752494d` (`GRIM`), e cada mesa tem `stateVersion: 1` persistida. O comando confere esquema, estados e ledgers. Bancos anteriores conhecidos das versões 0, 1 e 2 continuam aceitos; histórico sem biblioteca é recusado como esquema incompleto. Manifestos antigos permanecem compatíveis. Consulte [as migrações e o ensaio de atualização](MIGRATIONS.md).

Para um backup antigo do projeto que não tenha manifesto:

```bash
npm run restore -- --verify /caminho/seguro/antigo.sqlite --allow-legacy
```

Esse modo exige o mesmo esquema conhecido e a mesma integridade. Informa que não existe checksum histórico para comparar. A opção não ignora um manifesto presente e inválido, nem libera outros formatos de SQLite. Guarde uma cópia do arquivo antigo antes de prosseguir.

Não use o arquivo do servidor como se fosse um backup: a restauração recusa uma origem acompanhada de `-wal`, `-shm` ou `-journal`. Não apague esses arquivos para contornar a recusa; gere a cópia com `npm run backup`.

## 3. Restaurar em um caminho novo

```bash
npm run restore -- /caminho/seguro/campanha.sqlite /caminho/teste/restaurado.sqlite
```

Para o legado sem manifesto, acrescente `--allow-legacy`. O destino é obrigatório; o comando **não usa `DB_PATH` como destino**. Recusa banco existente, mesmo vazio, e arquivos associados existentes. Não oferece opção de sobrescrever.

A restauração prepara uma cópia em diretório temporário junto do destino, verifica novamente bytes, checksum, esquema, contagens e integridade, e publica:

- `restaurado.sqlite`: cópia com os mesmos bytes do backup;
- `restaurado.sqlite.restore.json`: relatório de origem, versão, checksum e contagens, sem conteúdo privado.

Se falhar antes da publicação, a origem e qualquer destino anterior permanecem intactos. Se o processo ou a máquina cair, um diretório `.grimorio-recovery-*` ou um relatório sem banco pode ficar no destino: não considere isso uma restauração concluída. Use outro caminho novo e repita a conferência. Sucesso é código `0`, banco publicado e relatório correspondente.

## 4. Testar a cópia isoladamente

Faça este ensaio em sua máquina de manutenção, sem mudar o serviço ativo. Compile o site e inicie um servidor local com a cópia, em outra porta:

```bash
npm run build
NODE_ENV=development HOST=127.0.0.1 PORT=3102 DB_PATH=/caminho/teste/restaurado.sqlite npm start
```

PowerShell:

```powershell
npm run build
$env:NODE_ENV = 'development'
$env:HOST = '127.0.0.1'
$env:PORT = '3102'
$env:DB_PATH = 'C:\Grimorio\teste\restaurado.sqlite'
npm start
```

Abra `http://127.0.0.1:3102/` e confira:

1. `/api/health` responde `{"ok":true}`; uma conta existente consegue entrar.
2. Mesas e participantes têm os nomes e papéis esperados.
3. Uma nota abre com texto, mapa mental, imagens e histórico.
4. O mapa 2D mantém imagem, pontos, rotas, legenda e áreas reveladas.
5. A Mesa 3D carrega um arquivo importado e sua transformação.
6. Uma conta de jogador continua sem acesso a notas e rotas privadas do mestre; duas telas recebem mudanças ao vivo.
7. Em desktop e celular, a mesa abre e os controles continuam operáveis.

Ao abrir um legado, o servidor migra as tabelas e os estados na **cópia**, em uma única transação, antes de abrir a API. O backup original continua intacto. Cada mesa atualizada recebe uma revisão adicional, uma única vez; o relatório `.restore.json` descreve a cópia antes dessa migração. Sessões/convites conservam a expiração original: se tiverem vencido, entre novamente ou crie um convite pela conta autorizada. Não confunda expiração com falha de restauração.

Encerre o servidor de teste com `Ctrl+C`. Mudanças feitas durante o ensaio pertencem só à cópia; para recuperar exatamente o instante do backup, restaure novamente em outro caminho novo.

## 5. Usar a cópia validada

1. Registre o `DB_PATH` anterior e a versão do projeto que o executava.
2. Pare o servidor ativo, incluindo a instância de teste.
3. Faça e guarde um backup final do banco anterior, se ele ainda puder ser lido.
4. Configure `DB_PATH` com o novo banco restaurado e validado. Preserve o caminho anterior para retorno; não copie por cima dele.
5. Reinicie com as variáveis de produção habituais (`NODE_ENV`, `PUBLIC_ORIGIN`, `HOST`, `PORT`), confira saúde, login e mesa.

Para voltar ao banco anterior, pare o serviço, preserve um backup do banco recém-usado e restaure o `DB_PATH` anterior. As escritas feitas depois da troca não são mescladas automaticamente; confira o instante que deseja recuperar antes de retornar.

## Evidência automatizada

```bash
node --test tests/restore.test.js tests/backup.test.js
```

Os três testes de restauração usam bancos novos e descartáveis: ensaio completo a partir de WAL ativo com API/SSE, recusa de sobrescrita e concorrência de publicação, e recusa de corrupção/versão/esquema/JSON/manifesto com compatibilidade legada. Comparam todos os registros, incluindo BLOBs, e verificam que a edição da cópia não altera a origem.

Referências: [cópia consistente com VACUUM INTO](https://www.sqlite.org/lang_vacuum.html), [integridade e referências no SQLite](https://www.sqlite.org/pragma.html#pragma_integrity_check), [SQLite no Node.js 24](https://nodejs.org/docs/latest-v24.x/api/sqlite.html).
