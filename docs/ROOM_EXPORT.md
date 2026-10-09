# Cópia portátil de uma mesa

Na aba **Mesa**, abra **Salvar uma cópia da mesa**, escolha **Preparar cópia da mesa**, confira as quantidades e use **Baixar cópia da mesa**. Há cancelamento durante o preparo e descarte do arquivo pronto. A interface funciona por teclado e em telas estreitas.

O resultado é um JSON UTF-8 com `format: "grimorio-room"` e `formatVersion: 1`. Imagens e arquivos estão incorporados, sem depender das URLs autenticadas do servidor. Este formato ainda não tem importação pela interface; a restauração de um servidor continua descrita em [RESTORE.md](RESTORE.md).

## Conteúdo e permissões

| Conteúdo | Jogador e ADM no modo jogador | Mestre e ADM no modo mestre |
| --- | --- | --- |
| Mapa 2D e exploração | Imagem com cobertura opaca, pontos, traços, cenas e posições permitidos | Estado completo do mapa, incluindo conteúdo privado e arquivado |
| Fichas | A própria ficha, modelo de campos e status públicos do grupo | Fichas disponíveis de participantes atuais e status do grupo |
| Notas individuais | Próprias e explicitamente compartilhadas com a conta | Próprias e explicitamente compartilhadas com a conta; o papel administrativo não inclui notas privadas de outras pessoas nesta exportação |
| Caderno do mestre | Notas explicitamente compartilhadas | Caderno completo |
| Histórico de notas | Versões próprias e versões que já estavam compartilhadas com a conta, desde que a nota continue acessível | Mesma regra; histórico completo do caderno do mestre |
| Coleção de imagens | Imagens próprias, inclusive sem uso, e imagens referenciadas nas notas/versões autorizadas | Mesma regra |
| Mesa 3D independente | Objetos e pacotes completos, incluindo materiais, texturas e arquivos auxiliares | Mesmo conteúdo |
| Registro de alterações | Excluído | Últimas entradas retidas pela mesa, até 1.000 |

Vínculos dos cartões a pontos ocultos ou removidos são retirados. O texto de uma nota compartilhada permanece como seu autor o escreveu; o compartilhamento explícito autoriza esse texto. Compartilhar agora não libera versões que ainda eram privadas. O arquivo contém participantes atuais, papéis, revisão da mesa, data e identificação de quem exportou.

Credenciais, sessões, códigos de convite, feedbacks, registros internos de migração, fontes desconhecidas do estado, rascunhos locais e preferências pessoais do navegador ficam fora do formato. A rolagem temporária de dados não constitui histórico persistido da mesa; estruturas antigas presentes no banco são preservadas em `assets.diceStructures`, sem reintroduzir a torre na interface.

## Estrutura

- `viewer`: usuário, papel real e modo efetivo.
- `room`: identificador, nome, revisão e participantes atuais.
- `state`: campos conhecidos da mesa filtrados conforme a tabela.
- `groupBars`: avatares e status públicos, incluindo valores dos campos de recurso.
- `noteHistory`: escopo, identificador da nota e versões autorizadas com conteúdo, quadro, autor e data disponíveis.
- `assets.notes`: imagens como data URLs e metadados de apresentação.
- `assets.models`: pacotes 3D completos, com os mesmos identificadores referenciados pelos objetos.
- `assets.diceStructures`: estruturas legadas armazenadas na mesa.
- `audit`: registros administrativos permitidos.

## API e preparação

1. `POST /api/rooms/:roomId/exports`, com `{viewMode: "master" | "player"}`, prepara uma cópia. Um jogador continua com a projeção de jogador mesmo enviando `master`.
2. A resposta 201 informa identificador, URL de download, nome, tamanho, prazo, revisão, modo efetivo e quantidades.
3. `GET /api/rooms/:roomId/exports/:id` revalida o arquivo antes do clique de download.
4. `GET /api/rooms/:roomId/exports/:id/download` entrega JSON com `Content-Disposition: attachment`, tamanho conhecido e `Cache-Control: no-store`. O arquivo temporário é consumido ao terminar o download; uma nova cópia pode ser preparada.
5. `DELETE /api/rooms/:roomId/exports/:id` cancela/descarta o arquivo daquela sessão.

O identificador sozinho não dá acesso: sala, usuário e sessão precisam coincidir. Sessão, participação, revisão, lista de membros/papéis e sequência do registro são revalidados após o processamento da névoa, durante a escrita e a cada bloco do download. Mudanças concorrentes impedem um arquivo misto ou com permissões antigas. Uma alteração durante o download interrompe a transferência; confira os downloads do navegador e prepare outra cópia.

O servidor escreve em diretório temporário próprio, com criação exclusiva e permissões restritas onde o sistema as suporta. Há backpressure e blocos de 64 KiB; os recursos são lidos por pacote/versão/imagem, sem montar todo o arquivo em um único Buffer ou Blob do navegador. SQLite e o estado existente continuam como fontes canônicas; não há tabela nova, serviço externo ou dependência nova.

Limites: quatro arquivos/preparações por instância, um por usuário, até dois downloads simultâneos por arquivo, 1 GiB por arquivo e cinco minutos de disponibilidade. O limite de tamanho recusa a operação inteira, sem truncar conteúdo. A limpeza roda a cada 30 segundos, após cancelamento, falha, logout, download e encerramento normal. Diretórios de exportação novos deixados por término abrupto são recuperados somente quando a [manutenção](MAINTENANCE.md) comprova que seu processo dono terminou. Diretórios antigos sem marcador são preservados para inspeção manual.

## Validação em 2026-10-01 e 2026-10-02

Três testes HTTP com SQLite e arquivos reais cobrem conteúdo incorporado, pacotes 3D antigos com JSON formatado, histórico, reinício, ausência de alterações na mesa, notas privadas de terceiros, versões anteriores ao compartilhamento, pixels opacos, vínculos ocultos, papéis/modos, acesso entre contas, cancelamento, mudanças de revisão, expiração, logout, remoção/reentrada e cancelamento de uma preparação com pacote de 6 MiB. A suíte completa passou com 86 testes; o build passou. O prazo do cliente de teste foi ajustado para 60 segundos porque o caso com arquivo grande ultrapassou 15 segundos durante a suíte paralela.

`npm run dev` foi testado com banco descartável em 1440×1000 e 390×844: abertura/preparo por teclado, foco no download e retorno, resumo com quantidades, download real, ausência de overflow horizontal e controles de 44 px. Arquivos baixados pelo navegador foram abertos: pacotes OBJ/MTL completos e imagem incorporada; nota privada do jogador ausente no arquivo do ADM; pixels cobertos `[21,25,19]` e revelados `[199,171,118]` no arquivo do ADM em modo jogador. A conta de jogador também baixou sua nota própria e a nota compartilhada do mestre, com somente a versão historicamente compartilhada e sem a imagem privada do caderno do mestre. Revisão com as skills de React, frontend e Web Interface Guidelines.
