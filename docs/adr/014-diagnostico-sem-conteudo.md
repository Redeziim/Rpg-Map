# 014 — Diagnóstico limitado a metadados controlados

- Estado: aceita
- Data: 2026-10-02
- Escopo: item 40

## Decisão

Correlacionar operações da API por ID aleatório e registrar somente campos de vocabulário fixo: operação, resultado, status, duração e bytes. A exceção não é impressa; códigos SQLite são usados apenas para classificação. SSE registra falhas após a conexão com o mesmo ID. O log é limitado por minuto, sem fila persistente, e falha de escrita nele não altera a operação da mesa.

## Consequências

O diagnóstico identifica onde e quando ocorreu uma falha sem copiar notas, imagens, consultas de URL ou credenciais. A limitação pode suprimir eventos sob carga, embora os contadores internos continuem. Retenção e rotação do fluxo do processo pertencem ao operador do serviço. Não há novo esquema, endpoint administrativo, dependência ou serviço externo.
