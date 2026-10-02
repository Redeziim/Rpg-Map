# Backups automáticos

O servidor pode criar e verificar cópias SQLite em um processo separado da API. O agendamento funciona enquanto `npm start` ou `npm run dev` estiver ligado; se a máquina estiver parada, o próximo início faz a cópia vencida. Não depende de um serviço externo.

## Ativar

Defina as variáveis no ambiente da hospedagem ou no serviço que inicia Node. Use uma **pasta absoluta, privada e dedicada**, fora do diretório público e separada do banco de origem. Não coloque backups no Git.

| Variável | Padrão | Significado |
| --- | --- | --- |
| `BACKUP_DIR` | Ausente: desativado | Pasta persistente que ativa a função |
| `BACKUP_INTERVAL_MINUTES` | `1440` | Uma cópia a cada 24 horas; inteiro de 1 a 525600 |
| `BACKUP_KEEP` | `14` | Cópias automáticas verificadas a guardar; de 2 a 365 |
| `BACKUP_RETRY_MINUTES` | `15`, limitado ao intervalo | Nova tentativa após falha; de 1 ao intervalo |
| `BACKUP_TIMEOUT_MINUTES` | `30` | Prazo máximo do worker; de 1 a 1440 |
| `DB_PATH` | `data/grimorio.sqlite` | Mesmo banco usado pela API |

PowerShell, usando uma pasta de manutenção fora do projeto:

```powershell
$env:DB_PATH = 'C:\Grimorio\data\grimorio.sqlite'
$env:BACKUP_DIR = 'C:\Grimorio\backups-automaticos'
$env:BACKUP_INTERVAL_MINUTES = '1440'
$env:BACKUP_KEEP = '14'
$env:BACKUP_RETRY_MINUTES = '15'
npm start
```

Linux:

```bash
DB_PATH=/data/grimorio.sqlite BACKUP_DIR=/data/automatic-backups \
BACKUP_INTERVAL_MINUTES=1440 BACKUP_KEEP=14 npm start
```

Preserve as demais variáveis de produção, como `NODE_ENV` e `PUBLIC_ORIGIN`. O projeto **não carrega `.env` automaticamente**; `.env.example` documenta as opções. Variáveis com formato/faixa inválidos interrompem o início, em vez de desativar backups silenciosamente. Problemas de disco, pasta ou controle geram alerta do worker e permitem à API continuar atendendo. Remova `BACKUP_DIR` e reinicie para desativar o agendamento, conservando as cópias existentes.

Em Docker, acrescente `-e BACKUP_DIR=/data/automatic-backups` ao comando existente, com `/data` persistente. Os scripts de backup e restauração estão incluídos na imagem. Defina as mesmas variáveis ao usar `docker exec` para consultar o estado.

## O que acontece

1. No primeiro início, cria uma cópia. Nos seguintes, lê o estado anterior e respeita o intervalo, inclusive após reiniciar o processo.
2. Entre rodadas, agenda a próxima conferência em até um minuto, aproximando-a do horário previsto. Nunca abre dois workers do mesmo servidor ao mesmo tempo.
3. Captura o banco ativo, incluindo WAL, com `VACUUM INTO`. Confere integridade, referências, esquema, estados JSON, imagens de notas e SHA-256; publica SQLite e manifesto completos.
4. Confere todas as cópias que pertencem a essa pasta antes da retenção. Mantém as `BACKUP_KEEP` mais recentes e sempre conserva a nova cópia, mesmo se o relógio do sistema recuar.
5. Remove apenas pares automáticos reconhecidos e verificados. Backups manuais, arquivos de outra pasta e arquivos sem identificação são preservados. Não há limpeza recursiva.

Os nomes começam com `auto-grimorio-`, data UTC e UUID. O manifesto `.sqlite.json` tem um identificador de pasta. O controle `.grimorio-automatic.sqlite` guarda somente caminho da origem, identidade da pasta, datas, nomes de arquivos e resultado operacional; não recebe contas, notas ou conteúdo de mesas. É separado do banco da aplicação, que mantém a mesma estratégia de persistência.

O lock transacional desse controle coordena workers de processos diferentes e é liberado pelo sistema operacional se um deles cair. Uma tentativa concorrente informa `busy`, sem criar outra cópia. Isso não habilita múltiplas réplicas da API: mantenha a instância única já exigida pelo projeto. A pasta deve estar em volume local com locks SQLite e hard links; não use uma pasta de rede.

Uma pasta fica vinculada ao caminho canônico de `DB_PATH`. Ao mudar para outro banco restaurado, configure também uma nova pasta de backups. Preserve a antiga. Não apague o controle para misturar históricos.

## Conferir e receber alertas

```bash
npm run backup:auto -- --status
```

O comando imprime JSON com `healthy`, última execução/cópia/sucesso, próximo horário previsto e eventual erro. Retorna código **0** quando o agendamento está saudável; **1** quando desativado, sem cópia, com falha registrada, atrasado, com relógio inconsistente ou com a última cópia/manifesto ausente ou divergente. Usa as mesmas variáveis do servidor.

O estado consulta o controle e a presença/tamanho/identidade do último par; não recalcula seu checksum a cada consulta. Para uma conferência completa, use `npm run restore -- --verify /caminho/auto-grimorio-....sqlite`.

Falhas em criação, validação e retenção produzem **`ALERTA:` no stderr do serviço** e permanecem no controle quando ele ainda pode ser gravado. Falha de início do worker, controle inacessível, interrupção ou timeout também geram alerta nos logs; se a gravação não for possível, o estado anterior pode permanecer até a consulta detectar atraso. A API continua atendendo, e `/api/health` permanece uma checagem de disponibilidade, separada do estado dos backups.

Configure seu monitor de hospedagem para alertar pelo stderr ou pelo código de saída do comando de estado. Sem esse monitor, o aviso fica nos logs; o projeto não envia e-mail, webhook ou mensagem externa. Os diagnósticos não incluem texto de notas, nomes das mesas nem credenciais; podem incluir caminhos locais.

Para antecipar uma cópia e aplicar a retenção:

```bash
npm run backup:auto -- --once
```

Sem opção, `npm run backup:auto` executa somente se estiver na hora. Esses comandos executam uma rodada; o agendamento contínuo pertence ao servidor. `--once` também respeita o lock, retornando `busy` se já houver trabalho em andamento.

## Quando falhar

- **Disco cheio, acesso negado ou origem indisponível:** nenhuma retenção ocorre sem uma nova cópia válida. Corrija o recurso e aguarde a tentativa configurada, ou use `--once`.
- **Retenção falhou depois de publicar a cópia:** a cópia nova fica guardada. A tentativa de manutenção não cria outra antes do próximo intervalo regular, evitando cópias repetidas a cada tentativa.
- **Cópia registrada corrompida ou manifesto inválido/ausente:** a limpeza é interrompida antes de apagar os pares verificados. Preserve e confira o material, recupere o par correto ou configure uma nova pasta dedicada. O limite de quantidade pode ser ultrapassado enquanto a falha estiver pendente.
- **Interrupção durante publicação/remoção:** um manifesto identificado sem SQLite pode sobrar; a próxima retenção concluída remove esse metadado órfão. Um SQLite sem identificação e diretórios `.grimorio-recovery-*` não são apagados automaticamente. Confira-os na manutenção.
- **Encerrar o servidor:** dá até 10 segundos para o worker terminar, depois interrompe. Uma interrupção pode deixar estágio incompleto, sem promover isso a backup válido.

Reserve espaço para as cópias guardadas, uma nova cópia e seu estágio temporário. A verificação de retenção lê todas as cópias reconhecidas; ajuste o intervalo e o limite conforme o tamanho do banco. Guarde também cópias fora da máquina: retenção local não protege contra perda do volume.

Para recuperar, siga [RESTORE.md](RESTORE.md); para atualizar a aplicação, siga [MIGRATIONS.md](MIGRATIONS.md).

## Validação

Os três testes em `tests/automaticBackups.test.js` exercitam WAL, restauração, retenção, arquivos manuais, corrupção, ausência da origem, nova tentativa, relógio, concorrência real, morte do processo com lock, reinício, configuração/pastas/controles inválidos, saúde da API e alertas/códigos da CLI. O navegador é validado com banco e pasta descartáveis; o banco real não é usado.

Referências de implementação: [locks e transações do SQLite](https://www.sqlite.org/lockingv3.html) e [cópia com VACUUM INTO](https://www.sqlite.org/lang_vacuum.html).
