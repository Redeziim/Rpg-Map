# Modelos de ficha por sistema e importação de fichas — item 58

Pedido do usuário em 2026-10-07: modelos dos sistemas mais conhecidos, começando por D&D e incluindo Ordem Paranormal; e ler um PDF, print ou imagem de uma ficha existente para transcrevê-la, ou orientar a pessoa a fazê-lo.

## Modelos de sistema

O mestre abre **Editar modelo da ficha** e escolhe um sistema em **Modelos de sistema**. Um modelo é só uma lista de campos do mesmo tipo que o mestre já monta à mão; nada fica fixo. Dá para **Somar campos** (mantém o que existe e não repete campos de mesmo nome), **Substituir o modelo** (com confirmação), ou editar tudo depois. O servidor aceita até 200 campos no modelo.

| Sistema | Campos | O que traz |
| --- | --- | --- |
| D&D 5ª edição | 55 | Seis atributos com modificador calculado, bônus de proficiência por nível, iniciativa, percepção passiva, seis salvaguardas, 18 perícias com o atributo no rótulo, vida, equipamento, ataques e traços |
| Ordem Paranormal | 61 | Cinco atributos, NEX e nível de NEX, Vida, Esforço e Sanidade, Defesa, 28 perícias com o atributo no rótulo, e o cálculo de PV, PE e Sanidade máximos por classe (Combatente, Especialista, Ocultista) |

Cada fórmula é conferida por teste com números reais (`tests/sheetSystems.test.js`): por exemplo, NEX 50% com Vigor 2 e Presença 3 dá nível 10, PV 76 e PE 50 de Combatente, Sanidade 65 de Ocultista; D&D nível 5 dá proficiência +3.

Seis sistemas conhecidos entraram depois (ADR 037, `src/shared/sheetSystemsMore.js`), cada um com as contas da regra conferidas por teste:

| Sistema | O que traz |
| --- | --- |
| Tormenta20 | Seis atributos, Defesa calculada (10 + Destreza + armadura + escudo), Vida e Mana, 29 perícias, poderes e magias |
| Chamado de Cthulhu 7ª edição | Oito características com metade e quinto, Sorte, Vida, Magia e Sanidade com máximos calculados (PV = (CON + TAM) / 10, PM = Poder / 5, Sanidade = 99 − Mitos), 43 perícias em %, e as seções de história |
| Pathfinder 2ª edição | Seis atributos com modificador, salvaguardas, Percepção, CD de classe, 16 perícias, talentos |
| Vampiro: A Máscara 5ª edição | Nove atributos e 27 habilidades (0 a 5), Vitalidade (3 + Vigor) e Força de Vontade (Autocontrole + Perseverança) com máximos, Humanidade, Fome, Potência de Sangue |
| 3D&T Alpha | Poder, Habilidade, Resistência, Armadura e Poder de Fogo, Força de Ataque e de Defesa, Vida e Magia (Resistência × 5) |
| Old Dragon | Seis atributos com modificadores digitados, vida, armadura, base de ataque e três jogadas de proteção |

Novos sistemas entram em `src/shared/sheetTemplates.js` ou `sheetSystemsMore.js` (a lista de campos e os apelidos de leitura).

## Meus modelos e modelo gerado de um arquivo (ADR 037)

Em **Editar modelo da ficha → Modelos de sistema**, o mestre ou ADM tem:

- **Meus modelos**: os modelos guardados na sua conta (tabela `sheet_models`). Só você os vê, em qualquer mesa. Cada um pode ser somado à mesa, substituir o modelo da mesa ou ser apagado. Limite de 30 por conta.
- **Criar modelo de um arquivo**: escolha um PDF, uma imagem ou um TXT. A leitura acontece no navegador (o arquivo não vai ao servidor). O app propõe os campos; você marca, renomeia, troca tipo e categoria, dá um nome e guarda, ou guarda e já soma à mesa.
- **Guardar o modelo desta mesa**: copia os campos que a mesa usa hoje para os seus modelos.
- **Sistemas conhecidos**: a lista acima, sempre disponível.

### Como o arquivo vira modelo

- **PDF com formulário**: os nomes dos campos do formulário viram os nomes dos campos do modelo; nomes genéricos ("Text Box 12") são ignorados.
- **Imagem**: o OCR é lido de várias maneiras e os resultados são somados; as linhas retas longas (bordas de caixas e sublinhados) são apagadas numa leitura extra, porque as caixas faziam o OCR pular fileiras inteiras de rótulos, e a posição de cada palavra separa as colunas. Rótulos em maiúsculas viram frase normal.
- **PDF ou imagem**: cada linha vira candidata. "Nome: Fulano" e "Força 14" dão o rótulo sem o valor; uma linha só com rótulos que a biblioteca conhece ("Força Destreza Constituição") é separada; palavras como ATRIBUTOS, PERÍCIAS ou EQUIPAMENTO abrem uma categoria; links, números de página, direitos autorais e frases longas são ignorados.
- **Tipo**: número quando há número ou o rótulo é de atributo, perícia ou bônus; barra de recurso para vida, mana, sanidade e parecidos (e para "10 / 12"); texto longo para história, notas, magias; lista para inventário e ataques; imagem para retrato; texto nos demais.
- **TXT à mão**, o jeito mais seguro: uma linha por campo; `# Categoria` (ou `[Categoria]`, `== Categoria ==`) abre uma categoria; `Campo [número]`, `[texto]`, `[longo]`, `[lista]`, `[barra]` e `[imagem]` escolhem o tipo; `Mod. Força = piso((Força-10)/2)` cria uma fórmula.
- Se a ficha lembrar muito um sistema da biblioteca (pelo menos 10 campos e 70% em comum), o app avisa e os rótulos conhecidos usam o tipo, a categoria e a fórmula desse sistema.
- A revisão tem **Texto lido do arquivo**: mostra o que cada leitura enxergou, para saber se um campo faltou porque o arquivo não foi bem lido ou porque o rótulo não foi reconhecido.
- Tudo é conferido pelas mesmas regras do servidor antes de guardar: até 200 campos, nomes únicos, tipos válidos e fórmulas com texto.

### Fórmulas

As fórmulas agora aceitam `piso`, `teto`, `min`, `max` e `abs`, referenciam outras fórmulas (em qualquer ordem) e tratam campo vazio como 0. Um ciclo ou fórmula quebrada mostra "erro", e quem depende dela também. Só aritmética é executada: depois de trocar os nomes por números, qualquer outra coisa é recusada (`src/shared/sheetFormulas.js`).

### Fontes

- D&D 5e: campos do SRD 5.1, licença CC BY 4.0 (Wizards of the Coast).
- Ordem Paranormal: mecânica de jogo da Jambô Editora (nomes de campos, atributo-base de cada perícia e fórmulas de recursos por classe). Conferida contra o sistema comunitário `SouOWendel/ordemparanormal_fvtt`. Nenhum texto do livro foi copiado.

## Importar ficha de PDF ou imagem

> **Retirado da interface em 2026-10-09, a pedido do usuário, por enquanto.** A tela "Importar ficha" saiu do livro e da lista da ficha. `SheetImport.jsx`, `sheetReader.js` e os interpretadores continuam no código (a leitura é a mesma que gera modelos) e voltam quando o usuário pedir.

Na ficha do jogador, **Importar de um PDF ou imagem**. Tudo acontece neste navegador; o arquivo não vai ao servidor nem a nenhum serviço de IA.

1. **Leitura** (`src/components/sheetReader.js`)
   - PDF com texto: o PDF.js lê a camada de texto, reconstrói as linhas e as colunas e lê também os campos de formulário (PDFs preenchíveis, como a ficha oficial de D&D).
   - PDF escaneado ou imagem (PNG, JPEG, WebP): OCR com Tesseract (WebAssembly, português e inglês). A imagem é ampliada e lida em três modos, um de texto corrido e dois que guardam a posição de cada palavra.
   - Limites: 15 MB e 8 páginas.
2. **Interpretação**
   - Texto e formulário (`src/shared/sheetImport.js`): cada rótulo do modelo da mesa (e seus apelidos, como `STR`, `Strength`, `PV`, `Hit Points`) é procurado; o valor pode vir na mesma linha, na linha de baixo ou antes. Aceita acentos perdidos, caixa diferente e separadores comuns.
   - Posição (`src/shared/sheetLayout.js`): para fichas de caixas, liga cada rótulo ao valor mais próximo (ao lado, abaixo ou acima), junta dígitos que o OCR separou ("1 0" vira 10), junta rótulos de duas linhas ("CLASSE DE / ARMADURA") e nunca usa o mesmo valor em dois campos. O texto corrido só preenche o que a posição não achou.
3. **Revisão obrigatória**: uma tabela mostra campo, valor lido (editável), confiança (alta, média ou baixa), de onde veio e quanto vai trocar do que já está preenchido. Os de confiança baixa começam desmarcados. Só o que a pessoa marcar é salvo, pelo mesmo caminho da edição normal da ficha.
4. **Orientação**: o que não foi achado aparece como lista para preencher à mão; textos longos, listas e imagens nunca são importados. Se nada for reconhecido, a tela explica o que fazer (usar o PDF original, imagem nítida, aplicar o modelo do sistema).

### O que foi testado

- Interpretadores: 12 testes de texto e formulário, 9 de posição (com a saída real do OCR de uma ficha de D&D de caixas, `tests/fixtures/ocr-dnd-words.json`).
- Navegador, de ponta a ponta: PDF e PNG de uma ficha da Ordem Paranormal (21 de 45 campos lidos, todos corretos, fórmulas calculadas depois de aplicar) e PNG de uma ficha de D&D de caixas (19 campos, corretos nos atributos, perícias, vida e dados; valores acima do rótulo ficam com confiança baixa).

### Limites conhecidos

- Não foi testado com fichas oficiais reais de nenhum dos dois sistemas, nem com fotos de ficha impressa: OCR em fonte decorativa, fundo texturizado ou foto inclinada tende a errar. Por isso a revisão é obrigatória.
- Campos de formulário de PDF só foram testados no interpretador (com nomes da ficha oficial de D&D), não com um PDF preenchível real.
- A primeira leitura de imagem baixa cerca de 12 MB do próprio servidor (motor e idiomas); as seguintes usam o cache do navegador.
- Uma "IA embutida" (modelo de linguagem lendo o arquivo) não foi usada: exigiria enviar a ficha a um serviço externo, com custo, chave e privacidade a decidir. Fica como opção futura, só com aprovação.