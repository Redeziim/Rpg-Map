# Direção gótica sutil

Decidida em 2026-10-08 a partir de nove imagens de referência e quatro respostas do dono do projeto. Este documento diz o que foi escolhido, onde vive no código e o que ainda falta.

## O que foi pedido

Mais gótico e sombrio, porém **sutil, nada vibrante**. A opção de trocar de tema fica para depois. Respostas:

| Pergunta | Escolha |
| --- | --- |
| Letra dos títulos | Serifa gótica sóbria. Letra gótica pesada só na marca "Grimório". |
| Equilíbrio de cor | Ouro dominante, vinho de apoio. |
| Textura e ornamento | Grão leve e linhas finas. Cantos ornamentados só nos painéis principais. |
| Tela piloto | Ficha de personagem. |

## O que as referências ensinaram

- Vermelho profundo e ouro envelhecido (guerreiro de capuz, tinta vermelha com flocos de ouro): entram como vinho `#6f2a32` e ouro `#b39a63`, sem saturação alta.
- Névoa fria com uma luz quente só (lampião, velas): cinza esverdeado `--fog` para informação secundária; calor reservado ao ouro.
- Molduras finas e cantos decorados (pacote gótico vermelho, retratos de Darkest Dungeon): cantos em L e anel duplo no retrato da ficha.
- Mármore rachado e parede desgastada: fio de rachadura como divisória (`--crack`) e grão no fundo (`--grain`).
- Texto de regras denso (Tuz): fica legível; a decoração não entra no texto corrido.

## Onde está

| O quê | Arquivo |
| --- | --- |
| Paleta, fontes e tokens | `src/theme.css` (`:root`) |
| Grão, rachadura, marca, fundo, algarismos | `src/gothic.css` |
| Ficha de personagem (piloto) | `src/components/SheetGothic.css` |
| Fontes carregadas | `index.html` (Cormorant Garamond, Grenze Gotisch) |

## Decisões que valem lembrar

- **Algarismos alinhados.** A Cormorant usa números "antigos" por padrão (o 0 parece um o). Valores de jogo exigem algarismos alinhados, então `font-feature-settings:"lnum"` é forçado em todo o tema (o atalho `font:` de vários componentes zera o herdado).
- **Fonte padrão da ficha.** O id salvo `cinzel` continua válido (servidor e salas antigas), mas agora mostra "Grimório (padrão)" e usa `--font-display`.
- **Troca de tema no futuro.** Tudo que é cor e fonte passa por tokens. Um tema novo deve redefinir os tokens sob `:root[data-theme="..."]`, sem tocar nos componentes. Para isso funcionar, as 700 cores literais restantes precisam migrar para tokens.
- **Movimento.** A direção não adiciona animação. A seta de instrumento em uso das Ferramentas de mestre respeita `prefers-reduced-motion`.

## O que falta

1. Telas ainda no visual antigo por causa de cores literais: faixa Ordem de jogo, cartões de notas, bandeja de dados, notas, conta. Elas ficam um pouco mais quentes e esverdeadas que a nova paleta.
2. Aplicar a moldura de cantos e a rachadura às demais telas, uma por vez (entrada, mapa e mesa 3D, notas).
3. Seletor de tema (claro/sombrio/básico), depois que as telas estiverem em tokens.
4. Ilustração de fundo e retrato de personagem estilo ilustrado: depende de arte própria, não foi feito.
