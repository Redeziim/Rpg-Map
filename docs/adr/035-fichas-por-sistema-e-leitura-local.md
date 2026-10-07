# 035 — Fichas por sistema e leitura local de arquivos

Data: 2026-10-07. Estado: aceito conforme pedido do usuário (modelos de D&D e Ordem Paranormal, leitura de PDF e imagem).

## Contexto

O mestre montava a ficha campo a campo. O usuário pediu modelos dos sistemas conhecidos e uma forma de transcrever uma ficha existente (PDF, print, imagem), usando talvez uma IA embutida.

## Decisão

- Modelos de sistema são listas de campos aplicadas ao modelo da mesa, que continua editável; nenhum sistema é fixado para a mesa.
- A leitura de arquivos acontece no navegador, sem serviço externo: PDF.js para texto e campos de formulário, Tesseract (WebAssembly) para imagens e PDFs escaneados, com os arquivos do motor e dos idiomas servidos pelo próprio servidor (`public/vendor/ocr`, copiados da `node_modules` por `scripts/prepareOcr.js` antes de `dev` e `build`).
- O resultado é sempre uma sugestão revisada pela pessoa campo a campo; nada é salvo sem confirmação.
- As bibliotecas ficam em `devDependencies`, pois só o build as usa; a imagem de produção não cresce.
- Uma IA externa foi descartada por ora: enviaria o conteúdo da ficha a terceiros, com custo e chave. Fica como opção futura, sujeita a aprovação do usuário.

## Consequências

Funciona sem internet e sem enviar dados. A qualidade do OCR depende da imagem e a revisão é indispensável. O primeiro uso baixa cerca de 12 MB do servidor. As fórmulas da ficha ganharam funções e dependência entre fórmulas, e continuam executando só aritmética. Contrato: `docs/SHEET_SYSTEMS.md`.