# Reutilizar imagens durante a sincronização

Alterar o texto de uma nota, mover um cartão ou atualizar outro campo da mesa reutiliza as imagens já recebidas. Uma imagem nova continua sendo enviada por inteiro na primeira vez. A tela e os rascunhos recebem o conteúdo completo, como antes.

A mudança corresponde ao item 36 do plano. Não acrescenta serviço externo, dependência, migração de banco ou estratégia de persistência. As imagens antigas continuam no estado SQLite; referências da coleção de notas e arquivos da mesa 3D continuam nas tabelas existentes.

## Imagens incluídas

O protocolo reconhece somente campos declarados como imagem:

- Imagem do mapa 2D, avatares dos perfis e da visão do grupo.
- Valores de campos de imagem das fichas.
- `src` de cartões de imagem nos cadernos autorizados.

Título, texto, legendas e outros campos permanecem literais, mesmo quando contêm uma data URL. Cartões com `assetId` continuam usando a coleção autenticada; modelos 3D continuam sendo buscados separadamente.

## Formato da transferência

1. A API constrói o snapshot autorizado existente, aplicando papel, compartilhamento e névoa antes de reunir imagens.
2. Cada data URL recebe um SHA-256 da sua representação exata. Fontes idênticas no mapa, no quadro ou nos avatares são enviadas uma única vez no dicionário do snapshot. Não há comparação de pixels nem normalização de arquivos visualmente parecidos.
3. Campos de imagem passam a conter `{ "_roomImage": "<hash>" }` somente na transferência. O envelope `roomMedia` contém `version`, a lista completa `hashes` e o dicionário `images` com fontes ainda necessárias ao receptor.
4. O cliente reconstrói as data URLs completas antes de entregar o snapshot aos componentes e ao armazenamento de rascunhos.

Requisições HTTP optam pelo formato com `X-Grimorio-Media: 1`. Depois de aceitar um envelope, o cliente envia `X-Grimorio-Media-Cache` com sua versão. O servidor consulta esse recibo no escopo da mesa e da conta; um recibo de outra conta não suprime imagens da resposta atual. Ele informa conteúdo já recebido, não concede acesso.

No SSE, `?media=1` ativa o formato. Uma nova conexão recebe o conjunto completo de imagens autorizadas. A conexão guarda o manifesto anterior para os próximos eventos. O manifesto é calculado antes da omissão existente de `mapImage` por `mapImageUnchanged`, mantendo a imagem do mapa no conjunto conhecido mesmo quando o campo não precisa ser repetido naquele evento. Heartbeats continuam sem snapshot.

### Salvamentos

O cliente substitui imagens conhecidas do manifesto atual por referências somente nos campos de imagem enviados. O servidor resolve essas referências usando o snapshot autorizado atual e aplica as validações existentes; um hash conhecido de uma nota privada ou de outra mesa não libera sua imagem. A verificação de acesso e de versão da nota ocorre antes de resolver o quadro.

Imagens novas, imagens de um rascunho antigo ausentes do manifesto e conteúdo de versões históricas seguem como data URLs completas. Texto e título nunca são convertidos. Quando somente o texto ou o nome da nota mudou, o editor omite o quadro do salvamento; a API conserva o quadro atual, sob a versão da nota já exigida.

SQLite, histórico de notas, cópias locais e arquivos JSON de rascunho conservam fontes completas. Não são persistidos marcadores `_roomImage` no lugar dos bytes.

## Cache, ordenação e compatibilidade

- O servidor guarda somente conjuntos de hashes: até 128 manifestos, 65.536 entradas no total e cinco minutos de validade. Remoção do recibo ou reinício provoca novo envio das fontes necessárias, sem perder conteúdo.
- O cache do cliente pertence à instância aberta da mesa. Usa `Map`/`Set` e conserva imagens anteriores para respostas HTTP/SSE que chegam fora de ordem. Remove fontes antigas fora do manifesto atual quando o conjunto ultrapassa 40 MiB de caracteres de data URL; esse limite não representa a memória total usada pelo navegador.
- A decodificação ocorre antes de descartar revisões antigas. Assim, uma resposta anterior pode acrescentar bytes necessários a um evento posterior, sem substituir a revisão aceita pela tela.
- Envelope inválido ou fonte ausente limpa o recibo. A consulta de recuperação solicita novamente as imagens completas; rascunhos continuam locais e não são reenviados automaticamente.
- Clientes sem opção pelo formato recebem o JSON original. Um cliente atualizado que recebe um snapshot legado limpa seu recibo e volta a enviar fontes completas, permitindo compatibilidade com a API anterior.
- Respostas regulares da mesa continuam com `Cache-Control: no-store`.

## Coleção de imagens e arquivos 3D

As rotas autenticadas de imagens da coleção e pacotes de modelos agora permitem revalidação pelo navegador com `ETag` e `Cache-Control: private, no-cache, must-revalidate`, além de `Vary: Cookie`. A política permite conservar a resposta no cache privado e exige consultar o servidor antes de reutilizá-la, conforme a [RFC 9111](https://www.rfc-editor.org/rfc/rfc9111.html).

Sessão, participação e disponibilidade do recurso são verificadas antes de responder 304. Uma imagem da coleção ainda precisa ser visível pelas regras existentes de autoria, notas e histórico autorizado. Um recurso sem acesso não recebe 304 mesmo quando o solicitante conhece seu ETag. Conteúdo inalterado recebe 304 sem corpo; conteúdo novo recebe 200 com seus bytes. A imagem protegida pela névoa conserva sua rota e política próprias.

Retirar acesso limita solicitações futuras. Cópias que uma pessoa já recebeu ou salvou não podem ser retiradas do seu dispositivo.

## Verificação realizada

Três testes de integração em `tests/room-media.test.js` usam HTTP/SSE reais e SQLite temporário:

1. Deduplicação entre mapa, quadro e avatares; atualizações sem bytes de imagem; envio somente da imagem alterada; compatibilidade legada e revalidação de pacote 3D.
2. Reconstrução no cliente, referências nos salvamentos sem alterar o rascunho, texto literal, respostas fora de ordem, cache ausente, reinício, histórico completo e recusa de versão antiga.
3. Notas privadas/compartilhadas, névoa, outra conta/mesa, hashes forjados, perda de acesso, imagens da coleção e validação de quadros malformados.

Na validação de 2026-10-01, os **80 testes** da suíte passaram e `npm run build` passou. O build conserva o aviso existente de tamanho do chunk de Three.js.

`npm run dev` foi operado em banco descartável em 1440 × 1000 e 390 × 844. A nota de teste continha a mesma imagem PNG de aproximadamente 1,60 MB no mapa e em um cartão antigo, além de um cartão da coleção. As duas imagens abriram; mover e salvar o cartão manteve o vínculo ao ponto. Um rascunho editado no celular foi recuperado ao sair da mesa, recarregar e retornar; texto e imagens continuaram completos. Reinício da API também recuperou o conteúdo. A página mediu 382 px e a janela de nota 374 px na viewport de 390 px.

### Medição nessa mesa descartável

Valores do corpo JSON sem compressão, registrados por um proxy local de validação:

| Operação | Bytes |
| --- | ---: |
| Snapshot inicial no formato legado | 4.278.626 |
| Snapshot inicial com imagem idêntica deduplicada | 2.141.472 |
| Resposta ao salvar texto com cache aquecido | 3.836 |
| Evento SSE desse salvamento | 3.786 |
| Requisição de texto, sem quadro | 136 |
| Requisição ao mover o cartão, com referência de imagem | 625 |

Após novo carregamento da tela, a imagem da coleção recebeu revalidação 304 com **zero bytes de corpo** e continuou visível. O proxy guardou apenas contagens, revisões e metadados técnicos necessários à medição. A instrumentação ficou fora do produto e foi encerrada depois da validação; o banco real não foi usado.

Os valores demonstram a redução nesse caso com imagem grande repetida; não são um benchmark de FPS, tempo ou memória. A entrada inicial na mesa ainda pode receber o snapshot legado antes do primeiro SSE. Nova conexão e recibos removidos podem transferir imagens completas uma vez. A melhoria não migra data URLs antigas para BLOBs nem muda a importação base64 de modelos 3D, que permanece na etapa 3D do plano.

Decisão: [010 — transferência de imagens](adr/010-transferencia-de-imagens.md).
