# 037 — Biblioteca de modelos de ficha por conta

Data: 2026-10-09. Estado: aceito conforme pedido do usuário.

## Contexto

O ADR 035 trouxe modelos de D&D e Ordem Paranormal e a leitura de PDF e imagem para **preencher valores**. O usuário pediu duas coisas a mais: (1) ler um PDF, uma imagem ou um TXT para **gerar o modelo** (os campos) e adaptar-se a ele, e (2) um banco de dados onde esses modelos fiquem guardados **só para quem os criou**, junto de mais sistemas famosos já prontos, para não precisar mandar a ficha de um sistema conhecido toda vez.

## Decisão

- **Tabela `sheet_models`** (migração `009-sheet-models`, `user_version=9`): `id`, `owner_id` (conta), `name`, `fields` (JSON), `source` (`file`, `room` ou `manual`), `created_at`, `updated_at`; índice por dono. O modelo pertence à conta, não à mesa: só o dono lista, renomeia e apaga; nenhuma mesa o enxerga até a pessoa aplicá-lo.
- **API** `GET/POST /api/sheet-models`, `PATCH/DELETE /api/sheet-models/:id`, só com sessão. Até 30 modelos por conta, 200 campos por modelo, nome único por conta sem diferenciar maiúsculas. As regras de validação são as mesmas do navegador (`src/shared/sheetModels.js`) e as mesmas que conferem o banco ao migrar, fazer backup e restaurar (`assertSavedSheetModels`).
- **Um modelo guarda só tipo, nome, categoria e fórmula** de cada campo. Os ids são criados de novo ao aplicar o modelo a uma mesa, como já era com os sistemas.
- **Gerar modelo de um arquivo** (`src/shared/sheetModelFromText.js`): lê PDF (texto e nomes dos campos de formulário), imagem (OCR) ou TXT no navegador, reconhece categorias, rótulos, tipo pelo valor ou pelo nome ("barra" para Vida, "longo" para história…) e fórmulas escritas como `Campo = conta`. Rótulos que um modelo pronto conhece ganham o tipo e a categoria dele. O resultado é uma proposta: a pessoa marca, renomeia, troca tipo e categoria, escolhe o nome e só então guarda.
- **Sistemas famosos prontos**, além de D&D 5e e Ordem Paranormal: Tormenta20, Chamado de Cthulhu 7ª, Pathfinder 2ª, Vampiro: A Máscara 5ª, 3D&T Alpha e Old Dragon (`src/shared/sheetSystemsMore.js`). Só nomes de campos e contas de regra; nenhum texto de livro.
- A leitura de valores de uma ficha (ADR 035) continua como estava e passou a aceitar TXT.

## Consequências

O banco passa a ter uma tabela por conta, fora do estado das mesas: backup e restauração a levam (`npm run backup`), a exportação de uma mesa não. Voltar a um código anterior exige o backup anterior à migração, como nas outras. Um modelo gerado de arquivo depende da qualidade da leitura (a revisão é obrigatória), e os sistemas novos foram conferidos pelas regras publicadas, sem teste com fichas oficiais. Contrato e exemplos: `docs/SHEET_SYSTEMS.md`.
