# Resumo da entrega — 2026-10-02

Esta entrega conclui os diagnósticos seguros da API e do SQLite, itens 40 e 41, junto da manutenção do item 39. O próximo item do plano é o 42. Os itens abaixo continuam pendentes.

## O que mudou

| Área | Entregas |
| --- | --- |
| Notas | Criação em branco, busca no caderno e na janela aberta, destaque de resultados, rascunhos em localStorage/IndexedDB, revisão de conflitos por campo, compartilhamento e histórico com restauração seletiva. Coleção de imagens com validação e deduplicação. |
| Mapa mental | Zoom e quadro expansível, janela fixa no canto inferior esquerdo com opção de soltar/redimensionar, vínculos com pontos 2D, conexões sem setas acompanhando o arraste, rótulos, tipos/etiquetas, seleção múltipla, alinhamento e distribuição. Controles agrupados em opções/detalhes. |
| Mapa 2D | Prévia de imagem, troca controlada, revisão de conflitos por campo nos pontos, permissões do modo jogador, cores livres para traços, camadas, névoa protegida no servidor, grade/régua/escala, posições, vínculos a cenas/notas, rotas, legenda e exportação PNG da visão. |
| Dados e confiabilidade | Backup verificável, restauração em banco novo, migrações explícitas, backups automáticos com retenção/alertas, revisão de transações, retomada de sessão/conexão, preservação de rascunhos, transferência de imagens por cache/referências, registro de alterações da mesa, limpeza limitada de registros vencidos, diagnóstico de requisições sem conteúdo privado e CLI de integridade/ocupação SQLite. |
| Exportação da mesa | Arquivo JSON com estado permitido, fichas/status, notas/quadros, versões autorizadas, imagens incorporadas e pacotes completos da mesa 3D. Resumo de conteúdo/tamanho, cancelamento, prazo e download nativo. Notas privadas de terceiros e versões anteriores ao compartilhamento ficam fora; o modo jogador mantém pixels e geometria ocultos protegidos. Arquivos deixados após crash agora são removidos quando a propriedade e o fim do processo podem ser comprovados. |
| Organização do projeto | Skills de desenvolvimento, instruções em AGENTS.md, convenções de issues/documentação e decisões de arquitetura registradas. Framework e persistência canônica preservados. |

A cena 3D aberta por um ponto 2D foi removida. A **Mesa 3D independente** permanece. A rolagem usa a bandeja; a documentação foi alinhada. Modelos de nova nota, visão geral/Enquadrar tudo e PDF permanecem fora da interface conforme as decisões do projeto.

## O que ainda falta

### Notas e mapa mental

- **2, validação restante:** aprofundar recuperação de rascunhos quando o navegador falha totalmente ou uma aba é duplicada. As cópias locais e o aviso/arquivo de emergência já existem.
- **16:** arquivamento, lixeira e recuperação de notas.
- **17:** exportação individual de notas/quadros. A cópia por mesa já inclui as notas permitidas.
- **18:** ajuda de atalhos dentro do quadro e acabamento das preferências pessoais de zoom.
- Refinamento amplo do mapa mental: adiado a pedido do projeto.

### Mapa 2D

- **23:** organização/filtros dos pontos por região, etiqueta, estado e tipo — adiado quando o foco mudou para buscar palavras nas notas.

### Mesa 3D

- **42–45:** reduzir cópias base64/memória, validar malhas/texturas/dependências, liberar recursos ao trocar/remover objetos e tratar perda de WebGL ou falta de suporte.
- **46–47:** progresso real e cancelamento de importação; prévia de escala, orientação e posição.
- **48–49:** agrupamento, duplicação e bloqueio; níveis de detalhe e carregamento gradual.
- **50–51:** referências com ponto/cena/nota e configurações de iluminação/câmera por cena.
- Cena 3D por ponto: ideia guardada, só deve voltar após nova decisão do projeto.

### Combate e campanha

- **52–54:** estado único de combate, histórico contextual de rolagens e recuperação completa após reconexão/reinício.
- **55–56:** condições/efeitos/alertas e ampliação das cenas com notas e participantes. Cenas com texto e vínculos a pontos já existem.
- **57–59:** linha do tempo, regras opcionais por sistema e resumos/preparação de sessões.

### Visual e acessibilidade

- **60–62:** revisão geral de teclado, foco, contraste, leitores de tela, estados de erro/carregamento/offline e controles em telas estreitas.
- **63–66:** consolidar tokens e direção visual por tela, movimento reduzido em todo o site e desempenho de fontes/imagens/componentes pesados.

O detalhamento e as prioridades continuam em [PLANO_DE_MELHORIAS.md](../PLANO_DE_MELHORIAS.md).

## Limites da entrega

Diretórios de exportação do formato antigo, sem marcador de dono, não são excluídos automaticamente. Um PID reutilizado ou uma pasta com conteúdo inesperado também pode exigir inspeção manual. O procedimento está em [MAINTENANCE.md](MAINTENANCE.md). O JSON exportado ainda não pode ser importado pela interface; consulte [ROOM_EXPORT.md](ROOM_EXPORT.md).

Os [eventos de diagnóstico](DIAGNOSTICS.md) são limitados a 60 por minuto; a rotação do log do processo é externa. A [ocupação do banco](DATABASE_DIAGNOSTICS.md) é uma estimativa de payload, separada dos bytes físicos de índices, páginas e WAL. A verificação completa de um banco grande pode demorar; use uma cópia consistente para uma análise pesada.

## Validação

- Nove testes novos cobrem manutenção de sessões/temporários, classificação e privacidade dos eventos, falha do destino de log, integridade/contagens, referência inválida, arquivo ilegível e WAL ativo sem alteração dos arquivos.
- Migração a partir do banco 2, backup antigo, exportação existente e rollback permanecem cobertos pelos testes relacionados.
- Suíte completa: **95 testes, sem falhas**. Build de produção passou, com o aviso já conhecido de tamanho do pacote Three.js.
- `npm run dev` com SQLite descartável abriu a tela de login no navegador e respondeu `/api/health` com `X-Request-ID`. O CLI com `--full --json` aprovou integridade, referências e esquema do banco ativo. A verificação visual detalhada de desktop/celular da interface não foi repetida porque esta etapa não alterou componentes ou estilos.
