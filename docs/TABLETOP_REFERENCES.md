# Vínculos dos objetos da Mesa 3D — item 50

Estado em 2026-10-03: **implementado e validado localmente**. Sem publicação no Git ou deploy.

## Uso

Em **Mapa → Mesa 3D → Ferramentas**, marque um objeto. Na seção **Vínculos**, escolha Ponto, Cena ou Nota, escolha o destino e clique em **Vincular**. Um objeto aceita vários destinos de cada tipo, até 90 vínculos no total, sem duplicatas.

Clique no nome para abrir o conteúdo atual. **Retirar** remove somente a relação; o objeto e o destino permanecem. Quando vários objetos ou um grupo estão marcados, **Ver vínculos de** escolhe o objeto cujas relações serão editadas. As transformações continuam operando sobre o grupo inteiro.

Pontos abrem seus detalhes no mapa 2D; cenas abrem na aba Cenas; notas abrem na janela existente, conservando Texto/Mapa mental quando já estiver aberta e usando Texto na primeira abertura. A seleção 3D permanece ao voltar de outra aba. A feature não cria uma cena 3D por ponto 2D.

Direção visual: bancada tática existente, seção compacta, nomes sublinhados, separadores discretos e ações textuais. Controles de 44 px, foco visível, campos com rótulo e mensagens acessíveis. O foco volta ao seletor ou à lista após adicionar/retirar. Estado vazio distingue ausência de destinos de destinos já vinculados.

## Notas pessoais e decisão do usuário

O usuário confirmou vários vínculos, notas pessoais privadas e criação por jogadores. Notas pessoais pertencem ao autor; mestre e ADM também precisam receber compartilhamento explícito para consultá-las ou editá-las. O compartilhamento atual não concede acesso retroativo às versões privadas do histórico. O caderno **Notas do mestre** permanece acessível aos mestres/ADM no modo mestre e pode ser compartilhado com jogadores.

**Minhas notas** está disponível em todas as abas para jogador, mestre e ADM. Usa a mesma identidade local de rascunhos que o caderno antes situado na ficha, preservando localStorage/IndexedDB. A ficha aponta para esse acesso único, evitando duas instâncias escrevendo os mesmos rascunhos.

A criação/salvamento pelo jogador funcionou na reprodução anterior à mudança; o bug antigo relatado não foi reproduzido. A entrega melhora o acesso ao caderno e corrige a privacidade comprovadamente incorreta da API. No navegador final, o jogador criou e salvou uma nota diretamente no mapa; a nota reapareceu após recarga em 390 px.

## API, dados e acesso

- Cada objeto guarda `references: [{id, kind, targetId, scope?}]`; o escopo identifica o caderno somente para notas. A chave de destino inclui tipo, caderno e ID: `legacy` em dois cadernos não é a mesma nota. Nomes/conteúdo nunca são copiados para o objeto.
- `POST /api/rooms/:roomId/map-object-actions` aceita `link` com um objeto, versão da coleção e `reference`, ou `unlink` com `referenceId`. Somente mestre/ADM no modo mestre. O bloqueio de posição/giro/tamanho não impede organizar vínculos.
- `GET /api/rooms/:roomId/map-objects/:objectId/references/:referenceId` resolve o destino pela autorização atual e devolve a visão atual da mesa mais `referenceTarget`. Destino ausente ou sem acesso responde com 404 genérico. Vincular não compartilha conteúdo.
- HTTP e SSE usam `mapViewMode=master|player`; o papel real continua validado. ADM em modo jogador recebe a projeção de jogador. Clientes anteriores sem o parâmetro mantêm a projeção do papel real.
- Jogadores não recebem vínculos privados, removidos, arquivados ou cobertos. Administradores recebem apenas `{id, kind, unavailable: true}` para retirar uma relação indisponível; nenhum identificador, escopo ou nome do destino privado acompanha esse marcador.
- Versões da coleção são calculadas sobre o estado canônico antes da projeção. `link`/`unlink` incrementam a versão do objeto e revisão da mesa e seguem a transação/SSE existentes. Conflito preserva a escolha do formulário e pede nova conferência.
- Duplicar conserva as relações com os mesmos destinos, mas cria IDs próprios para os novos vínculos. Não duplica notas, cenas, pontos ou pacotes de modelos.
- Exportação guarda somente relações com destinos efetivamente permitidos. Marcadores indisponíveis não entram no arquivo.
- Quadros e versões de notas não expõem IDs de pontos fora da visão autorizada. Ao salvar outros campos, uma ligação ocultada pela névoa é preservada no servidor se o cartão continuar existindo e não receber outro ponto. Excluir o cartão ou trocar seu vínculo mantém o comportamento normal.

Estado de mesa **3**: a migração 2→3 acrescenta `references: []` aos objetos antigos, conservando poses, grupos, bloqueios, versões e pacotes. Estados 0/1 chegam diretamente ao formato atual em uma única revisão/transação. SQLite continua banco 4; ledger e recuperação reconhecem o novo estado. Consulte [MIGRATIONS.md](MIGRATIONS.md) e [decisão 025](adr/025-vinculos-3d-e-notas-pessoais.md).

## Validação proporcional

O usuário pediu uma conferência rápida e dispensou os três novos testes propostos. Foi escrito **um teste integrado HTTP real**, `tests/tabletop-references.test.js`, com SQLite temporário, sem mocks do carregador ou serviços externos. Comportamentos de privacidade e vínculos foram primeiro observados falhando, depois aprovados.

O fluxo integrado cobre criação por jogador, privacidade diante de mestre/ADM, histórico/edição recusados, vários pontos/cena/nota, duplicatas, nome atualizado, compartilhamento/revogação, SSE, modo jogador do ADM, névoa, conservação de ligação oculta durante edição de texto, arquivamento, bloqueio/conflito, duplicação, destino removido, reinício, exportação e retirada da relação. Passou em cerca de 0,56 s. Expectativas antigas de acesso privilegiado às notas foram ajustadas à escolha expressa do usuário, verificando também que o dono mantém o conteúdo.

- `npm test`: **126 testes, 126 aprovados**, aproximadamente 39 s.
- `npm run build`: aprovado, 3,39 s. Permanece o aviso conhecido do pacote Three.js acima de 500 kB.
- `npm run dev`, banco/contas descartáveis: desktop 1440×900 e celular 390×844. Vários destinos no mesmo objeto, abertura dos três tipos, nome atualizado, seleção preservada ao retornar, retirada sem apagar o destino, reabertura depois de reiniciar, criação/reabertura da nota do jogador, ADM em modo jogador e teclado.
- Celular: documento de 382 px em viewport de 390 px; janela de nota de 374 px; ações dos vínculos com 44 px. Console sem erros na versão final.
- Skills: `diagnosing-bugs`, `tdd`, `vercel-react-best-practices`, `frontend-design` e revisão `web-design-guidelines` pela [fonte atual](https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md). Revisão corrigiu estado vazio, foco após retirar e renderização das listas maiores.

Evidências: [vínculos desktop](../quality/50-links-desktop.png), [vínculos celular](../quality/50-links-mobile.png) e [nota do jogador](../quality/50-player-note-mobile.png).

## Limites

O item 51 passou a conservar a câmera pessoal no navegador ao reabrir a mesa; consulte [iluminação e câmera](TABLETOP_LIGHTING_AND_CAMERA.md). Lixeira de notas e refinamento do mapa mental permanecem adiados. Uma atualização de metadados mantém os IDs de objeto/pacote e não publica transformações nem reduz a qualidade do modelo.

API externa e nova dependência: **nenhuma**. A entrega amplia a API Node/SQLite e a navegação existentes.
