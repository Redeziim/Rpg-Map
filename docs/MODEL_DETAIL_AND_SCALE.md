# Modelos detalhados, tamanho proporcional e Leve relativo

Pedido adicional após o item 51, entregue localmente em 2026-10-03. O usuário confirmou **redução automática** dentro do modo Leve.

## Mais polígonos

A validação aceita até **2 milhões de triângulos e 6 milhões de vértices desenhados** por modelo, em vez de 1 milhão para cada contagem. OBJ expande um triângulo para três vértices; o limite antigo de vértices recusava modelos a partir de aproximadamente 333 mil triângulos, mesmo com poucos vértices únicos no arquivo.

Faces quadradas continuam aceitas no OBJ e são convertidas em dois triângulos pelo carregador. GLTF/GLB, FBX e OBJ usam os limites comuns de geometria. Arquivos originais, materiais e hierarquia não são reescritos. O pacote continua limitado a 100 arquivos/50 MiB; limites de textura, hierarquia, arrays FBX, dois workers de validação, heap de 256 MiB e prazo de 20 segundos permanecem. Esses limites adicionais também podem recusar um pacote; a contagem máxima não garante que todo modelo caiba em todo aparelho.

## Tamanho do modelo inteiro

- **Na prévia:** Tamanho proporcional parte do tamanho normalizado inicial; 1 mantém, 2 dobra e 0,5 reduz à metade. Continua possível mover/girar antes de adicionar.
- **Na mesa:** selecione o objeto e use Multiplicar tamanho → Aplicar tamanho. O fator age sobre o tamanho atual; após salvar, o campo volta a 1 para evitar uma repetição acidental.
- **Por arraste:** o gizmo Tamanho aplica um fator igual em todos os eixos, inclusive na prévia e em um objeto individual. Escalas antigas diferentes entre eixos mantêm suas proporções.
- **Em seleção múltipla/grupo:** cresce ou diminui o conjunto em torno do centro, mantendo as posições relativas. Um objeto individual mantém posição e giro.
- A interface oferece posição/giro por eixo nos ajustes avançados; o tamanho usa o controle proporcional. Bloqueios e versões/confirmação existentes continuam protegendo as transformações no servidor.

A geometria normalizada fica dentro do objeto e mantém sua estrutura. Apenas a transformação externa muda; não há alteração de polígonos, materiais ou arquivos ao mudar o tamanho. Valores finais continuam entre 0,001 e 10.000 por eixo, e os limites do multiplicador consideram a escala atual.

## Redução automática relativa no Leve

A versão Leve escolhe a proporção de geometria a partir do total de triângulos do original: conserva no máximo 50%, mira aproximadamente 60 mil triângulos e conserva no mínimo 10%. Exemplos de alvo: modelo pequeno conserva metade; 300 mil triângulos miram 60 mil; 2 milhões miram 200 mil. O limite de erro geométrico continua em 1%, com bordas, UV, normais, cores e grupos de materiais preservados. Topologia e formato podem impedir o alvo; o painel mostra a redução **real**, incluindo porcentagens.

Texturas comuns com maior lado acima de 64 px também reduzem relativamente: metade das dimensões, ou um quarto quando o conjunto original ultrapassa 16 milhões de pixels, sempre com maior lado de até 1.024 px. Dimensões são arredondadas, com mínimo de um pixel. Uma textura 512×512 passa a 256×256, reduzindo os pixels em 75%. Texturas pequenas ou formatos especiais permanecem.

Malhas com esqueleto, morph targets, instâncias ou intervalos particulares de desenho continuam preservadas. Malhas cuja topologia impede reduzir triângulos entram no aviso de recursos mantidos. O worker e seu cancelamento continuam existentes; o LOD distante conserva seu alvo explícito separado. Original reabre os arquivos completos e desativa a redução por distância. Qualidade é pessoal; a pose é compartilhada.

## Validação proporcional ao risco

- Um novo teste integrado com HTTP real: OBJ de 175 mil faces quadradas/350 mil triângulos, antes recusado, importado e redimensionado; proporção de escala `[2,1,3]` passa a `[4,2,6]`, mantendo posição/giro e bytes do pacote. O ensaio existente de excesso usa o limite novo e mantém a mesa intacta.
- Um novo teste pelo carregador público: esfera com 261.120 triângulos perde mais de 70% no Leve, conserva dimensões e reabre Original intacto. Os testes existentes de cancelamento, malhas especiais, grupos/bloqueios, LOD e descarte também passaram.
- Suíte: **129 testes aprovados**; build final aprovado, com o aviso Three.js conhecido.
- `npm run dev`, SQLite descartável, navegador 1440×900 e 390×844. Importado OBJ/MTL/PNG real com 176.400 faces quadradas, 352.800 triângulos e 1.058.400 vértices expandidos. Leve: aproximadamente 60 mil triângulos, **83% menos**, e **75% menos pixels de textura**.
- Prévia numérica 5×0×2,5 → 10×0×5; arraste para 18,85×0×9,42 conservou a proporção. Importação confirmada; multiplicador 0,5 salvou o objeto inteiro e 2 funcionou por teclado no celular. A API confirmou a escala nos três eixos, com posição/giro preservados. Troca Original/Leve e reabertura conferidas.
- A validação nativa encontrou uma falha no envio de tamanho sem posição/giro; os deltas ausentes agora usam zero. O fluxo foi repetido e aprovado; aba nova de celular com console sem erros, página 382 px em viewport de 390 px e botão de 44 px.

Evidências: `quality/models-proportional-preview.png`, `models-relative-light-desktop.png`, `models-proportional-mobile.png`. Revisão em `quality/models-detail-interface-review.md`.

Nenhuma API externa, dependência, endpoint ou migração nova neste ajuste. APIs existentes de importação/transformação e bibliotecas Three.js/meshoptimizer foram reutilizadas. A preparação/download ainda lê o original, e Leve reduz a representação após a leitura; não elimina todo pico inicial de memória. ADR [027](adr/027-modelos-detalhados-e-escala-proporcional.md).
