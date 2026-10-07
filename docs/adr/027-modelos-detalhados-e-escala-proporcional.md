# 027 — Modelos detalhados e escala proporcional

Data: 2026-10-03. Status: aceita e implementada localmente.

## Contexto

O usuário pediu mais polígonos, tamanho do modelo inteiro sem deformação e redução relativa no modo Leve. Confirmou redução automática. OBJ cria três vértices por triângulo, incluindo faces quadradas trianguladas, e o limite anterior de um milhão de vértices barrava modelos antes do limite de triângulos.

## Decisão

Ampliar geometria para dois milhões de triângulos/seis milhões de vértices desenhados, preservando as demais proteções de pacote/validação. Usar os mesmos limites nos formatos suportados.

Aplicar tamanho como fator uniforme sobre a transformação do objeto, incluindo prévia, gizmo e entrada numérica. Conservar escalas antigas, posição/giro de um objeto e estrutura interna; em grupos, conservar posições relativas. Reutilizar ações transacionais e versões existentes. A interface oferece um tamanho proporcional em vez de três tamanhos independentes.

No Leve, derivar um alvo relativo da densidade original, conservando entre 10% e 50% dos triângulos e mirando 60 mil, sob o erro geométrico existente. Reduzir texturas relativamente, com limite de 1.024 px. Mostrar o ganho real; preservar recursos incompatíveis e permitir Original intacto. LOD por distância mantém seu alvo explícito e a política de qualidade permanece pessoal.

## Consequências

Mais modelos ultrapassam o limite antigo sem remover os limites de memória/prazo. Redimensionar não modifica o pacote nem deforma o modelo. Redução geométrica é um alvo condicionado à topologia; o download e primeiro parse ainda usam o original. Nenhuma API externa, nova dependência ou migração neste ajuste.

Contrato e evidências em [MODEL_DETAIL_AND_SCALE.md](../MODEL_DETAIL_AND_SCALE.md).
