# 022 — Prévia local na própria Mesa 3D

- Data: 2026-10-03
- Estado: aceito

## Contexto

Modelos precisam de escala, giro e posição conferidos antes de entrar na mesa. O usuário escolheu uma prévia na própria cena, visível só para ele, com controles simples.

## Decisão

Carregar o pacote File/Blob localmente pelos loaders existentes. Mostrar contorno dourado, indicação de prévia e controles Mover/Girar/Tamanho. Oferecer números por eixo em uma seção recolhida, com restauração dos padrões e cancelamento. Manter normalização de 30 unidades para terreno e 5 para estrutura, sem modificar os arquivos originais.

Não publicar nem sincronizar o arraste local. Somente Adicionar à mesa inicia a importação confirmada do item 46. Acrescentar `placement` opcional ao transporte existente, validado no servidor e gravado no novo objeto na mesma transação. O pacote de arquivos continua independente da pose. Omissão conserva clientes antigos.

Usar a fila limitada e a propriedade explícita de recursos. Cancelamento, mudança de acesso/qualidade, desmontagem e perda WebGL liberam cargas/malhas; retorno reconstrói a prévia com seus ajustes. A câmera é enquadrada uma vez e restaurada ao cancelar; publicação conserva a vista atual. Reabertura mantém a política da decisão 020.

## Consequências

Nenhuma API externa, biblioteca ou migração nova. A prévia consome recursos locais e não substitui a validação profunda no servidor. Fechar/recarregar a página descarta arquivos e ajustes locais. Confirmações de resultado desconhecido continuam bloqueando repetição conforme decisão 021.

Três testes de publicação, cancelamento/recursos e acesso/recuperação, além de navegador em desktop/celular. Contrato, evidências e limites em [MODEL_PREVIEW.md](../MODEL_PREVIEW.md).
