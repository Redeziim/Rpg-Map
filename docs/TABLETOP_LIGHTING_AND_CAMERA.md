# Iluminação compartilhada e câmera pessoal

Item 51 entregue localmente em 2026-10-03. Escolha confirmada: o mestre define a luz; cada pessoa controla sua câmera.

## Onde encontrar

Em **Mapa → Mesa 3D → Ferramentas → Iluminação e câmera**:

- Mestre e ADM no modo mestre escolhem Padrão, Luz clara ou Luz baixa. Todos recebem a escolha pelo SSE.
- Jogadores, inclusive ADM no modo jogador, consultam a luz atual e controlam a própria câmera.
- Vista superior, Vista diagonal e Vista frontal conservam o ponto observado. Restaurar câmera enquadra a mesa inteira na vista padrão; Enquadrar continua usando a seleção, quando houver.
- A posição e o ponto observado ficam no navegador por conta e mesa. Reabrir a mesa ou recarregar recupera essa vista. Se o armazenamento falhar, a preferência dura a visita e a interface informa isso.

As vistas mudam diretamente, sem percurso animado. Mudar a luz atualiza as duas luzes existentes do Three.js; conserva câmera, seleção e modelos e não cria loop de renderização permanente. Prévia de importação conserva seus controles próprios; suas poses temporárias não substituem a preferência pessoal.

## Contrato

O estado persistido tem `tabletopLighting: 'default' | 'bright' | 'dim'`. O snapshot inclui `tabletopLightingVersion`, calculado sobre o valor canônico. `PATCH /api/rooms/:room/tabletop-lighting?mapViewMode=master` recebe somente `{preset, version}`.

A API confere papel e modo, recusa campos/presets inválidos com 400 e versão antiga com 409. Uma mudança grava uma revisão com auditoria e publica o snapshot autorizado. Repetir a escolha atual não grava outra revisão. Câmera não faz parte do contrato de rede nem do estado compartilhado. A interface mantém o valor confirmado durante o envio, mostra o progresso e orienta uma nova tentativa após falha, sem repetir a escrita automaticamente.

SQLite permanece no esquema 4. A migração **004 do JSON de mesa** passa de estado 3 para 4, acrescentando a iluminação padrão e preservando os demais dados. Formatos anteriores chegam ao estado 4 na transação de inicialização existente, com uma revisão por mesa. Exportação inclui a iluminação; backup/restauração preservam os contratos antigos. Reiniciar um estado atualizado não repete a migração.

Preferência pessoal: chave `grimorio:camera:v1:<conta>:<mesa>`, documento versão 1 com vetores finitos `position`/`target` e distância compatível com os limites da câmera. Valores inválidos são ignorados. Abas abertas mantêm câmeras independentes; a última preferência salva pela mesma conta neste navegador é usada na próxima abertura.

## Validação

- Um teste integrado com HTTP real e SQLite descartável: presets, autorização, ADM no modo jogador, dados inválidos, conflito, SSE, restauração, exportação, reinício e migração 3→4 sem gravação repetida.
- Suíte completa: **127 testes, 127 aprovados**. Build final aprovado; permanece o aviso conhecido do tamanho do pacote Three.js.
- `npm run dev`, navegador em desktop 1440×900 e celular 390×844. Vistas e restauração por teclado, três luzes, câmera após recarga e duas abas com ângulos diferentes. Alterar a luz atualizou a aba no modo jogador sem alterar sua vista superior; essa aba não recebeu seletor de iluminação.
- Celular: documento 382 px em viewport de 390 px; quatro botões de vista com 44 px de altura. Console das duas abas sem erros.

Evidências em `quality/51-lighting-desktop.png`, `51-lighting-mobile.png`, `51-player-before.png`, `51-player-after.png` e `51-camera-front-before-reload.png`/`51-camera-front-after-reload.png`. Revisão em `quality/51-interface-review.md`.

## Limites

Há uma Mesa 3D independente por mesa; a iluminação pertence a ela. As cenas de campanha continuam com texto e vínculos. Configurações diferentes por cena e câmera conduzida pelo mestre não foram solicitadas. A luz não acrescenta sombras ou filtros gráficos. A câmera pessoal fica neste navegador, sem sincronização entre aparelhos. Nenhuma API externa ou dependência nova.
