# 010 — Transferência de imagens

- Estado: aceita
- Data: 2026-10-01
- Escopo: item 36; complementa [008 — transações](008-transacoes-de-operacoes.md) e [009 — retomada de conexão](009-retomada-de-sessao-e-conexao.md)

## Contexto

O estado da mesa contém data URLs de mapas, avatares e imagens antigas dos quadros. Mesmo com a omissão existente da imagem do mapa no SSE, essas fontes podiam se repetir em snapshots e salvamentos sem mudanças nas imagens. A coleção de notas e os pacotes 3D já possuem recursos próprios, mas suas respostas impediam reutilização pelo cache do navegador.

## Decisão

1. Acrescentar um formato de transferência opcional, depois da filtragem de permissões e névoa. Identificar fontes idênticas pelo SHA-256 da data URL exata; enviar um dicionário de imagens e referências apenas nos campos declarados como imagem.
2. Usar recibos de manifesto por mesa e conta no HTTP e por conexão no SSE. Conservar no servidor somente metadados limitados: 128 manifestos, 65.536 hashes no total e validade de cinco minutos. Cache ausente ou reiniciado recebe fontes completas novamente.
3. Reconstruir as imagens antes de aplicar o snapshot na interface. Conservar fontes anteriores para ordenação HTTP/SSE, com limite de 40 MiB de caracteres de data URL, sem substituir o estado confirmado por uma revisão antiga. Recuperar envelopes incompletos por consulta sem recibo.
4. Reduzir salvamentos somente para fontes do manifesto atual. Resolver referências contra a visão autorizada atual, mantendo verificações de versões e validação de imagens. Conservar fontes completas em SQLite, histórico, rascunhos e exportações locais. Omitir o quadro no envio quando ele não foi editado.
5. Permitir revalidação privada de imagens da coleção e pacotes 3D com ETag. Verificar sessão, participação e disponibilidade do recurso antes de qualquer 304. Usar `private, no-cache, must-revalidate` e `Vary: Cookie`, conforme a [RFC 9111](https://www.rfc-editor.org/rfc/rfc9111.html); respostas de estado continuam `no-store`.
6. Manter o formato original para clientes sem a opção. Quando um cliente atualizado recebe um snapshot legado, limpar o recibo e voltar a enviar fontes completas.

## Consequências e limites

Atualizações comuns passam a transferir metadados e conteúdo alterado, preservando as fontes necessárias no navegador. Recibos não concedem acesso e não removem a obrigação de filtrar snapshots. Cópias obtidas antes de uma retirada de acesso continuam no dispositivo da pessoa; próximas solicitações precisam de autorização atual.

O primeiro carregamento e uma nova conexão SSE ainda transferem imagens completas. Hashes de representações diferentes não são deduplicados por semelhança visual. Esta mudança não garante redução de heap ou FPS e não migra imagens existentes nem muda o transporte da importação base64 da mesa 3D. Persistência, esquema, serviços e dependências permanecem os atuais.

## Verificação

Três testes novos verificam HTTP/SSE, deduplicação, revalidação, referências de entrada, rascunhos completos, ordenação, reinício, compatibilidade e privacidade. A suíte de 80 testes e o build passaram. `npm run dev` foi validado em desktop e celular com banco descartável, incluindo recuperação de rascunho e imagens após recarregamento e reinício. Medições e limites em [MEDIA_TRANSFER.md](../MEDIA_TRANSFER.md).
