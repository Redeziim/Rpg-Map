# Perguntas em aberto

Atualizado em 2026-10-07. Respondidas e já implementadas: 16 (lixeira só apaga quando esvaziada), 17 (exportar em TXT, PNG e JSON), 58 (modelos de D&D e Ordem Paranormal, com leitura de PDF e imagem). O que segue espera uma resposta do mestre da mesa.

## Item 23 — achar e agrupar os pontos do mapa

**O que é.** No mapa 2D cada ponto é um alfinete: cidade, dungeon, taverna, floresta ou evento. Hoje, para achar um ponto, você olha o mapa ou abre um por um. Com 10 pontos isso funciona; com 60 não.

**Opção A — buscar e filtrar pelo que já existe.** Entra uma caixa "Buscar ponto" e botões por tipo (Cidades, Dungeons, Tavernas…), com uma lista ao lado do mapa. Clicar num item da lista centraliza o ponto. Exemplo: digitar "porto" mostra "Porto de Valdrin" e "Porto velho"; tocar em "Taverna" mostra só as tavernas. Não cria campo novo e não mexe nos dados já salvos. Jogadores só veem na lista os pontos que a névoa já revelou.

**Opção B — A mais região e etiquetas.** Cada ponto ganha "Região" (ex.: "Costa Norte") e etiquetas (ex.: "missão ativa", "visitado"). A lista fica agrupada: "Costa Norte (7)", "Floresta Sombria (4)". Serve para campanhas grandes, mas acrescenta campos ao ponto: muda os dados salvos (com migração) e a revisão de conflito, hoje por nome, descrição e tipo, passa a incluir região e etiquetas.

**Opção C — continuar adiado.**

Recomendo **A agora**; B só se o mapa passar de uns 30 pontos e você sentir falta de agrupar. Para decidir: quantos pontos suas mesas costumam ter?

## Item 64 — aplicar a direção visual

Você pediu para deixar para depois das funcionalidades. As propostas por tela estão em `DESIGN.md`. Quando for a hora, a pergunta é em qual tela começar: Ferramentas de mestre (recomendada), Mapa 2D, Mesa 3D ou Bandeja de dados.

## Importação de fichas

- Você tem uma ficha real de D&D ou da Ordem Paranormal (PDF ou print) para eu testar? Os testes usaram fichas feitas por mim; fichas oficiais têm fontes e fundos diferentes e o OCR pode errar mais.
- Quer um dia uma leitura por IA (um modelo de linguagem lendo o arquivo)? Ela leria melhor fichas difíceis, mas enviaria a ficha a um serviço externo, com custo, chave e privacidade a decidir. Hoje nada sai do navegador.
- Quais sistemas depois? Já existem D&D 5e e Ordem Paranormal; os próximos entram em `src/shared/sheetTemplates.js`.

## Resumo assistido de sessão (item 59, futuro)

O resumo de sessão é escrito à mão. Um resumo por IA enviaria o texto das sessões a um serviço externo; só discuto se você pedir.

## Publicação

Os commits estão no repositório local e nenhum foi enviado ao GitHub. O push é seu.