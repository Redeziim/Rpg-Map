# Registro da mesa

Em **Mesa → Registro da mesa**, ADM e mestres consultam alterações confirmadas: data, autor e tipo de ação. A lista abre recolhida, começa pelas mais recentes, possui filtro por assunto e carrega registros anteriores em páginas. O ADM precisa estar em modo mestre para usar esse painel.

O registro ajuda a conferir quem alterou a mesa. Ele não desfaz alterações nem substitui o histórico de versões das notas.

## Ações registradas

| Assunto | O que gera registro |
| --- | --- |
| Acesso | Criação da mesa, adição/entrada de participante, mudança de papel, remoção e criação/revogação de convite |
| Mapa 2D | Imagem, pontos, traços, névoa, escala e opção que libera posições compartilhadas (entradas antigas de legenda e rotas continuam legíveis, mas novas não são geradas) |
| Fichas | Modelo/fonte da ficha, valores dos campos, avatar e barras do perfil |
| Notas | Conteúdo de notas do mestre ou compartilhadas e alterações no seu compartilhamento |
| Mesa 3D | Importação, transformação e remoção de objetos |
| Campanha | Criação e edição de cenas, inclusive compartilhamento e arquivamento |
| Turnos | Mudanças de ordem, participantes de combate ou turno ativo |

Os tipos de ação são fixos. O servidor compara o estado anterior com o novo para registrar somente as áreas que realmente mudaram. Uma operação pode ter mais de um registro, todos vinculados à mesma revisão confirmada, como trocar uma imagem e limpar a névoa. Um único salvamento com várias notas alteradas gera no máximo um registro de conteúdo e um de compartilhamento.

Repetir uma entrada por convite quando já participa não gera outra entrada. Mudança de papel para o papel existente e salvamento de campos iguais não geram registros de mudança. Erros, tentativas recusadas e rascunhos sem salvamento não aparecem como alterações confirmadas.

### Conteúdo que fica fora

- Notas pessoais privadas e suas observações legadas não geram metadados para a equipe enquanto permanecem privadas. Compartilhar ou retirar o compartilhamento gera um registro genérico.
- Títulos, corpos e quadros de notas, nomes/descrições de pontos e cenas, valores e rótulos de campos, imagens, arquivos e coordenadas não são copiados para o registro.
- O registro de acesso pode guardar o nome de usuário do participante afetado e seus papéis anterior/novo. Autor e identificador de conta também são guardados.
- Senhas, cookies, códigos/hashes de convite e conteúdo de feedback não entram no registro.
- Movimentos de posições individuais no mapa e preferências locais de interface não são registrados. A opção da mesa que libera posições é registrada.
- Login, logout, limpeza de sessões e rolagens temporárias da bandeja mantêm seus fluxos existentes. Este painel registra ações de mesa, não todos os eventos operacionais do servidor.

## Acesso e sincronização

`GET /api/rooms/:id/audit` verifica sessão, participação atual e papel de ADM/mestre. `mapViewMode=player` recusa a consulta; enviar `master` não concede acesso a um jogador. Rebaixamento ou remoção retira o acesso às próximas consultas. Os registros não são incluídos nos snapshots comuns nem no SSE e não existe endpoint público para criar, editar ou apagar entradas.

O filtro opcional `category` aceita `access`, `map`, `notes`, `sheets`, `tabletop`, `campaign` ou `turns`. `limit` aceita 1–100, com padrão 50. `before` é uma sequência positiva exclusiva. A resposta fornece `entries`, `nextBefore` e `retention`; a interface solicita 25 registros por página. A ordenação usa sequência, mantendo a ordem mesmo com ações no mesmo milissegundo ou relógio recuado.

O painel só busca a lista quando aberto. Uma nova revisão da mesa exibe um aviso para atualizar, conservando a posição de consulta. Ações locais na administração atualizam o painel após sua conclusão. Trocar de filtro reinicia a lista; fechar o painel ou perder o papel cancela a consulta. Erros oferecem nova tentativa. Não há polling adicional nem transmissão da lista inteira em cada evento.

## Salvamento, retenção e migração

O banco passa para `user_version=2`, mantendo `stateVersion: 1` das mesas. A migração `002-room-audit` acrescenta somente `room_audit`. O DDL da versão 1 permanece descrito separadamente; bancos e backups conhecidos da versão 1 continuam verificáveis e restauráveis. Abrir sua cópia no servidor aplica a migração. Mesas, conteúdo, papéis, sessões, arquivos e revisões existentes são preservados; a migração não inventa ações anteriores.

Cada ação auditada grava sua mudança e seus registros na mesma transação SQLite. Falha no registro também recusa a ação; falha posterior no histórico, arquivo ou estado também reverte os registros. Respostas de sucesso e eventos continuam depois do COMMIT. O autor vem da sessão autenticada, e os metadados vêm do servidor; dados enviados pelo cliente não podem substituir essa autoria.

Até **1.000 registros recentes por mesa** são conservados. A remoção dos mais antigos ocorre na transação que acrescenta um registro; novas sequências continuam acima da última, inclusive após reinício e restauração. Backups incluem a tabela e são a forma existente de conservar uma cópia anterior. Inicialização e recuperação verificam tipos, metadados permitidos, autoria, revisão, datas, sequência e limite de retenção.

Não há garantia de imutabilidade contra quem administra diretamente o arquivo SQLite. O painel não permite edição/exclusão, mas não implementa assinatura, cadeia de hashes ou arquivo permanente externo. Uma resposta perdida após o COMMIT mantém a ação registrada; a retomada segue [RECONNECTION.md](RECONNECTION.md).

Nenhuma dependência, serviço externo ou estratégia de persistência foi acrescentada. Faça backup e ensaie a atualização conforme [MIGRATIONS.md](MIGRATIONS.md). Não execute código anterior que desconheça o banco 2 sobre o arquivo migrado; retorno exige a cópia e a versão correspondentes.

## Verificação realizada

Três testes em `tests/room-audit.test.js` usam HTTP e bancos temporários:

1. Autoria, ações administrativas, entrada repetida, ordem/páginas, filtros inválidos, modos, isolamento entre mesas, sessão e acesso após rebaixamento/remoção.
2. Estado de banco 1 restaurado/migrado sem inventar registros; falhas SQLite em auditoria recusam nota, participação e convite; 1.006 mudanças conservam as últimas 1.000 sem duplicar páginas; reinício, backup/restauração e recusa de metadados inválidos.
3. Alterações importantes de estado e privacidade: categorias, notas pessoais excluídas, notas compartilhadas, texto/nomes/imagens ausentes, ações recusadas e salvamentos sem mudança.

Os casos foram desenvolvidos em três ciclos de teste que falha e correção: rota inexistente, alterações ainda sem registro e verificador de backup que aceitava metadados indevidos. Os testes de migração existentes passaram a esperar duas migrações de banco, conservando a versão 1 do estado. A suíte de **83 testes** e `npm run build` passaram; o aviso existente de tamanho do chunk Three.js permanece.

`npm run dev` foi validado em banco descartável, com contas de ADM, mestre e jogador, em 1440 × 1000 e 390 × 844. Foram conferidos abertura por teclado, 25 → 38 registros por paginação, filtro de acesso, filtro vazio, foco visível preservado em atualizar e no fim da paginação, ocultação no modo jogador do ADM e ausência do painel na conta de jogador. Controles mediram 44 px de altura e o título expansível 52 px; página de 382 px e painel de 354 px em viewport de 390 px.

O ambiente dev foi interrompido: o painel informou indisponibilidade. Após reiniciar, o Vite recarregou a página; reabrir a mesma mesa conservou o registro. Uma nota do mestre foi editada e salva pela interface no celular: o painel avisou da revisão e, ao atualizar, mostrou duas entradas de “Nota alterada”, com autor/data, sem título nem corpo. O banco real não foi utilizado e a configuração temporária foi retirada.

A revisão de interface aplicou `frontend-design`, boas práticas de React e [Web Interface Guidelines](https://github.com/vercel-labs/web-interface-guidelines). A lista usa renderização por visibilidade para páginas longas, rótulos semânticos, estados de carregamento/erro/vazio e contraste/foco explícitos. Nenhuma animação nova foi acrescentada. Decisão em [011 — registro de alterações](adr/011-registro-de-alteracoes.md).
