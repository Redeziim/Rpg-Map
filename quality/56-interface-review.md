# Item 56 — revisão das cenas de vídeo e animação

Data: 2026-10-04.

## Direção e revisão

Sala de projeção dentro do Grimório: arquivo de cenas à esquerda, leitura e prévia no centro, controles do mestre junto à mídia. Janela de exibição com fundo escuro, margem ocre e título Cinzel; controles em Source Sans 3. Sem animação ornamental nova.

Skills aplicadas: `frontend-design`, `vercel-react-best-practices`, `web-animation-design`, `tdd` e `web-design-guidelines`. Regras consultadas em [Web Interface Guidelines](https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md).

- `src/components/CampaignScenes.jsx:67` — campos nativos com rótulos, limites e formatos explícitos; envio cancelável, estados de carregamento/erro, rascunho preservado e revisão de conflito por campo, incluindo arquivo.
- `src/components/CampaignScenes.jsx:115` — exibição imediata e permissão posterior têm ações separadas com texto sobre o resultado. Controles compartilhados ficam reservados ao mestre.
- `src/components/CampaignScenes.jsx:119` — biblioteca indica uso e pede confirmação antes da exclusão permanente. O servidor recusa arquivos referenciados, inclusive por cenas arquivadas.
- `src/components/SceneMediaPlayer.jsx:14` — reprodução obedece as restrições do navegador. Pode tentar vídeo sem som e oferecer entrada explícita. A preferência de movimento reduzido exige Assistir agora.
- `src/components/SceneMediaPlayer.jsx:23` — fonte restaurada na montagem e liberada na limpeza, inclusive com montagem dupla do React 18. Eventos e timer removidos; sincronização local sem gravação por quadro.
- `src/components/SceneMediaPlayer.jsx:53` — região com nome acessível, estados em texto, erro com tentativa, GIF/canvas com descrição e controles pessoais separados dos compartilhados.
- `src/components/SceneMediaPlayer.jsx:69` — dialog semântico, foco inicial no título, foco contido, minimizar/Escape pessoais e retorno ao acionador quando disponível.
- `src/components/SceneMediaPlayer.css:7` — foco visível, controles com pelo menos 44 px de altura, contraste e modo de cores forçadas. No celular, botões em duas colunas, com palavras legíveis e sem overflow horizontal. Sem `transition: all` nem nova animação CSS.

## Validação real

`npm run dev`, Vite 5178/API 3106, banco SQLite descartável. Nenhuma mesa real foi usada. Estado SQL/JSON 7, três cenas e dois arquivos persistidos. Combate conservou rodada 6, jogador ativo, ordem, iniciativas e quatro efeitos.

- Seletor de arquivos real: MP4 com vídeo/áudio e GIF enviados, associados e salvos.
- Duas telas conectadas: cena reservada ausente do jogador antes da liberação; apresentação abre também na tela do jogador, sem controles de mestre.
- Ambiente de validação pediu entrada explícita para iniciar: Assistir agora produziu reprodução real. Pausa do mestre propagou para a outra tela; posições observadas 0,744 s e 0,778 s, ambas pausadas.
- Encerrar cena reservada removeu o acesso temporário. Permitir assistir depois a tornou acessível em Cenas; player nativo reproduziu por teclado. Bloquear retirou a cena e o player do jogador. Permissão final restaurada na cena de vídeo de teste.
- GIF em reprodução foi pausado como canvas visível de 320×180. Continuar reinicia o GIF; não há busca/sincronização exata de seus quadros.
- Recarga/reabertura conservou cenas e arquivos. Minimizou sem encerrar, voltou com foco no título, e o mestre encerrou a apresentação ao concluir a validação. Fixture deixada em modo mestre, apresentação parada.

Desktop 1440×900: janela de exibição totalmente dentro da tela, sem rolagem interna no estado pausado; título, mídia e controles visíveis. Imagens `56-scene-live-desktop.png` e `56-scenes-desktop.png`.

Celular 390×844: página com largura/scrollWidth 382 px. Botões pessoais medidos em 165×44 px; continuar/recomeçar 165×63,2 px; encerrar 338×44 px. Imagem `56-scene-live-mobile.png`. O último ajuste corrigiu a quebra de palavras dos botões estreitos.

Console da aba final: zero avisos/erros após os fluxos desktop/celular. Durante implementação foram corrigidos limpeza de fonte em Strict Mode, cálculo do horário entre atualizações e um erro transitório de edição; a compilação final está aprovada.

## Gates e limites

- Um teste HTTP integrado novo, com MP4 real/GIF, papéis, modo jogador, deduplicação, liberação SSE, versões, Range/HEAD, revogação, reinício, exportação filtrada, backup/restauração e arquivamento da apresentação ativa.
- Suíte completa: 134/134, zero falhas. Após o ajuste de auditoria, conjunto focado de quatro testes passou. CSS final validado no navegador e por `npm run build`.
- Build final aprovado; continuam os avisos existentes sobre importação de `modelQuality` e tamanho do chunk Three.js. Sem nova dependência/API externa na aplicação.
- MP4/WebM dependem do codec do navegador. A tentativa de autoplay silencioso está implementada, mas não foi declarada comprovada neste ambiente: a entrada explícita foi a reprodução observada. Política de [HTMLMediaElement.play](https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/play).
- GIF não permite seek; reabrir uma apresentação já pausada não recupera seu quadro anterior. Vídeo usa posição compartilhada com tolerância, sem promessa de sincronismo audiovisual exato.
- Conteúdo já recebido/exportado não pode ser apagado remotamente. Auditoria completa com leitor de tela, zoom e legendas fica nas etapas correspondentes do plano.

Contrato: `docs/SCENE_MEDIA.md`; decisão: ADR 032. O item 56 de associações extras foi substituído pela definição de apresentações dada pelo usuário.
