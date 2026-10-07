# Prévia local de modelos 3D

Item 47, entrega local de 2026-10-03. A escolha do projeto foi mostrar a prévia na própria mesa, visível somente para quem a abriu. Usa Three.js, os loaders e a API existentes, sem dependência ou serviço externo novo.

## Como usar

1. Escolha **Mapa / terreno** ou **Estrutura / objeto** e selecione o modelo com seus materiais, texturas e arquivos BIN.
2. Clique em **Ver prévia**. A cena mostra o modelo com contorno dourado e a indicação **Prévia — só você**. Nenhum objeto é gravado nessa etapa.
3. Use **Mover**, **Girar** ou **Tamanho** e arraste os eixos. Para usar teclado ou valores exatos, abra **Ajustar por números**; Enter ou sair do campo aplica o valor.
4. **Restaurar ajustes** devolve posição/giro zero e multiplicadores 1. **Cancelar prévia** conserva os arquivos, a seleção anterior e o único estado confirmado da mesa, devolvendo o foco a Ver prévia.
5. **Adicionar à mesa** publica com os ajustes mostrados, usando o [progresso e a confirmação de importação](MODEL_IMPORT_PROGRESS.md). Cancelar o envio e verificar uma resposta perdida continuam seguindo esse contrato.

Uma unidade corresponde a um quadrado da grade atual. A normalização existente permanece: maior lado inicial de 30 unidades para terreno e 5 para estrutura. Multiplicador 1 mantém esse tamanho normalizado, sem substituir os bytes do original. Dimensões mostradas são a caixa alinhada aos eixos da cena; girar o modelo pode mudar essas medidas. Imagens usadas como terreno continuam planos, com altura zero.

Posição e rotação aceitam três números finitos com valor absoluto até 10.000; rotação é enviada em radianos e exibida em graus. Cada multiplicador vai de 0,001 a 10.000. Um valor recusado volta ao último válido e apresenta erro. Prévia com arquivo de apoio ausente mostra qual arquivo falta; para completar a seleção, cancele a prévia. Falha de publicação conserva arquivos e ajustes para revisão.

## Dados, acesso e ciclo de vida

A prévia carrega diretamente File/Blob do navegador, pela mesma normalização dos modelos publicados. Não prepara confirmação, envia pacote, grava posição nem transmite movimentos de arraste para SSE. Ajustes durante o gesto ficam em referência; os campos e medidas são atualizados ao soltar. Objetos confirmados continuam recebendo sincronização; a prévia não impede o servidor de conservar alterações paralelas na mesa.

Na publicação, `placement` opcional contém somente `position`, `rotation` e `scale`. É aceito no cabeçalho binário e no corpo JSON legado, validado no servidor e aplicado ao novo objeto na transação da importação. O pacote canônico de arquivos não recebe essa pose; exportação e reinício usam a transformação do objeto no estado da mesa. Clientes que omitem `placement` mantêm os padrões anteriores. Não há migração de esquema nova neste item.

Edição e publicação exigem o modo mestre e acesso atual. Perder a edição remove a malha da prévia e bloqueia seus controles; arquivos e ajustes ficam disponíveis na janela para cancelar ou retomar após recuperar o acesso. O servidor revalida a permissão depois da conferência de conteúdo, como no item 46.

Carregamentos compartilham a fila limitada a duas operações; a prévia tem prioridade dentro dessa fila. Cancelar, perder acesso, trocar qualidade, desmontar ou perder WebGL aborta o carregamento e libera malha, contorno e dependências. Entregas tardias são descartadas. Segue o contrato de [propriedade dos recursos](TABLETOP_RESOURCE_LIFECYCLE.md). Original/Leve permanecem preferências pessoais, conservando a pose. Reabrir WebGL reconstrói também a prévia local e mantém o limite de uma tentativa automática por entrada.

A câmera enquadra a prévia ao carregá-la pela primeira vez; cancelar restaura a câmera anterior. A publicação conserva a vista atual. Mudanças de qualidade e reabertura não reenquadram repetidamente uma prévia já vista. Sem animações novas: arraste e ajustes são imediatos e a preferência de movimento remoto continua separada.

## Ajuste posterior: tamanho proporcional

Em 2026-10-03, a interface passou a usar **Tamanho proporcional** para o modelo inteiro. 1 mantém o tamanho normalizado inicial, 2 dobra e 0,5 reduz à metade. O gizmo também aplica um fator igual nos três eixos, sem deformar o modelo. Posição e giro continuam por eixo nos ajustes avançados. O contrato de `placement` conserva os vetores e aceita estados antigos; as evidências anteriores de escalas diferentes abaixo são históricas. Conferência atual em [MODEL_DETAIL_AND_SCALE.md](MODEL_DETAIL_AND_SCALE.md), ADR 027.

## Validação

Exatamente três testes em `tests/model-preview.test.js`:

1. Publicação da pose exibida, dimensões equivalentes e original intacto no download.
2. Quatro ciclos locais de prévia/cancelamento, recursos descartados uma vez, carga abortada e nenhuma alteração/publicação/exportação de modelo.
3. Acesso alterado, modo jogador e números inválidos recusados; arquivo local preservado, pose em exportação/reinício e cliente antigo compatível.

Suíte completa: 119 testes passaram. Build passou com o aviso já conhecido sobre o bundle Three.js.

`npm run dev` foi conferido em banco descartável, 1440 e 390 px. GLTF/BIN/textura apareceu com contorno; arraste alterou X para 1,176 mantendo zero objetos. Números ajustaram posição `[12,3,-8]`, giro Y de 90° e multiplicadores `[2,1,3]`, com caixa de `15 × 5 × 10` unidades. Troca Original/Leve preservou ajustes. Uma segunda aba continuou com zero objetos antes de adicionar; depois recebeu exatamente um objeto, com a pose mostrada. Cancelar conservou arquivos, seleção e foco.

Em 390 px, página de 382 px, botões de 44 px, erro de BIN ausente com foco na prévia e edição/publicação bloqueadas no modo jogador. Uma perda WebGL real recuperou automaticamente a prévia; uma segunda exigiu Reabrir 3D pelo teclado, conservando X=9 e um único objeto confirmado. Controle temporário de teste removido. O ensaio encontrou e corrigiu um envio indevido de metadados internos à validação de pose; a interface agora passa apenas os três vetores.

## Limites

A prévia ocupa recursos do aparelho e ainda lê o original antes da redução de qualidade. Cancelar não interrompe um parser síncrono no meio; o resultado é liberado ao terminar. Carregar localmente não substitui a validação profunda do servidor. Sair da mesa, recarregar ou fechar a página descarta a prévia e exige selecionar os arquivos novamente. Não há armazenamento automático desses arquivos, encaixe/snap, colisão ou escolha de sistema de unidades físico nesta entrega. Agrupamento, duplicação e bloqueio continuam no item 48.
