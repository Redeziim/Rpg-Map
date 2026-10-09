# Contas e mesas online

## Rodar localmente

Requer Node.js 24 ou superior.

```bash
npm ci
npm run dev
```

O comando inicia o site Vite na porta 5173 e a API na porta 3001. Abra o endereço informado pelo Vite. Cadastre uma conta para começar. Não existem usuários ou senhas padrão.

1. Crie uma mesa em **Minhas mesas**. Seu papel nessa mesa será **ADM**.
2. Na aba **Mesa**, adicione um usuário já cadastrado ou gere um convite.
3. Envie o link à pessoa. Ela entra/cria a conta e confirma **Entrar na mesa**.
4. O ADM pode atribuir **Mestre** ou **Jogador**, remover participantes e alternar os dois modos.

O papel é por mesa: a mesma conta pode ser ADM de uma campanha e jogador em outra.

| Ação | Jogador | Mestre | ADM |
| --- | --- | --- | --- |
| Editar própria ficha e observações | Sim | Não | Sim, no modo jogador |
| Consultar fichas completas dos participantes | Só a própria | Sim | Sim |
| Editar fichas de outros jogadores | Não | Não | Sim |
| Alterar imagem e criar, editar ou excluir pontos do mapa 2D | Não | Sim | No modo mestre |
| Desenhar e apagar os próprios traços no mapa 2D | Em áreas reveladas | Sim | Em áreas reveladas no modo jogador; todas no modo mestre |
| Apagar ou restaurar traços de outros participantes no mapa 2D | Não | Sim | No modo mestre |
| Mostrar ou esconder grupos de traços na própria tela | Sim | Sim | Nos dois modos |
| Criar ou alterar traços entre Todos e Só mestres | Não | Sim | No modo mestre |
| Ativar névoa, revelar e cobrir áreas | Não | Sim | No modo mestre |
| Definir escala, unidade e alinhamento da grade | Não | Sim | No modo mestre |
| Mostrar grade e medir distância somente na própria tela | Entre pontos revelados | Sim | Entre pontos revelados no modo jogador; todos no modo mestre |
| Liberar ou desativar posições compartilhadas na mesa | Não | Sim | No modo mestre |
| Compartilhar, mover e remover a própria posição | Com a função liberada, em áreas reveladas | Não | No modo jogador, com a função liberada, em áreas reveladas |
| Consultar mapa, pontos e traços fora das áreas reveladas | Não | Sim | No modo mestre |
| Ler cenas compartilhadas da campanha | Com ponto revelado, ou cena sem pontos | Sim | Nos dois modos, conforme a visão |
| Criar, editar, compartilhar, arquivar e restaurar cenas | Não | Sim | No modo mestre |
| Definir a iluminação da Mesa 3D para todos | Não | Sim | No modo mestre | Não | Sim | Sim |
| Adicionar/convidar jogadores | Não | Sim | Sim |
| Atribuir papéis e remover participantes | Não | Não | Sim |
| Consultar registro de alterações da mesa | Não | Sim | No modo mestre |

Convites expiram em 7 dias e podem ser revogados. O criador permanece ADM. As notas do mestre não são enviadas para jogadores. A API valida sessão e papel em toda ação, independentemente do que estiver visível na interface.

Com névoa ativa, a API e o SSE não enviam pixels originais, pontos ocultos ou coordenadas de traços parcialmente ocultos para contas de jogador. A imagem protegida é gerada localmente por Sharp e enviada em uma rota autenticada com `Cache-Control: no-store`. O ADM mantém seu papel real na API; a interface no modo jogador aplica a mesma cobertura e os mesmos filtros de um jogador. Cobrir áreas limita os próximos envios e não revoga imagens já vistas.

Posições compartilhadas começam desativadas por mesa e exigem escolha individual. A API aceita somente o marcador da conta autenticada, usa versões para impedir alterações antigas e não envia coordenadas ocultas de marcadores pelo GET ou SSE. Retirar o compartilhamento continua permitido quando seu marcador estiver coberto. Desativar a função limpa as posições; trocar a imagem também as limpa. Os marcadores representam locais no mapa da campanha, sem geolocalização ou status de conexão.

Cenas começam privadas e são compartilhadas explicitamente pelo mestre. Jogadores recebem pelo GET e SSE somente cenas ativas, compartilhadas e com pelo menos um ponto visível, ou cenas criadas sem pontos. Identificadores de pontos ocultos são retirados das cenas recebidas. Vínculos a pontos excluídos não tornam uma cena pública para toda a mesa: o mestre precisa revisá-los. O modo jogador do ADM aplica os mesmos filtros na interface. Indicadores de notas e cenas nos pontos contam somente conteúdo disponível para quem está usando a tela.

A API salva cada cena com versão própria; versões antigas são recusadas para revisão. Arquivar e restaurar também exigem a versão atual. Os rascunhos locais não são publicados automaticamente. Cenas são armazenadas no estado SQLite da mesa e entram no backup existente. Limites: 100 cenas por mesa, título de 120 caracteres, texto de 10.000 caracteres e 30 pontos por cena. Consulte [a decisão de visibilidade](docs/adr/002-cenas-e-pontos.md).

### Imagens do mapa 2D

Rotas de exploração, legenda editável e exportação da vista foram removidas em 2026-10-08. O servidor não as aceita mais (`/map-routes` e `/map-legend` respondem 404), e dados antigos de mesas já existentes nunca saem do servidor: não vão para a visão de ninguém, nem para o SSE, nem para uma exportação, e são apagados no próximo salvamento da mesa. Os cinco tipos de ponto têm nome e cor fixos. Detalhes na [decisão 036](docs/adr/036-remocao-de-rotas-legenda-e-exportacao-de-vista.md).

A prévia prepara a imagem no navegador antes do envio, com limite de origem de 20 MB, 16.000 px por lado e 32 milhões de pixels. A API aceita imagens fixas PNG, JPEG, WebP ou GIF de até 5 MB, 4096 px por lado e 8 milhões de pixels. Verifica Base64, assinatura, dimensões e decodificação; arquivos inválidos, incompletos, animados ou acima dos limites são recusados sem alterar o mapa. A validação usa Sharp já instalado no servidor, com uma decodificação por vez e até quatro validações pendentes por aplicação; excesso de fila retorna 503 para tentar novamente.

O navegador envia `mapImageVersion` capturada ao abrir a prévia. Uma versão antiga retorna 409. A API também confere se a imagem ou a permissão mudou durante a decodificação e relê o estado para preservar alterações paralelas em outros campos. O reposicionamento proporcional envia `pointsVersion` junto da imagem e salva os dois na mesma atualização; uma versão antiga dos pontos bloqueia toda a troca. Clientes antigos ainda podem omitir `mapImageVersion`; devem enviá-la para proteger uma prévia aberta. A imagem continua no SQLite e na sincronização existente, sem serviço externo ou mudança na estratégia de persistência. Consulte [os limites e a política de compatibilidade](docs/adr/003-imagens-do-mapa.md).

## Retomar a conexão

Se a API ou a rede cair, a mesa tenta reconectar e consulta o acesso atual. Sessão expirada ou encerrada leva à entrada com um aviso; entrar na mesma conta retoma a mesa anterior enquanto a página continua aberta. Outra conta abre a lista de mesas. Se você foi removido de uma mesa, o aviso aparece nessa lista e sua conta continua conectada.

Rascunhos de notas continuam locais e versões antigas exigem comparação antes de salvar. Uma resposta perdida pode acontecer depois de a alteração ter sido salva: confira a versão da mesa antes de repetir. A aplicação não reenvia automaticamente. Consulte [comportamento, testes e limites da recuperação](docs/RECONNECTION.md).

Notas pessoais são privadas por autoria/compartilhamento explícito também diante de mestre/ADM. Minhas notas está disponível a todos os papéis em todas as abas. O caderno da campanha @master continua gerenciado por mestres/ADM. HTTP e SSE aceitam mapViewMode=master|player mantendo o papel real; a visão de jogador do ADM não envia dados de mestre. Vínculos dos objetos resolvem seus destinos pela autorização atual e não mudam o compartilhamento. Contrato, endpoints e migração do estado para 3 em [TABLETOP_REFERENCES.md](docs/TABLETOP_REFERENCES.md).

## Importar modelos 3D

Em Mesa 3D → Ferramentas, a importação mostra preparação, bytes enviados quando mensuráveis e conferência/salvamento. Cancelar conserva os arquivos selecionados e confere se o servidor já tinha adicionado o objeto. Se o resultado não puder ser consultado, Verificar resultado bloqueia outro envio até esclarecer a operação, inclusive após recarga na mesma conta/mesa. Não há reenvio automático.

O protocolo usa `POST /api/rooms/:roomId/map-imports`, `GET/DELETE /api/rooms/:roomId/map-imports/:id` e `POST /api/rooms/:roomId/map-assets?importId=:id`; publicação exige modo mestre e permissão atual. A confirmação é privada do autor. O banco 4 acrescenta somente a tabela/índice desses metadados; operações pendentes têm três minutos e confirmações vencem em sete dias. Clientes antigos continuam compatíveis sem identificador. Consulte [protocolo, recuperação e limites](docs/MODEL_IMPORT_PROGRESS.md) e [migrações](docs/MIGRATIONS.md).

## Reutilizar imagens

Depois de receber uma imagem, o navegador a reutiliza ao atualizar texto, mover cartões ou sincronizar outros campos da mesa. Fontes novas são enviadas completas; imagens idênticas no mesmo snapshot são deduplicadas. A tela e os rascunhos continuam com imagens completas, e as permissões da mesa são aplicadas antes da transferência.

Imagens da coleção e pacotes 3D são revalidados pelo servidor antes de usar o cache privado do navegador. Se o conteúdo e o acesso permanecem válidos, a resposta evita enviar os bytes novamente. Nova conexão ou cache indisponível pode exigir o envio completo. Consulte [protocolo, medições e limites](docs/MEDIA_TRANSFER.md).

## Registro da mesa

Em **Mesa → Registro da mesa**, ADM em modo mestre e mestres consultam data, autor e tipo de alterações salvas, com filtro por assunto e registros anteriores. A lista guarda até 1.000 entradas recentes por mesa e começa após ativar esta versão. Textos de notas, imagens, valores e códigos de convite não são copiados; notas pessoais privadas ficam fora do registro. Não substitui o histórico de notas nem desfaz ações. Consulte [acesso, cobertura e retenção](docs/ROOM_AUDIT.md).

## Publicar para acesso pela internet

É necessário um servidor Node.js ou hospedagem de contêineres **com disco persistente** e HTTPS. Um serviço de arquivos estáticos sozinho não executa esta aplicação online.

```bash
npm ci
npm run build
NODE_ENV=production PUBLIC_ORIGIN=https://seu-dominio.com DB_PATH=/caminho/persistente/grimorio.sqlite npm start
```

Configure `PORT` conforme a hospedagem. Em produção, `npm start` serve a API e o site compilado na mesma origem. Configure o proxy HTTPS para encaminhar `/api` e `/` à aplicação, desative buffering em `/api/rooms/*/events` e permita conexões de eventos contínuas.

Alternativa com Docker:

```bash
docker build -t grimorio .
docker run -d --name grimorio --restart unless-stopped \
  -p 127.0.0.1:3001:3001 \
  -v grimorio-data:/data \
  -e PUBLIC_ORIGIN=https://seu-dominio.com \
  grimorio
```

Coloque esse contêiner atrás de um proxy HTTPS. `PUBLIC_ORIGIN` deve corresponder exatamente ao endereço usado pelos jogadores, sem barra final. Compartilhe convites somente depois de abrir o site pelo domínio público; links com `localhost` não dão acesso a outros computadores.

## Armazenamento e limites

- SQLite em `data/grimorio.sqlite` por padrão. Contas, sessões e conteúdo salvo das mesas ficam no servidor e sobrevivem a reinícios. Rascunhos de notas usam as cópias locais autorizadas em `localStorage` e IndexedDB; imagens recebidas também podem permanecer no cache privado do navegador.
- Use uma instância de servidor com esse banco e mantenha o volume entre deploys. Para várias réplicas, é necessária outra estratégia de banco e distribuição de eventos.
- O início executa migrações numeradas antes de abrir a API. Banco atual: `user_version=6`, identificador `GRIM`, mesas com `stateVersion: 6`. SQL 004 acrescenta confirmações de importação, SQL 005 acrescenta histórico/confirmações de rolagens, SQL 006 acrescenta confirmações de combate; JSON 004 acrescenta iluminação da Mesa 3D e JSON 005 reúne o combate confirmado e JSON 006 acrescenta condições/efeitos. Suas versões são independentes. SQL, marcadores, histórico de migrações e conversão dos estados são transacionais; erro em qualquer mesa reverte o conjunto. Bancos e manifestos conhecidos anteriores conservam suas identidades/contagens; a atualização ocorre ao abrir a cópia restaurada. Faça backup e teste a cópia antes do deploy; consulte [MIGRATIONS.md](docs/MIGRATIONS.md).
- Execute `npm run backup` regularmente. O comando cria uma cópia SQLite consistente em `data/backups/` mesmo com o servidor em funcionamento e verifica integridade, referências e formato da cópia. Use `npm run backup -- /caminho/backup.sqlite` para escolher o destino. Guarde também o manifesto `backup.sqlite.json`, com versão, esquema, contagens e checksum. Mantenha cópias fora do servidor. Use `npm run restore -- --verify /caminho/backup.sqlite` para conferir e `npm run restore -- /caminho/backup.sqlite /caminho/novo.sqlite` para restaurar sem sobrescrever. Siga o [procedimento de restauração e ensaio isolado](docs/RESTORE.md).
- Os dados locais antigos no navegador são preservados, mas não são importados automaticamente para mesas online.
- Escritas relacionadas de modelos/objetos, notas/histórico, cadastro/sessão e mudanças de participantes usam transações. Alterações de acesso confirmam papel, turnos, posição, convites e uma revisão juntos; uma falha conserva os dados anteriores. Pacotes 3D só são removidos após a última referência da mesa. A coleção de imagens permanece independente do salvamento posterior da nota. Consulte [a revisão dos salvamentos](docs/TRANSACTIONS.md).
- Para agendar cópias no servidor, defina `BACKUP_DIR` absoluto em disco persistente, separado do banco. Intervalo, retenção, nova tentativa e prazo ficam em variáveis do ambiente; padrões: 24 horas, 14 cópias, nova tentativa em 15 minutos. Worker separado, lock entre processos e retenção somente de cópias automáticas verificadas. Falhas geram `ALERTA:` no stderr; consulte `npm run backup:auto -- --status` e configure o monitor da hospedagem pelo código de saída. Sem `BACKUP_DIR`, o agendamento fica desativado. Consulte [configuração e limites](docs/AUTOMATIC_BACKUPS.md).
- Senhas são derivadas com scrypt e salt; sessões usam cookies HttpOnly, SameSite e Secure em produção, com expiração de 7 dias.
- Cadastro usa nome de usuário e senha; recuperação de senha por e-mail ainda não está implementada.
- Limites iniciais: 30 mesas por criador, 200 campos por modelo, 10 MB por requisição e 20 MB de estado por mesa. Prefira imagens compactadas.

## Validar

```bash
npm test
npm run build
```

Os testes de integração cobrem autenticação, acesso entre mesas, permissões, convites, revogação de acesso, privacidade das fichas, eventos e persistência após reinício.

## Bandeja compartilhada

Em **Status do Grupo** ou no painel de dados da ficha, selecione os dados, marque **Jogar na bandeja** e clique em **Pegar dados na mão**. Arraste dentro da bandeja e solte em movimento: a velocidade e a direção do gesto determinam o lançamento. Um clique sem movimento não lança. Mouse e toque são suportados, e **Guardar dados** cancela a preparação.

A bandeja usa os arquivos OBJ, MTL e PNG hexagonais fornecidos pelo usuário, em `public/assets/tray`. As seis paredes de colisão são aproximações planas medidas do modelo. A física usa os poliedros reais dos dados, com gravidade, atrito, colisões entre dados e paredes. A rotação inicial é sorteada em cada lançamento. O servidor calcula a trajetória e lê as faces finais; todos os participantes reproduzem a mesma jogada. Nas outras abas, ela aparece num painel recolhível no canto. A preferência de movimento reduzido mostra a posição final e aguarda o mesmo tempo para divulgar o resultado.

São permitidos até 20 dados físicos (d100 usa dois d10), uma jogada por vez. Dados inclinados, fora da bandeja ou ainda instáveis após 12 segundos exigem novo lançamento e não geram total. A última jogada permanece apenas durante a execução do servidor. A rolagem normal continua disponível com a opção de bandeja desmarcada.

### Motor Dice Box e ajustes

O motor Cannon foi removido. O servidor usa uma adaptação da física do Dice Box 1.1.4 com seu runtime Ammo/Bullet. Não usa a fachada DiceBox/Babylon no navegador: a renderização Three.js foi mantida para o modelo enviado e para reproduzir os mesmos frames para todos. Fonte, licença e alterações estão em `server/vendor/dice-box/README.md`.

Depois de pegar os dados, abra **Ajustar física do lançamento**: gravidade, peso, atrito, quique, perda de velocidade e rotação, força do gesto, força de rotação e altura da mão. Os ajustes são validados no servidor e registrados na jogada. Os limites evitam valores inválidos; combinações extremas ainda podem exigir um novo lançamento.

### Câmera e mão

Os dados ficam ocultos enquanto estão na mão e aparecem apenas no lançamento. As paredes são translúcidas para facilitar a leitura, mantendo as colisões. Use **+ / −** para zoom, as setas para girar/inclinar e **Centralizar** para restaurar a vista. Sem dados na mão, arraste para girar, use o botão direito para deslocar e a roda/pinça para zoom. Com dados preparados, escolha **Mover câmera** para navegar e **Voltar à mão** para arremessar; os botões de câmera também permanecem disponíveis antes do arrasto. A câmera é individual e não altera a jogada compartilhada.

Depois de uma rolagem válida, os participantes recebem um destaque central com todos os dados ampliados e a face registrada voltada para a câmera. O destaque fecha por **Fechar**, clique fora ou Escape; não altera a física nem sorteia novos valores. Números maiores em creme e contorno escuro melhoram a leitura.

## Exemplo de hospedagem no Railway

1. Crie um projeto conectado ao repositório GitHub e mantenha **Root Directory** na raiz do repositório (onde estão `package.json` e `Dockerfile`).
2. Use o `Dockerfile` existente para construir e iniciar o serviço (Node 24).
3. Adicione um volume persistente montado em `/data` e mantenha apenas uma instância do serviço.
4. Gere um domínio público para a porta `3001` e configure `PUBLIC_ORIGIN=https://seu-dominio-gerado`, sem barra final. O primeiro início pode falhar enquanto essa variável não estiver definida; depois de configurá-la, faça novo deploy.
5. Confirme `DB_PATH=/data/grimorio.sqlite`, `NODE_ENV=production`, `HOST=0.0.0.0` e `PORT=3001` nas variáveis do serviço.
6. Abra o domínio, crie sua conta e mesa e envie os convites aos jogadores. Configure backups do volume.

O banco local não é enviado ao GitHub: a hospedagem começa sem contas ou mesas. Consulte os custos e limites atuais do provedor antes de contratar.

Nas outras abas do site, lançamentos aparecem em uma bandeja ampliada no canto, que desaparece 3 segundos depois de os dados pararem. Para lançamentos de outros participantes, essa prévia substitui o destaque central enquanto você está fora de Status do Grupo.

## Mesa 3D compartilhada

Em **Mapa → Mesa 3D**, Mestre e ADM em modo mestre podem importar terreno e estruturas. Jogador e ADM em modo jogador exploram com sua própria câmera e veem as alterações nos objetos ao vivo, sem poder editá-los.

Selecionar os arquivos oferece **Ver prévia**. O modelo aparece na própria cena com contorno dourado e **Prévia — só você**; não é gravado ou sincronizado. Use Mover/Girar/Tamanho ou abra Ajustar por números. Cancelar conserva os arquivos e a mesa. Somente Adicionar à mesa inicia o envio e confirma a transformação mostrada. O tamanho inicial mantém a normalização de 30 unidades para terreno e 5 para estrutura; 1 unidade corresponde a um quadrado da grade. Consulte [prévia, testes e limites](docs/MODEL_PREVIEW.md).

**Ferramentas → Objetos da mesa** permite marcar vários objetos, agrupar, duplicar e bloquear. Grupos têm identidade estável e mantêm as poses ao desagrupar; duplicações reutilizam os arquivos. Bloqueio impede mover/girar/mudar tamanho também pela API. Lotes antigos exigem revisão e preservam o ajuste nesta janela. O primeiro início migra estados antigos em transação, mantendo arquivos e acesso; o esquema SQLite atual é 7, com histórico de rolagens e confirmações de combate. Faça backup e ensaio em cópia antes de atualizar o serviço, conforme [migrações](docs/MIGRATIONS.md). Consulte [contrato e validação dos grupos](docs/TABLETOP_OBJECTS.md).

- Formatos: GLB/GLTF, OBJ com MTL, FBX e PNG/JPG/WebP como planos horizontais.
- Selecione o arquivo principal junto com BIN, materiais e texturas. Os nomes devem ser únicos. Texturas externas precisam acompanhar a importação; não são buscadas na internet.
- GLB com texturas incorporadas é o caminho mais simples. Exporte arquivos Blender como GLB. Extensões de compressão como Draco/KTX2 e reprodução de animações não estão habilitadas nesta versão.
- Limites: 50 MB por importação, até 100 arquivos por pacote, 100 objetos e 300 MB de arquivos por mesa.
- Importe como terreno (normalizado inicialmente para 30 unidades) ou estrutura (5 unidades), depois ajuste a escala. Não há colisões físicas entre estruturas: o mestre posiciona livremente.
- Selecione um objeto na lista ou na cena. Use **Mover**, **Girar**, **Escala** e arraste os eixos, ou edite os valores numéricos. As mudanças intermediárias são transmitidas durante o arrasto; a última alteração recebida prevalece quando dois editores alteram o mesmo objeto.
- Arraste para orbitar, use botão direito para deslocar e roda/pinça para zoom. **Enquadrar**, **Focar objeto** e **Vista superior** ajudam na navegação.
- Objetos, arquivos e transformações ficam no mesmo SQLite persistente da mesa; inclua-os nos backups. Arquivos 3D não são enviados novamente em cada evento de movimento.
- Arquivos locais e downloads usam transporte binário/Blob na versão atual; pacotes e clientes antigos mantêm compatibilidade. Contrato, cache, limites e medições em [docs/MODEL_TRANSFER.md](docs/MODEL_TRANSFER.md).
- A importação confere malhas, referências e texturas antes de salvar; falhas mantêm os arquivos selecionados. Limites de geometria/imagens em [docs/MODEL_VALIDATION.md](docs/MODEL_VALIDATION.md).
- Em **Ferramentas → Qualidade neste aparelho**, escolha Automática, Original ou Leve. A escolha é pessoal e o original fica preservado. Leve reduz malhas/texturas compatíveis depois da leitura inicial.
- **Movimento suave** interpola as alterações recebidas; seu arraste permanece imediato. Respeita movimento reduzido do aparelho por padrão, com escolha nesta sessão. Detalhes em [docs/TABLETOP_QUALITY_AND_MOTION.md](docs/TABLETOP_QUALITY_AND_MOTION.md).
- O mapa 2D e seus pontos continuam disponíveis em **Mapa 2D e pontos**.

## Estrutura de rolagem disponível

As rolagens compartilhadas em **Status do Grupo** usam apenas a bandeja hexagonal. A torre e a importação de estruturas de rolagem não estão disponíveis na interface nem na API de lançamento. A rolagem individual da ficha continua disponível.


## Cópia portátil da mesa

Em **Mesa → Salvar uma cópia da mesa**, prepare e baixe um JSON com dados e arquivos permitidos, incluindo imagens e pacotes 3D incorporados. Notas privadas de outros jogadores não entram; modo jogador conserva a cobertura do mapa. A cópia fica disponível por até cinco minutos e é descartada após o download. Ainda não há importação deste formato pela interface. Formato, permissões, API e limites em [docs/ROOM_EXPORT.md](docs/ROOM_EXPORT.md).

## Cenas de vídeo e animação

Mestre/ADM no modo mestre prepara MP4/WebM/GIF e exibe para os participantes conectados. A liberação ao vivo e a visualização posterior são independentes. Ao bloquear/arquivar/encerrar uma cena reservada, a API e SSE aplicam o acesso atual. Vídeo tenta autoplay silencioso quando o som é bloqueado; movimento reduzido exige entrada explícita. Biblioteca de até 500 MB/mesa, arquivos de até 50 MB, incluída em backup SQLite e exportações autorizadas. SQL/JSON atuais: 7. Veja docs/SCENE_MEDIA.md.
