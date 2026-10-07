# Modelos de ficha por sistema e importação de fichas — item 58

Pedido do usuário em 2026-10-07: modelos dos sistemas mais conhecidos, começando por D&D e incluindo Ordem Paranormal; e ler um PDF, print ou imagem de uma ficha existente para transcrevê-la, ou orientar a pessoa a fazê-lo.

## Modelos de sistema

O mestre abre **Editar modelo da ficha** e escolhe um sistema em **Modelos de sistema**. Um modelo é só uma lista de campos do mesmo tipo que o mestre já monta à mão; nada fica fixo. Dá para **Somar campos** (mantém o que existe e não repete campos de mesmo nome), **Substituir o modelo** (com confirmação), ou editar tudo depois. O servidor aceita até 200 campos no modelo.

| Sistema | Campos | O que traz |
| --- | --- | --- |
| D&D 5ª edição | 55 | Seis atributos com modificador calculado, bônus de proficiência por nível, iniciativa, percepção passiva, seis salvaguardas, 18 perícias com o atributo no rótulo, vida, equipamento, ataques e traços |
| Ordem Paranormal | 61 | Cinco atributos, NEX e nível de NEX, Vida, Esforço e Sanidade, Defesa, 28 perícias com o atributo no rótulo, e o cálculo de PV, PE e Sanidade máximos por classe (Combatente, Especialista, Ocultista) |

Cada fórmula é conferida por teste com números reais (`tests/sheetSystems.test.js`): por exemplo, NEX 50% com Vigor 2 e Presença 3 dá nível 10, PV 76 e PE 50 de Combatente, Sanidade 65 de Ocultista; D&D nível 5 dá proficiência +3.

Novos sistemas entram em `src/shared/sheetTemplates.js` (a lista de campos e os apelidos de leitura).

### Fórmulas

As fórmulas agora aceitam `piso`, `teto`, `min`, `max` e `abs`, referenciam outras fórmulas (em qualquer ordem) e tratam campo vazio como 0. Um ciclo ou fórmula quebrada mostra "erro", e quem depende dela também. Só aritmética é executada: depois de trocar os nomes por números, qualquer outra coisa é recusada (`src/shared/sheetFormulas.js`).

### Fontes

- D&D 5e: campos do SRD 5.1, licença CC BY 4.0 (Wizards of the Coast).
- Ordem Paranormal: mecânica de jogo da Jambô Editora (nomes de campos, atributo-base de cada perícia e fórmulas de recursos por classe). Conferida contra o sistema comunitário `SouOWendel/ordemparanormal_fvtt`. Nenhum texto do livro foi copiado.

## Importar ficha de PDF ou imagem

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