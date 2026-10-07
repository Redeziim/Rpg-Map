# Cenas: vídeos e animações

## Decisão do projeto

Em 2026-10-04, o usuário definiu Cenas como apresentações de vídeos e animações preparadas pelo mestre. Ao liberar uma cena, ela abre nas telas conectadas e começa a exibição. O arquivo continua salvo; o mestre escolhe separadamente se jogadores podem assistir depois.

Essa definição substitui o escopo anterior do item 56, que propunha associações de notas e participantes. Texto e vínculos com pontos já existentes continuam compatíveis. A apresentação de mídia é independente da névoa do mapa: liberar um vídeo não revela seus pontos. Não cria cena 3D por ponto nem altera combate, notas ou câmera da Mesa 3D.

## Como usar

1. Abra **Cenas → Nova cena** no modo mestre.
2. Informe título, descrição opcional e envie MP4, WebM ou GIF. Também é possível reutilizar um arquivo da biblioteca da mesa.
3. Escolha a permissão posterior: **Só durante a exibição do mestre** ou **Jogadores podem rever em Cenas**. Salve a cena.
4. Use **Liberar e tocar para todos**. Participantes conectados recebem uma janela de exibição, inclusive em outra aba da aplicação.
5. O mestre pode pausar, continuar, recomeçar ou encerrar. Volume, silêncio, tela cheia e minimizar são pessoais.
6. **Permitir assistir depois / Bloquear visualização posterior** muda a disponibilidade do arquivo em Cenas, sem iniciar uma apresentação.

Encerrar uma cena reservada remove o acesso temporário. Uma cena com visualização posterior permitida continua disponível. Arquivar uma cena ou substituir/retirar seu arquivo encerra a apresentação ativa dessa cena. Um arquivo usado por cenas, inclusive arquivadas, não pode ser excluído da biblioteca. Há confirmação para excluir arquivos sem uso.

## Reprodução e limites reais

- Até **50 MB por arquivo**, **100 arquivos ou 500 MB por mesa**, um arquivo por cena. O original é guardado; não há conversão automática nem API externa.
- MP4/WebM dependem dos codecs do navegador. A API confere MIME, extensão, tamanho e estrutura do contêiner; GIF também tem dimensões/quadros limitados. Uma incompatibilidade de reprodução mostra erro e tentativa explícita.
- A apresentação usa posição, horário do servidor, sessão e versão confirmados. Ao carregar/reabrir, o vídeo procura a posição atual. A correção local tolera 0,8 segundo de diferença e consulta a posição a cada segundo enquanto o player está aberto; não há escrita por quadro. Não se promete sincronismo audiovisual exato entre redes/aparelhos.
- Se o navegador bloquear som automático, tenta tocar sem som e oferece **Ativar som**. Se ainda bloquear, oferece **Assistir agora**. Movimento reduzido exige entrada explícita antes de tocar. Não contorna permissões do navegador.
- GIF pode ser exibido e pausado com uma imagem do quadro atual. Ao continuar, o GIF reinicia; não há seek nem sincronização de quadros de GIF. Reabrir a apresentação já pausada não recupera o quadro anterior. Para linha do tempo sincronizada, use vídeo.
- Ao terminar um vídeo, o player mostra que terminou; o mestre pode recomeçar ou encerrar. A liberação temporária dura até encerrar, arquivar ou trocar o arquivo, inclusive após reinício do servidor.
- Reproduções posteriores têm os controles nativos do navegador. A descrição pode incluir falas/transcrição; não há geração automática de legendas nesta entrega.
- Bloquear impede novas leituras e remove o player ao receber a atualização. Conteúdo já recebido ou exportado não pode ser apagado do aparelho do participante.

## Contrato interno e persistência

- `POST /api/rooms/:roomId/scene-media?name=...`: envio binário. Só mestre/ADM no modo mestre; sessão e papel são conferidos novamente após receber/validar os bytes. Deduplica pelo SHA-256 dentro da mesa.
- `GET /scene-media`: biblioteca reservada ao mestre, com metadados e indicação de uso.
- `GET/HEAD /scene-media/:id`: leitura autenticada com permissão atual antes de ETag/Range. Suporta intervalo simples, `206` e `416`, lê apenas a parte solicitada do BLOB SQLite e usa cache privado `no-store`.
- `DELETE /scene-media/:id`: só mestre, somente sem referências salvas. Não elimina uma cena.
- `/campaign-scenes` mantém título, corpo, pontos, visibilidade, arquivo, versão e arquivamento. Novos rascunhos incluem `mediaId`; rascunhos anteriores são normalizados sem perder texto.
- `POST /scene-presentation`: `play`, `pause`, `stop` com versão da apresentação; play/pause também exigem cena, versão da cena e posição. Conflitos não sobrescrevem o comando atual. Não há repetição automática após falha.
- `state.scenePresentation`: `sceneId`, `sessionId`, `status`, `position`, `changedAt`, `version`. Só a sessão/estado confirmado dirige a apresentação.
- Migração SQL **007** acrescenta `scene_media`; JSON **007** acrescenta `mediaId: null` às cenas antigas e apresentação parada. O combate do estado 6 é preservado integralmente; o estado 5 recebe a transformação anterior de efeitos. Tudo migra na transação já existente, com uma revisão por mesa.
- Snapshot/GET/SSE/abertura por vínculo/exportação aplicam a liberação atual. Players não recebem biblioteca privada nem identificadores/nomes de arquivos reservados. Exportação inclui somente a mídia autorizada; cópia do mestre inclui arquivos da biblioteca. Backups SQLite incluem os BLOBs; leitura/restauração confere tamanho, hash e referências.
- Mudanças de apresentação geram apenas `campaign.changed` na auditoria, sem título, descrição ou arquivo. Diagnóstico contabiliza bytes da mídia sem divulgar seu conteúdo.

## Validação

Um teste HTTP integrado (`tests/sceneMedia.test.js`) cobre MP4 real e GIF, envio reservado, deduplicação, arquivo disfarçado, liberação via SSE, papéis/modo jogador, pausa, conflito, Range/HEAD/ETag após revogação, permissão posterior, reinício, exportação filtrada, backup/restauração, arquivo em uso e encerramento ao arquivar. Fixture MP4 de 2.144 bytes gerada localmente, sem rede durante o teste.

Navegador com `npm run dev` e SQLite descartável: upload por seletor real, duas telas com SSE, reprodução/pausa de vídeo, pausa de GIF com quadro 320×180, reserva/liberação/revogação posterior, teclado e larguras 1440/390 px. Evidências em `quality/56-*`. Nenhuma mesa real foi usada na validação.
