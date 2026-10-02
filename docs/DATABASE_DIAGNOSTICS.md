# Integridade e ocupação do SQLite

Execute na raiz do projeto:

```bash
npm run db:diagnose
npm run db:diagnose -- --full --json
npm run db:diagnose -- --json /caminho/para/copia.sqlite
```

Sem caminho explícito, o comando usa `DB_PATH` ou `data/grimorio.sqlite`. Ele abre o banco em modo somente leitura e usa uma transação de leitura consistente, inclusive com WAL ativo. Não executa migração, `VACUUM`, correção nem exclusão. `--full` acrescenta `PRAGMA integrity_check` à verificação rápida; referências são conferidas com `PRAGMA foreign_key_check`. Saída 0 indica verificações aprovadas, 1 indica falha ou banco ilegível e 2 indica argumentos inválidos.

O relatório mostra versão do esquema, contagens de tabelas, tamanho físico dos arquivos principal/WAL/SHM, páginas e estimativa de bytes de payload por mesa: estado, modelos, imagens, histórico de notas, registros e estruturas de dados. O tamanho de um pacote de modelo informado na importação aparece separado dos bytes do JSON armazenado. IDs de mesa ajudam a localizar ocupação; nomes, notas, imagens, credenciais e mensagens de erro SQLite não são impressos. Esses bytes são **estimativas de conteúdo**, não o espaço efetivo usado por índices, páginas livres ou WAL. Com gravações concorrentes, os tamanhos físicos podem mudar depois do snapshot de leitura.

Se houver falha, faça uma cópia verificável com `npm run backup` e investigue a cópia com `--full`. Não substitua nem apague o banco ativo com base apenas na estimativa; consulte [RESTORE.md](RESTORE.md) para recuperação. Para uma verificação pesada fora de horário de uso, a cópia feita pelo comando de backup inclui alterações presentes no WAL. Copiar apenas o arquivo `.sqlite` enquanto há um WAL ativo pode deixar dados recentes de fora.
