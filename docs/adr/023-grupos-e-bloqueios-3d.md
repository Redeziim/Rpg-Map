# 023 — Grupos, duplicações e bloqueios da Mesa 3D

Data: 2026-10-03. Estado: aplicado localmente.

O projeto escolheu bloquear movimento, rotação e tamanho até desbloquear, inclusive pelos números e no servidor. Seleção múltipla e grupos precisam preservar a aparência dos modelos e reutilizar os pacotes já enviados.

Decisão: poses globais planas, grupos com identidade estável e associação por `groupId`. O pivô visual aplica rotação e tamanho uniforme ao conjunto sem tornar as malhas filhas de um grupo com escala não uniforme. Agrupar/desagrupar mantém as poses existentes. A migração numerada do estado 1 para 2 acrescenta grupos, versões e bloqueios; não muda a estratégia SQLite/JSON nem o esquema SQL.

A API interna valida acesso, bloqueio e versão da coleção dentro da mesma transação. Duplicações recebem identificadores novos e reutilizam `assetId`; um pacote só é removido após desaparecer a última referência. Campos numéricos e fila capturam a versão anterior; conflito preserva o ajuste local e exige escolha explícita. Clientes antigos continuam editando objetos soltos, mas não podem transformar objetos bloqueados ou membros isolados de grupos.

Consequências: grupos são planos, tamanho do conjunto é uniforme e um lote conflita com alterações em qualquer objeto/grupo da coleção. Não há serviço externo, dependência nova ou cópia de arquivos por instância. Recursos visuais respeitam o contrato de descarte e a reconstrução WebGL existentes. Contratos, ensaios e limites em [TABLETOP_OBJECTS.md](../TABLETOP_OBJECTS.md).
