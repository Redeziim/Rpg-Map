# Retomar a mesa depois de uma queda

O navegador busca novamente a versão atual da mesa quando a conexão de eventos cai. O servidor continua usando SQLite, sessões de sete dias e uma instância de API. Nenhum serviço externo ou fila de salvamento offline foi acrescentado.

## O que aparece na tela

| Situação | Resultado |
| --- | --- |
| Rede ou API indisponível | A mesa indica reconexão. O conteúdo aberto continua disponível; os rascunhos de notas usam as cópias locais existentes. |
| API volta e a sessão continua válida | A tela recebe o estado autorizado atual. Uma nota ou um ponto com versão antiga exige revisão antes de salvar. |
| Sessão expirada ou encerrada | A tela de entrada explica o motivo e preenche o nome da conta anterior. |
| Novo login na mesma conta, sem recarregar a página | A aplicação consulta o acesso atual e retorna à mesa anterior, quando autorizado. Os rascunhos disponíveis dessa conta podem ser recuperados. |
| Login em outra conta | A aplicação abre a lista de mesas; não retoma a mesa nem os rascunhos da conta anterior. |
| Participante removido da mesa | A aplicação volta para a lista de mesas com um aviso. A conta continua conectada. |
| Mestre passa a jogador durante um envio | O novo papel e a visão filtrada entram imediatamente. Uma resposta HTTP antiga não devolve o papel anterior. |
| Confirmação de um salvamento se perde | O texto permanece como rascunho. A aplicação consulta a mesa e pede conferir a versão disponível; não repete o envio automaticamente. |

Depois de recarregar toda a página, escolha a mesa na lista. O destino para retorno imediato após login fica apenas na memória da página; as cópias locais de notas continuam separadas por mesa, conta e sessão da aba.

## Conexão de eventos e acesso

`src/useRoom.js` mantém uma conexão EventSource por mesa. Depois de um erro, fecha a conexão anterior e consulta `GET /api/rooms/:id` antes de abrir outro stream. As tentativas aguardam 3, 6, 12, 24 e depois 30 segundos; um evento de rede disponível ou retorno à aba visível antecipa a consulta quando desconectado. Não há consultas simultâneas de recuperação. Uma requisição HTTP tem prazo de 20 segundos e é cancelada quando a mesa é fechada ou o acesso encerrado.

O primeiro evento `room` de uma nova conexão traz um snapshot completo, inclusive a imagem autorizada. No formato opcional de imagens, campos usam referências e o envelope `roomMedia` fornece suas fontes; o cliente reconstrói o conteúdo completo antes de aplicar a revisão. Eventos posteriores podem usar `mapImageUnchanged`; o navegador reconstrói esse campo a partir do último snapshot aceito. Heartbeats não retransmitem o estado da mesa. Cache ausente é recuperado por consulta sem recibo; detalhes em [reutilização de imagens](MEDIA_TRANSFER.md).

O servidor envia `event: revoked` com `status: 401` quando a sessão deixa de valer e `status: 403` quando a participação foi removida. Encerra o stream em seguida. Uma conexão inicialmente não autorizada recebe o mesmo código na resposta HTTP. Outros erros do stream provocam reconexão, sem afirmar que o acesso foi retirado. A API continua validando sessão, participação e papel em cada ação.

## Versões e envios em andamento

- O hook guarda separadamente o estado visível e o último snapshot confirmado pelo servidor. Edições otimistas não avançam essa referência.
- Uma revisão menor é descartada. Em revisões iguais, o `serverTime` menor também é descartado para os metadados temporários da mesa.
- Enquanto há envios, mudanças comuns de estado aguardam seu término. Mudanças de papel são aplicadas imediatamente; a interface deixa de exibir as ferramentas privadas.
- Os envios permanecem em sequência. Ao finalizar, a tela recebe o snapshot mais recente aceito, inclusive quando precisa desfazer uma alteração otimista recusada.
- Notas e pontos conservam a versão capturada pelo editor. Reconectar não promove um rascunho antigo à versão nova nem resolve seu conflito automaticamente.
- Falha de transporte não prova que o banco deixou de salvar. A aplicação consulta novamente a mesa e mantém o rascunho. Erros HTTP conservam sua mensagem; o aviso da nota informa que o salvamento não pôde ser confirmado.
- Para retomar uma nota, use **Comparar versões**, escolha o conteúdo e só salve se ainda houver alterações. Se a versão da mesa já contém seu texto, a comparação permite reconhecer esse conteúdo sem criar outro salvamento.

Interromper uma requisição no navegador não desfaz um COMMIT já concluído. A API protege notas e pontos com versões e retorna 409 para uma versão antiga. Não há repetição automática de mutações nem garantia de deduplicação para todos os endpoints; confira o resultado antes de repetir uma ação.

## Rascunhos e limites

As notas usam a estratégia local já autorizada: `localStorage` e IndexedDB. As cópias não são publicadas automaticamente. Se ambos os armazenamentos falharem, a janela mantém o aviso e a opção de baixar o rascunho; não há garantia de recuperação após fechar o navegador sem uma cópia disponível. Editores de outras ferramentas mantêm seus próprios comportamentos de recuperação.

SQLite e cookies de sessão sobrevivem ao reinício se o banco e a origem do site forem preservados. A expiração de sete dias não é estendida pela reconexão. Uma mudança de domínio/origem usa outro armazenamento do navegador.

O stream envia o estado atual; não reproduz uma lista persistida de todos os eventos perdidos e não usa um cursor durável `Last-Event-ID`. A última jogada da bandeja é temporária no servidor e pode desaparecer no reinício. Conteúdo de mesa persistido segue o banco. Revisões iguais usam a hora do servidor; não se acrescentou uma política de ordenação entre máquinas com relógios divergentes.

O protocolo de revogação precisa do cliente atualizado. Para publicar esta mudança, publique o build e a API juntos. O modelo continua sendo uma instância de servidor; múltiplas réplicas exigem distribuição de eventos própria.

## Verificação realizada

Três testes em `tests/reconnection.test.js` usam a API e o SSE reais, com bancos temporários:

1. Logout, expiração, remoção de participação e mudança de papel, incluindo ausência de conteúdo privado e acesso atual após login/reinício. O encerramento sem motivo falhava antes da correção.
2. Reinício com a mesma sessão, primeiro snapshot completo, alterações ocorridas durante a queda, privacidade e recusa de versões antigas de nota e ponto.
3. Proxy local descarta a resposta HTTP depois do COMMIT: uma só revisão/entrada de histórico, conteúdo confirmado no SSE, versão antiga recusada e conservação após reinício.

Comandos:

```bash
node --test tests/reconnection.test.js
npm test
npm run build
npm run dev
```

Na validação de 2026-10-01, a suíte completa passou com **77 testes** e o build passou. O teste existente de imagem no SSE agora verifica a porta local pelo endpoint de saúde e solicita outra somente quando o Fetch recusa a porta; essa falha de preparação foi observada na suíte, sem alteração da aplicação.

O navegador foi validado com banco e contas descartáveis em 1440 × 1000 e 390 × 844: API interrompida, edição por outra conta durante a queda, reinício, sessão expirada tanto com stream aberto quanto durante a indisponibilidade, retorno pela mesma conta, login por outra conta e recuperação posterior do rascunho original. A comparação e o salvamento foram operados em tela estreita, com página de 382 px e janela de nota de 374 px.

Um proxy também reteve uma resposta de revisão 16/papel mestre: o cliente recebeu antes a revisão 17/papel jogador, e a resposta antiga liberada não reabriu o caderno privado. Outro envio perdeu a resposta depois do COMMIT: texto conservado no editor, aviso de confirmação ausente, revisão 18, nota versão 7 e histórico sem repetição. Esse caso foi conferido na interface e na API. A instrumentação temporária foi removida. O banco real não foi usado.

A revisão de interface conservou os formulários, rótulos, foco e avisos acessíveis existentes; não acrescentou animações. A decisão está em [009 — retomada de sessão e conexão](adr/009-retomada-de-sessao-e-conexao.md).
