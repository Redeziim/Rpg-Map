# Grimório — direção visual

A mesa usa a linguagem de uma ficha física sobre uma capa preta fosca: inscrições douradas e pequenos detalhes de vermelho fechado.

## Paleta

- Preto fosco: `#101010`, fundo da aplicação.
- Carvão neutro: `#181818`, superfície da ficha.
- Dourado envelhecido: `#c8a65e`, hierarquia, bordas e ações principais.
- Vermelho fechado: `#8f3037`, marcadores de seleção e detalhes.
- Vermelho claro: `#c97770`, pequenos textos sobre superfícies escuras.
- Marfim: `#eee7d9`, texto principal.

Sem reflexos metálicos, brilho neon ou dominante verde. A névoa usa duas camadas neutras e discretas em movimento contínuo lento, com ciclos alternados de 38 e 53 segundos. Com preferência por movimento reduzido, ela fica estática. Vermelho nunca é o único sinal de seleção: borda, texto e posição também distinguem os estados.

## Tipografia e organização

Cinzel para títulos e atributos; a fonte de ficha escolhida pelo mestre continua disponível. Os controles mantêm a tipografia existente. Alinhar campos à esquerda e números de atributos ao centro.

Manter a navegação, o retrato, as categorias da ficha e os dados nas posições existentes. Esta mudança é visual; não altera rolagens, dados salvos ou permissões de edição.

## Skills

`frontend-design` orienta a direção estética. `web-design-guidelines` apoia a revisão de contraste, foco visível e telas estreitas.

## Direção por tela (item 64)

Proposta de 2026-10-07, dentro da identidade acima. Cada tela tem uma referência dominante e um detalhe memorável; o resto fica quieto. Tokens em `docs/DESIGN_TOKENS.md`. Nada abaixo foi aplicado além do que já existe nas telas; a tela-piloto depende de decisão.

| Tela | Referência dominante | Detalhe memorável | Estado |
| --- | --- | --- | --- |
| Linha do tempo (leitor) | Marginalia de diário: data na margem, texto corrido | Filete dourado na margem que marca o tipo do registro | Aplicado |
| Ficha | Ficha física em papel carvão | Atributos centrados, nome em Cinzel | Aplicado (ver acima) |
| Mapa 2D | Cartografia impressa: legenda, escala, rosa dos ventos | Escala como parte da imagem, não como painel flutuante (a legenda editável e a exportação saíram do aplicativo: ADR 036) | Proposto |
| Ferramentas de mestre | Painel tático de instrumentos: seções recolhíveis, numeração só onde há sequência | Cada ferramenta ativa acende uma marca dourada na régua lateral | Aplicado (tela-piloto, 2026-10-07) |
| Mesa 3D | Mesa de madeira escura sob luz baixa | Anel dourado fino em volta do objeto selecionado | Proposto |
| Bandeja de dados | Bandeja de feltro | Sombra projetada curta sob cada dado parado | Proposto |

Regras que valem para todas: uma referência por tela; ouro só para ação e seleção; nenhum cartão arredondado como estrutura; contorno de foco sempre `--focus-ring`; nada que anime sem função.
### Ferramentas de mestre — tela-piloto aplicada

Painel "Ferramentas do mestre" (Mapa 2D, para jogadores "Ferramentas do mapa"). Estilos em `src/components/MasterTools.css`; estado dos instrumentos em `src/shared/mapInstruments.js`; seção em `src/components/ToolSection.jsx`.

- **Índice de instrumentos.** Todos os instrumentos aparecem de uma vez, recolhidos, cada um com seu estado à direita ("Névoa · Desligada", "Pontos · 12", "Controles · 100%"). Antes as ferramentas ficavam depois de "Mapa" e de uma lista de cartões, no fim da rolagem. A ordem é: Pontos, Controles e zoom, Grade e régua, Névoa, Imagem do mapa (só para o mestre) e, em "Mais ferramentas", Posições e Traços. Rotas, Legenda e Exportar saíram em 2026-10-08 (ADR 036). Para jogadores a seção Pontos já abre aberta.
- **Régua lateral (detalhe memorável).** Uma coluna de marcas (a cada 8 px, e mais longas a cada 48 px) corre pela borda esquerda. O instrumento em uso (medir, névoa ou posição) ganha na régua uma seta dourada, o estado "Em uso" escrito e o título do instrumento em dourado; o cabeçalho diz "Em uso: …" (região `role=status`). Cor não é o único sinal: em contraste forçado a seta usa `Highlight`.
- **Hierarquia.** Títulos em Cinzel pequeno, estados em Source Sans mutado, filetes entre linhas no lugar de caixas; sem gradiente, sem cartões, sem movimento. Os nomes dos pontos usavam a fonte padrão do navegador (Arial) por causa de um bloco de CSS antigo dentro do JSX; passaram para a fonte do app.
- **Pontos.** Linhas densas separadas por filete; marca dourada à esquerda ao passar o mouse e no ponto encontrado; ações de 44 px (ver no mapa, excluir); listas longas em páginas de 40 com "Mostrar mais", sem rolagem dentro da rolagem.
- **Preservado.** Nenhuma função mudou: mesmas seções, mesmos controles, mesmas permissões.

Verificação: axe-core sem violações com o painel em repouso e com todas as seções abertas; nenhum título quebra em duas linhas a 360 px; sem rolagem horizontal a 390 px; alvos de 44 px (o único menor é o campo de arquivo escondido dentro do botão de imagem); `tests/mapInstruments.test.js`.