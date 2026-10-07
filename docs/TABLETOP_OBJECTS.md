# Seleção e grupos da Mesa 3D

Entrega local do item 48, em 2026-10-03. Usa React e Three.js já presentes no projeto e a API interna; nenhuma API externa ou dependência nova.

## Como usar

- Marque objetos em **Ferramentas** ou use Shift + clique na cena. **Selecionar todos**, **Limpar seleção** e as caixas de seleção funcionam pelo teclado.
- Selecione dois ou mais objetos, informe **Nome do grupo** e use **Agrupar seleção**. Selecionar um membro seleciona o grupo inteiro; **Focar seleção** enquadra seus membros.
- **Mover**, **Girar** e **Tamanho** usam os eixos da cena. Tamanho conserva as proporções, inclusive em um objeto individual. Use **Multiplicar tamanho → Aplicar tamanho**: 2 dobra e 0,5 reduz à metade do tamanho atual. Em **Ajustar por números**, objetos individuais têm posição/giro XYZ; conjuntos recebem deslocamento/giro relativos. O tamanho proporcional também existe na prévia. Ajuste posterior documentado em [MODEL_DETAIL_AND_SCALE.md](MODEL_DETAIL_AND_SCALE.md).
- **Duplicar** cria novos identificadores, desloca a cópia uma unidade em X/Z e reutiliza os mesmos pacotes. Grupos copiados têm identidade própria. Novas cópias recebem nomes diferentes para facilitar a seleção.
- **Bloquear** impede mover, girar e mudar tamanho, inclusive por números e HTTP. Se um membro estiver bloqueado, o conjunto não pode ser transformado. **Desbloquear** libera todos os membros selecionados. Duplicar conserva o bloqueio da origem; consultar, focar, agrupar e remover continuam permitidos a quem gerencia a mesa.
- **Desagrupar** mantém as transformações globais. **Remover seleção da cena** pede confirmação no próprio painel, com opção de cancelar.

Mestre e ADM no modo mestre gerenciam objetos. Jogadores e ADM no modo jogador podem selecionar, focar e explorar; não recebem controles de edição. A prévia local continua independente das ações sobre objetos publicados.

## Estado, gravação e acesso

O JSON da mesa passa a `stateVersion: 2` por migração explícita antes da API abrir. O esquema SQL continua na versão 4. `mapGroups` guarda `{id,name}`; cada `mapObject` acrescenta `version`, `locked` e `groupId` (ou `null`). Objetos antigos começam sem grupo, desbloqueados e na versão 1. Poses, identificadores, arquivos, notas e acesso permanecem preservados.

Os objetos conservam poses globais planas. Agrupar/desagrupar não recalcula as malhas. Transformações do conjunto usam o centro das posições dos membros, rotação por quaternion e escala uniforme, preservando escalas individuais diferentes sem introduzir cisalhamento. Grupos não têm hierarquia ou escala independente por eixo.

`POST /api/rooms/:room/map-object-actions?mapViewMode=master` recebe `action`, `ids` e `version` obtida de `mapObjectsVersion` no snapshot. Ações: `group` com `name`; `ungroup`; `duplicate`; `lock` com `locked`; `transform` com `delta` ou poses completas em `patches`; `remove`. A seleção é expandida aos membros dos grupos no servidor. Todas as poses precisam ser válidas; alterações do conjunto são atômicas. A resposta contém `mapAction.selectionIds`.

`mapObjectsVersion` cobre objetos e grupos, sem depender de edições nas notas. Uma alteração concorrente nessa coleção recusa o lote com 409. Não há repetição automática de duplicações. Ao perder uma resposta, a interface atualiza a lista e pede conferência antes de repetir uma ação.

O arraste responde imediatamente e envia lotes limitados a intervalos de 150–180 ms. A versão da fila não é substituída silenciosamente pela de outra janela. O campo numérico guarda a versão e o vetor ao iniciar a digitação: uma atualização remota não apaga o valor digitado. Se o envio for recusado, a cena volta ao estado da mesa e **Ajuste não confirmado** guarda a pose nesta janela, com **Usar posições da mesa** ou **Aplicar meu ajuste** (nova confirmação explícita usando a versão atual). Sair com gravação/ajuste pendente recebe a proteção normal do navegador.

`PATCH /map-objects/:id` legado continua aceito para objetos sem grupo e sem bloqueio; `expectedVersion` é opcional para compatibilidade. Mesmo sem essa versão, transformações bloqueadas recebem 423 e transformações isoladas de um membro de grupo recebem 409. Exclusão individual remove grupos vazios. Toda escrita incrementa a versão do objeto e passa pelas permissões reais da conta/modo.

Duplicar não copia arquivos no SQLite. Remoção de uma instância só apaga seu pacote quando não resta nenhuma referência na mesa. Agrupar, bloquear e transformar não limpam pacotes alheios. Exportação incorpora cada pacote uma vez. Backup de estado 1 permanece verificável/restaurável, sem reescrever a origem; abrir a cópia migra uma vez e preserva o ledger anterior. Consulte [migrações](MIGRATIONS.md) e a [decisão 023](adr/023-grupos-e-bloqueios-3d.md).

## Recursos e interação

O pivô do conjunto não se torna pai das malhas. Contornos dourados de seleção têm propriedade explícita e são liberados ao mudar seleção/qualidade, remover o objeto ou desmontar o renderer. O gizmo só aparece quando todos os membros selecionados carregaram. A reconstrução usa a seleção e o snapshot atuais; não publica objetos novamente.

| Interação anterior | Interação atual |
| --- | --- |
| Gizmo em um objeto | Pivô comum e atualização direta dos membros durante o arraste |
| Movimento remoto suave | Mantido em 180 ms, interrompível, respeitando movimento reduzido |
| Edição apenas por arraste | Caixas de seleção, ações nomeadas e ajustes numéricos por teclado |

Nenhuma animação ornamental foi acrescentada. Controles têm foco visível, nomes acessíveis, alvos de pelo menos 44 px (caixas usam o rótulo inteiro) e estados de gravação, bloqueio, erro e confirmação. Revisão feita com `frontend-design`, `vercel-react-best-practices`, `web-animation-design` e `web-design-guidelines`.

## Validação

Exatamente três testes novos em `tests/tabletop-selection.test.js`:

1. Agrupar/desagrupar preserva poses; rotação de 90° e multiplicador 2 movem todos os membros; duplicação mantém arquivos únicos na exportação.
2. Bloqueios, jogador, ADM no modo jogador e mudança de papel recusam alterações; versões antigas não sobrescrevem/duplicam; lote inválido não grava parcialmente.
3. Backup de estado 1, restauração, migração e reinício sem nova revisão; grupos/bloqueios persistem; pacote permanece após excluir a origem e desaparece somente após a última cópia.

Suite completa: 122 testes aprovados. Build de produção aprovado; permanece o aviso conhecido do pacote Three.js de 548 kB. `npm run dev` validado com SQLite descartável em desktop 1440 px e celular 390 px: marcação, criação/duplicação, arraste real do eixo, números com 0,5, desagrupamento, bloqueio, Enter, foco, duas abas SSE, modo jogador, Original/Leve e confirmação/cancelamento da remoção.

No conflito real, uma janela conservou X=21 enquanto a outra confirmou X=22; a primeira recebeu 409, mostrou a pose guardada e só publicou X=21 após **Aplicar meu ajuste**. Após giro/tamanho do conjunto, o objeto desagrupado manteve escala `[1,0.5,1.5]`, Y=3 e Z=-7.25. Em 390 px, a página mediu 382 px, sem overflow horizontal.

Limites: o lote conflita com qualquer mudança nos objetos/grupos da mesa; rascunhos de transformação ficam somente na janela; não há hierarquia de grupos, lixeira 3D ou LOD por distância nesta entrega. O item 49 continua responsável pela carga gradual e LOD.
