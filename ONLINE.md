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
| Alterar mapa, modelo e notas do mestre | Não | Sim | Sim |
| Adicionar/convidar jogadores | Não | Sim | Sim |
| Atribuir papéis e remover participantes | Não | Não | Sim |

Convites expiram em 7 dias e podem ser revogados. O criador permanece ADM. As notas do mestre não são enviadas para jogadores. A API valida sessão e papel em toda ação, independentemente do que estiver visível na interface.

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

- SQLite em `data/grimorio.sqlite` por padrão. Dados não ficam mais no navegador; contas, sessões e mesas sobrevivem a reinícios do servidor.
- Use uma instância de servidor com esse banco e mantenha o volume entre deploys. Para várias réplicas, é necessária outra estratégia de banco e distribuição de eventos.
- Faça backups regulares com a API de backup do SQLite ou com o serviço parado, incluindo os arquivos WAL quando existirem.
- Os dados locais antigos no navegador são preservados, mas não são importados automaticamente para mesas online.
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
