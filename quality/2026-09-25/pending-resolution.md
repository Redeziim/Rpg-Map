# Revisão das pendências de qualidade — 25/09/2026

Base: `6ed28c5` (`main`). Este relatório registra a revisão antes da publicação solicitada em 26/09; as menções a alterações sem commit abaixo descrevem aquela etapa de análise.

## Mudanças

| Pendência do relatório de 24/09 | Implementação | Verificação |
| --- | --- | --- |
| Edições simultâneas de pontos podem sobrescrever dados | A API envia uma versão da lista de pontos e rejeita com HTTP 409 uma gravação baseada em versão antiga. O cliente recarrega o estado; o diálogo preserva o rascunho e mostra o erro para permitir revisão e nova tentativa. | Teste com duas sessões: primeira alteração persiste e chega por SSE; segunda recebe 409 sem substituir a primeira; nova tentativa e permissões verificadas. |
| SSE transmite dados grandes repetidamente | O pulso de 20 segundos passou a ser apenas um comentário SSE, mantendo verificação de sessão e participação. Em atualizações normais, o servidor omite a imagem do mapa quando ela não mudou; o cliente reutiliza a última imagem recebida. | Testes de pulso, revogação e envio da imagem somente após mudança. |
| Mapas dependem do ponteiro | O canvas 2D recebe foco: setas movem, `+`/`-` alteram zoom e `Home` centraliza. A mesa 3D recebe foco: setas giram, `Shift` + setas deslocam, `+`/`-` alteram zoom e `Home` enquadra. Listas e controles existentes permitem abrir pontos e selecionar/editar objetos. | Navegação por teclado verificada no navegador em 2D e 3D, inclusive com geometria importada. |
| Diálogos deixam o foco escapar | O diálogo de novo ponto e a cena de ponto usam `<dialog>` modal, ciclo de `Tab`/`Shift+Tab`, foco inicial, `Escape` e retorno ao controle de origem. | Conferido no navegador em desktop e 390×844: fundo inacessível durante o modal, ciclo de foco e retorno ao gatilho. |
| Carga inicial e custo de renderização 3D | A entrada de conta foi separada da sala; ficha, lançador, bandeja, cena de pontos e mapa 3D têm chunks próprios. A resolução WebGL foi limitada a 1,5 vezes a resolução CSS; antialiasing é desligado acima desse limite. | Build: entrada de 160,38 kB (antes havia um JS único de 1.027,44 kB); mesa principal 101,72 kB; módulos 3D separados. Um OBJ local de 13,75 MB, com material e textura, foi importado e exibido em desktop e 390×844. O objeto temporário foi removido. |

## Bloco de notas colaborativo (pedido posterior)

- A janela foi realinhada e ganhou tema de carvão com bordas douradas, largura maior para texto e quadro expansível. O bloco continua podendo ser arrastado e permite várias notas nomeadas abertas ao mesmo tempo.
- Cada nota pode ser compartilhada com participantes específicos da mesa. Quem recebe a nota a encontra em **Notas compartilhadas**, pode editar texto e mapa mental, e recebe atualizações por SSE. Somente o dono/ADM altera a lista de acesso. A revogação remove a nota aberta e sua cópia local do bloco compartilhado.
- O mapa mental aceita ideias editáveis e móveis, setas entre ideias, traços livres e imagens PNG/JPEG/WebP de até 2 MB. Há alternativas de teclado para mover ideias, conectar e traçar linhas. A API valida tamanho e estrutura do quadro.
- Versões de notas impedem gravação por cima de uma edição mais recente. Rascunhos desatualizados mostram aviso e exigem carregar a versão atual; o quadro fica bloqueado enquanto salva. A colaboração atual é por salvamentos sincronizados, não edição simultânea caractere a caractere.
- A revisão independente do agente apontou perda de desenho durante salvamento, sobrescrita por rascunho antigo e nota revogada mantida localmente. Os três foram corrigidos. Na revisão do site, outro agente identificou eventos SSE descartados enquanto uma gravação estava pendente, versão de pontos calculada antes da fila, conexão inválida após excluir uma ideia, foco deixado atrás da janela e gravação local custosa de imagens; todos foram tratados. A gravação local agora espera uma pausa de 400 ms, descarrega no fechamento da tela e avisa quando a cota do navegador é excedida.

## Validação final

- Suíte automatizada: **22/22 testes passaram**. Os cenários de notas cobrem destinatários permitidos, edição por convidado, revogação, privacidade, versões concorrentes, SSE e quadro com imagem, conexão e traço.
- Build Vite: **passou**. `git diff --check`: **passou**.
- O servidor de desenvolvimento equivalente a `npm run dev` foi iniciado com `node scripts/dev.js` e testado no navegador em `http://localhost:5173/`, com o proxy da API. Como `npm` não está no `PATH` desta sessão, teste e build foram executados com o Node empacotado e os scripts locais.
- No viewport de 390 px, o documento mediu 382 px de largura, sem transbordamento horizontal. O mapa 3D com OBJ importado ficou visível; os controles preservaram foco de teclado.
- O bloco foi inspecionado no navegador em desktop e 390×844; a janela e o quadro permaneceram dentro da largura da tela e os controles do mapa mental apareceram operáveis.
- A revisão encontrou no navegador um conflito de nome entre o ícone de mapa e o tipo nativo `Map`, que deixava a mesa vazia após a última alteração. O ícone foi renomeado, a mesa voltou a carregar e o foco passa para a janela aberta. Não houve novo erro da aplicação no console após recarregar.
- Dados temporários da mesa local de teste foram removidos/restaurados após a inspeção.

## Limites para análise

- A carga e a fluidez **não foram medidas em um aparelho fraco nem com o mapa real do usuário**. O teste usou o OBJ de 13,75 MB já presente no repositório. A biblioteca compartilhada Three.js ainda gera um chunk de 547,33 kB (140,48 kB gzip) e um aviso de tamanho no build; a bandeja 3D faz esse chunk ser carregado ao entrar na mesa.
- A corrida entre dois editores de pontos foi reproduzida por testes de API/SSE. A interface de duas sessões simultâneas para importação e remoção de mapas não foi repetida nesta rodada; os testes anteriores já cobriam sincronização visual de turno e rolagem.
- A edição conjunta das notas foi testada por duas contas em API/SSE, mas não em dois navegadores autenticados simultaneamente. Quando dois usuários editam a mesma nota antes de salvar, o segundo recebe conflito e deve revisar a versão recebida; ainda não há mesclagem automática de texto ou traços.

Nenhum commit foi criado. A revisão do usuário deve considerar especialmente a experiência no dispositivo e com o arquivo de mapa que serão usados na mesa.

## Atualização: atalhos, Cenas e Sobre

- O fundo quadriculado do mapa mental e as linhas decorativas do campo de texto foram removidos. O texto usa fundo uniforme e altura de linha normal, sem o desalinhamento causado pela pauta anterior.
- Copiar e colar continuam usando os comandos nativos do navegador. A edição controlada pelo React impedia `Ctrl+Z`; agora título, texto da nota, ideias e legendas de imagem têm histórico próprio de desfazer (`Ctrl+Z`) e refazer (`Ctrl+Shift+Z`/`Ctrl+Y`). O teste no navegador confirmou copiar, colar, desfazer e refazer sem alterar a nota salva.
- A aba **Cenas** aparece apenas para mestre e ADM. Por enquanto é uma área informativa; vídeos e animações não são enviados nem executados nessa etapa.
- **Sobre** substitui a antiga frase do rodapé. Reúne dicas, alterações recentes e um formulário de feedback. A API guarda as mensagens no SQLite por mesa; cada jogador vê as próprias mensagens, enquanto mestre e ADM veem as da mesa. O texto em elaboração permanece como rascunho local ao trocar de aba.
- Revisão visual em viewport móvel e desktop, com foco, estados vazios e formulário; sem novo erro da aplicação observado. O build passou, `git diff --check` passou e a suíte atual passou **23/23 testes**, incluindo o novo teste de privacidade e persistência do feedback. O servidor continua disponível em `http://localhost:5173/` a partir deste diretório.

Esta atualização também permanece sem commit para análise do usuário.

## Atualização: mapa mental e comandos das ideias

- O mapa mental passou a usar uma linguagem de caderno de campanha: fundo liso escuro, cartões de alto contraste, conexões douradas e somente três ferramentas fixas (**Nova ideia**, **Imagem**, **Caneta**). Os modos separados de selecionar e conectar saíram da barra.
- Duplo clique em uma área vazia cria uma ideia naquele ponto. O fundo pode ser arrastado com o mouse para percorrer o quadro. O cabeçalho move o cartão; o ponto lateral permite arrastar uma conexão até outra ideia ou soltar no vazio para criar uma ideia já ligada. Também há seleção, criação, movimento e conexão por teclado.
- `Ctrl+C` em uma ideia selecionada copia o cartão, e `Ctrl+V` cria uma cópia deslocada. Colar texto externo cria uma ideia; colar uma imagem aceita PNG/JPEG/WebP de até 2 MB. Enquanto o texto de uma ideia está em edição, copiar, colar e desfazer continuam agindo no texto.
- `Ctrl+Z` desfaz criação, exclusão, duplicação, deslocamento, conexões e traços; `Ctrl+Y` e `Ctrl+Shift+Z` refazem. O quadro preserva o foco após excluir ou desfazer uma ideia, para que os próximos atalhos funcionem sem outro clique. O histórico estrutural é local à versão salva da nota; ao carregar uma versão de outro participante, o quadro reinicia esse histórico para não restaurar um estado anterior sobre as ideias recebidas.
- Revisão de interface: nomes acessíveis nos controles, foco visível, alternativa por teclado para os gestos, alvos de toque de 44 px nos controles do cartão, redução de movimento e disposição sem transbordamento horizontal em 390 px. A imagem de prévia está em `quality/2026-09-25/mapa-mental-preview.png`.
- Testes no navegador local: seleção e edição por clique; criação por botão e por duplo clique; arraste de cartão e de fundo; conexão por teclado e por arraste; copiar/colar cartão; exclusão seguida imediatamente de `Ctrl+Z`; desfazer/refazer criação, cópia e movimento. Os cartões temporários foram revertidos, e a nota ficou **Salvo na mesa**.
- O agente de revisão identificou e levou à correção dois casos: desfazer após uma atualização recebida podia restaurar um quadro antigo, e um texto externo igual à legenda de uma imagem copiada podia colar a imagem por engano. Agora o histórico reinicia na nova versão, e a colagem de cartões depende do tipo próprio enviado pela área de transferência; texto externo permanece texto.
- Build Vite passou; suíte automatizada **23/23** passou; `git diff --check` passou. O build ainda emite o aviso já conhecido do chunk Three.js de 547,33 kB. Nenhum commit foi criado.

### Retomada em 26/09

- O teste final de `Ctrl+C` confirmou que a área de transferência recebe `text/plain` e `application/x-grimorio-idea`. `Ctrl+V` duplicou a ideia, e `Ctrl+Z` removeu apenas a cópia. A verificação usou um banco SQLite temporário e uma conta/mesa descartáveis; nenhum cartão de teste foi salvo na mesa original.
- O servidor da mesa original foi reiniciado em `http://localhost:5173/` depois do teste isolado. A sessão anterior do navegador havia expirado durante a pausa, então a página pede login novamente.
- Após os últimos ajustes, o build e **23/23 testes** passaram de novo; `git diff --check` não apontou erro. A revisão independente do agente foi parcial: encontrou os dois defeitos corrigidos acima, mas terminou por limite de uso antes de emitir uma conclusão final. Completei a verificação funcional e de código restante nesta retomada.
