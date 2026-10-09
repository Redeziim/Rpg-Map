# Salvamentos completos

O estado de cada mesa fica em JSON no SQLite. Arquivos de modelos 3D ficam em `map_assets`; imagens da coleção de notas ficam como BLOBs em `note_assets`; versões ficam em `note_versions`. Esses arquivos da aplicação não são publicados em uma pasta separada do banco.

**Atualização do item 37:** ações administrativas e mudanças importantes agora incluem `room_audit` na mesma transação. Todo `saveState` grava JSON/revisão sob transação e registra diferenças permitidas quando recebe o autor da sessão. Criação/adição/remoção de participação e criação/revogação de convite têm registros próprios. Falha em auditoria recusa a ação inteira. A matriz abaixo conserva os achados da revisão original; a extensão e sua cobertura estão em [ROOM_AUDIT.md](ROOM_AUDIT.md).

Uma operação que precisa alterar várias tabelas usa `BEGIN IMMEDIATE` e só confirma depois de concluir todas as escritas. Erro antes da confirmação reverte o conjunto. A resposta de sucesso e os eventos da mesa são enviados depois da confirmação. Se o próprio SQLite já tiver revertido a transação, o tratamento conserva o erro original.

## Revisão dos caminhos de escrita

| Operação | Unidade de salvamento | Resultado da revisão |
| --- | --- | --- |
| Cadastrar conta e entrar | Conta nova e primeira sessão | Corrigido: falha na sessão também remove o cadastro incompleto; cookie só sai após confirmar |
| Entrar em conta existente | Nova sessão | Inserção confirmada antes do cookie; senha é verificada antes da transação |
| Criar mesa | Mesa, participante ADM, ficha/perfil e revisão inicial | Transação existente confirmada por falha na inclusão do criador |
| Adicionar participante ou entrar por convite | Participação, ficha/perfil e revisão | Transação existente confirmada por falha no estado; convite não é consumido por uma falha |
| Remover participante ou mudar papel | Participação/papel, turnos, posição, convites do participante e revisão | Corrigido: uma transação e uma revisão; falha conserva acesso e estado anteriores |
| Importar modelo 3D | Pacote de arquivos, objeto e revisão da mesa | Transação existente confirmada, incluindo o limite real de 20 MB do estado |
| Transformar objeto 3D | Objeto e revisão no JSON | Estado anterior conservado quando a escrita falha |
| Remover objeto 3D | JSON, revisão e remoção do pacote sem outras referências | Corrigido: conserva o arquivo enquanto outro objeto da mesa usar o mesmo pacote |
| Enviar imagem à coleção de notas | BLOB e metadados de uma imagem | Inserção independente e atômica; imagem enviada com sucesso continua na coleção se salvar a nota falhar |
| Salvar ou compartilhar nota | Estado/versão/acesso, histórico anterior/novo e retenção de versões | Transação existente confirmada por falhas na gravação e na limpeza do histórico |
| Texto legado do mestre ou observações da ficha | Texto espelhado, nota `legacy`, histórico e revisão | Transação existente confirmada; falha não altera somente uma das representações |
| Trocar imagem do mapa e reposicionar pontos | Imagem/pontos, limpeza de traços/névoa/escala/posições e revisão | Um estado JSON; decodificação ocorre antes, com nova conferência de acesso/versões após a espera |
| Pontos, traços, névoa, escala, posições, cenas, turnos, ficha e perfil | Campos relacionados no mesmo JSON e revisão | Uma atualização SQLite indivisível; as operações com histórico usam transação explícita |
| Feedback, criação/revogação de convite, logout e limpeza de sessões | Uma inserção/remoção independente | Sem estado/arquivo complementar a confirmar; efeitos de conexão ocorrem depois da escrita |
| Migração de banco e mesas | SQL, marcadores, ledgers e estados | Transação de início já verificada no item 32 |

## Preservação e acesso

Remover alguém não apaga suas fichas/notas armazenadas. Elas deixam de aparecer no snapshot da mesa sem participação; ao ser adicionado novamente, o conteúdo é conservado e a posição anterior não reaparece. Remover ou rebaixar alguém revoga os convites criados por essa pessoa na mesma transação.

Pacotes 3D podem aparecer em mais de um objeto de um banco antigo/restaurado. Excluir uma instância não elimina o arquivo usado pela outra; excluir a última instância remove objeto e pacote juntos. A mudança não cria uma função nova de duplicação na interface.

Enviar uma imagem à coleção e depois salvar sua referência numa nota são duas ações do produto. Um envio concluído permanece na coleção do autor, com as permissões existentes, e pode ser reutilizado. Não se desfaz um envio anterior ao falhar o salvamento de outra ação.

## Limites da garantia

- Manter a instância única da API exigida pelo projeto. Callbacks de transação são síncronos; leitura do corpo, scrypt e decodificação de imagem ficam fora deles. Não colocar `await` dentro de uma transação deste servidor.
- Uma resposta perdida depois de `COMMIT` não desfaz o salvamento. A retomada de conexão/sessão e a revisão de conflitos estão descritas em [RECONNECTION.md](RECONNECTION.md).
- Rolagens da bandeja em memória e rascunhos locais do navegador têm os ciclos já documentados; não são novos registros persistidos nesta revisão.
- Backups e retenção são arquivos operacionais fora do banco de mesas. Seguem a publicação/conferência em estágio e o tratamento de interrupções de [RESTORE.md](RESTORE.md) e [AUTOMATIC_BACKUPS.md](AUTOMATIC_BACKUPS.md); não se afirma que uma remoção já feita no sistema de arquivos seja revertida por SQLite.
- A revisão original do item 34 não mudou esquema, persistência, dependência ou interface. O item 37 acrescenta o registro por migração 002 e sua consulta na interface, conservando SQLite como estratégia de persistência.

## Verificação

Três testes em `tests/transactions.test.js` usam API HTTP e SSE como interfaces de observação. Bancos são descartáveis; funções/triggers temporários só introduzem falhas no limite SQLite e não entram no esquema publicado. Os casos cobrem pacote/objeto, limite real de tamanho, rollback iniciado pelo próprio SQLite, referências compartilhadas, BLOBs, notas, acesso, histórico/retenção, cadastro/sessão, criação de mesa, convite, remoção/papel, uma revisão/evento por operação e reinício.

Os bugs foram reproduzidos antes das correções: arquivo 3D inacessível após remover só uma instância; cadastro presente apesar da falha na sessão; acesso retirado apesar da falha no estado. As verificações de notas confirmaram o comportamento transacional existente.

No navegador, duas mesas descartáveis receberam a mesma tentativa de promoção. Na mesa acima do limite, duas tentativas em desktop/celular conservaram revisão 7, papel Jogador, turno ativo e posição. Na mesa normal, a promoção confirmou revisão 8, papel Mestre, retirada da posição e encerramento do turno, sem remoção de participantes. Conferência HTTP confirmou os resultados; página de 382 px em viewport de 390 px, sem erro de console. Suíte completa de 74 testes e build aprovados.
