# 015 — Diagnóstico SQLite local e somente leitura

- Estado: aceita
- Data: 2026-10-02
- Escopo: item 41

## Decisão

Fornecer um CLI local com saída humana ou JSON e código de saída verificável. O banco é aberto em modo somente leitura, com transação para uma visão consistente do WAL. O comando executa `quick_check` e `foreign_key_check`; a verificação completa é explícita. Ocupação por mesa é estimada a partir do tamanho dos campos persistidos, separada dos tamanhos físicos do SQLite e dos arquivos WAL/SHM. Nenhum conteúdo privado é impresso.

## Consequências

O operador pode conferir saúde e crescimento sem iniciar uma sessão web ou alterar a mesa. A estimativa não atribui índices, overhead de páginas ou espaço livre a uma mesa específica. A análise completa pode demorar em bases grandes; deve ser feita numa cópia consistente quando necessário. Não há migração, endpoint, dependência ou serviço externo novo.
