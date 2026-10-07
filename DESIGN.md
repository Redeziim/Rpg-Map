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
| Mapa 2D | Cartografia impressa: legenda, escala, rosa dos ventos | Legenda e escala como parte da imagem exportada, não como painel flutuante | Proposto |
| Ferramentas de mestre | Painel tático de instrumentos: seções recolhíveis, numeração só onde há sequência | Cada ferramenta ativa acende uma marca dourada na régua lateral | Proposto |
| Mesa 3D | Mesa de madeira escura sob luz baixa | Anel dourado fino em volta do objeto selecionado | Proposto |
| Bandeja de dados | Bandeja de feltro | Sombra projetada curta sob cada dado parado | Proposto |

Regras que valem para todas: uma referência por tela; ouro só para ação e seleção; nenhum cartão arredondado como estrutura; contorno de foco sempre `--focus-ring`; nada que anime sem função.