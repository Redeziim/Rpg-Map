# Direção gótica sutil

Decidida em 2026-10-08 a partir de nove imagens de referência e quatro respostas do dono do projeto. Este documento diz o que foi escolhido, onde vive no código, o que mudou em cada rodada e o que ainda falta.

## O que foi pedido

Mais gótico e sombrio, porém **sutil, nada vibrante**. A opção de trocar de tema ficou para depois (e já existe: ver [DESIGN_TOKENS.md](DESIGN_TOKENS.md#temas)). Respostas:

| Pergunta | Escolha |
| --- | --- |
| Letra dos títulos | Serifa gótica sóbria. Letra gótica pesada só na marca "Grimório". |
| Equilíbrio de cor | Ouro dominante, vinho de apoio. |
| Textura e ornamento | Grão leve e linhas finas. Cantos ornamentados só nos painéis principais. |
| Tela piloto | Ficha de personagem. |

## O que as referências ensinaram

- Vermelho profundo e ouro envelhecido (guerreiro de capuz, tinta vermelha com flocos de ouro): entram como vinho e ouro dessaturados, sem saturação alta.
- Névoa fria com uma luz quente só (lampião, velas): cinza esverdeado `--fog` para informação secundária; calor reservado ao ouro.
- Molduras finas e cantos decorados (pacote gótico vermelho, retratos de Darkest Dungeon): cantos em L e anel duplo no retrato da ficha.
- Mármore rachado e parede desgastada: fio de rachadura como divisória (`--crack`) e grão no fundo (`--grain`).
- Texto de regras denso (Tuz): fica legível; a decoração não entra no texto corrido.

## Onde está

| O quê | Arquivo |
| --- | --- |
| Paleta, fontes e tokens (tema sombrio) | `src/theme.css` (`:root`) |
| Tema claro | `src/themeLight.css` |
| Grão, rachadura, marca, fundo, algarismos | `src/gothic.css` |
| Navegação lateral e páginas comuns | `src/ShellGothic.css` |
| Entrada e "Minhas mesas" | `src/AccountGothic.css` |
| Ficha de personagem e ficha em livro | `src/components/SheetGothic.css`, `SheetBook.css` |
| Barra lateral de ícones, faixa de turnos e notas, ferramentas do mapa | `src/CompactShell.css` |
| Mapa mental das notas | `src/components/NoteBoard.css` |
| Tela de erro | `src/ErrorBoundary.css` |
| Fontes do tema | `index.html` (Cormorant Garamond, Grenze Gotisch, Source Sans 3, Cinzel) |
| Fontes decorativas da ficha | `src/shared/sheetFonts.js` (carregadas sob demanda) |

## Rodadas

1. **Paleta e piloto (2026-10-08).** Carvão, ouro envelhecido e vinho nos tokens; Cormorant nos títulos e Grenze Gotisch na marca; grão e rachadura; a ficha como tela piloto, com cantos em L, cartões de seção com losangos e retrato com anel duplo.
2. **Contraste, molduras e ficha adaptativa (2026-10-08).** Bordas, filetes e texto secundário mais claros (`--rule`, `--rule-strong`, `--gold-deep`, `--muted`); moldura dupla na ficha. A ficha passou a se adaptar ao modelo (`src/shared/sheetFormulas.js`):
   - `pairModifiers` junta cada atributo ao seu modificador ("Mod. Força" ou "Modificador de Força") no mesmo cartão;
   - `formatModifier` mostra o sinal com um menos de verdade (+2, −1, +0) e "—" quando o atributo está vazio, em vez de −5;
   - `isCompactCategory`: categoria de 5 ou mais campos, todos numéricos (perícias, salvaguardas), vira lista compacta em colunas;
   - a Ordem Paranormal, com cinco atributos sem modificador, usa os mesmos cartões grandes, sem a faixa de modificador.
3. **Demais telas, tema claro e ficha em livro.** A direção chegou à entrada, ao mapa, às notas e à linha do tempo; todas as cores literais viraram token (o teste limita em 0, com a roda de cores do traço do mapa como única exceção); entrou o seletor de tema claro e sombrio; a ficha ganhou o formato de livro (`docs/SHEET_BOOK.md`).
4. **Revisão de usabilidade.** Barra lateral só de ícones, turnos e cadernos de notas em botões minimizados, ferramentas do mapa reduzidas, Mapa mental redesenhado. Ver [REVISAO_UX.md](REVISAO_UX.md).

## Decisões que valem lembrar

- **Algarismos alinhados.** A Cormorant usa números "antigos" por padrão (o 0 parece um o). Valores de jogo exigem algarismos alinhados, então `font-feature-settings:"lnum"` é forçado em todo o tema e também nas janelas de nota, que ficam fora do `.mist-theme` (o atalho `font:` de vários componentes zera o herdado).
- **Fonte padrão da ficha.** O id salvo `cinzel` continua válido (servidor e salas antigas), mas mostra "Grimório (padrão)" e usa `--font-display`. As outras cinco opções (MedievalSharp, Uncial Antiqua, IM Fell English, Metamorphous, Grenze) vêm do Google Fonts só quando alguém as escolhe, para não pesar toda abertura do app.
- **Temas só por tokens.** Cor e fonte passam por tokens; um tema novo redefine os tokens sob `:root[data-theme="..."]` sem tocar nos componentes.
- **Raio do arco dos atributos.** O projeto usa raios de 2 e 4 px; o cartão de atributo da ficha é um arco de pedra e usa `--radius-arch` (48 px), a única exceção, nomeada como token.
- **Alvos de toque.** O mínimo do projeto é 44 px. No computador, os controles novos da faixa de cima e do Mapa mental ficam em 36 a 40 px para a tela respirar; em tela de toque (`pointer:coarse`) voltam a 44 px.
- **Animação da barra lateral.** A barra tem sempre a largura aberta; só a máscara (`clip-path`) anda, em 200 ms, sem refazer layout. Os nomes entram 80 ms depois, só com opacidade e um passo à esquerda, e saem antes de a barra fechar, que espera 150 ms para não piscar quando o mouse passa de um botão a outro. Sem animação para quem pede movimento reduzido, e aberta em alto contraste.
- **Movimento.** A direção não adiciona animação ornamental. A seta de instrumento em uso das Ferramentas de mestre respeita `prefers-reduced-motion`.
- **Checagens de acessibilidade.** O contraste dos dois temas é testado na suíte (`tests/themeLight.test.js`). A varredura com axe-core nas abas, em 1366, 900 e 420 px, é feita à mão com o navegador de teste e não faz parte da suíte.

## O que falta

1. Ilustração de fundo e retrato de personagem em estilo ilustrado: depende de arte própria.
2. Hospedar as fontes localmente. Hoje o app depende do Google Fonts; sem rede, a marca e os títulos caem na fonte de reserva.
3. Teste automatizado de interface (a casca nova, o botão de Turnos, os cadernos e as ferramentas do mapa só são verificados à mão).
4. A escolha de resolução ao enviar o mapa ("Mais leve" ou "Mais detalhe") ainda aparece antes de publicar.
