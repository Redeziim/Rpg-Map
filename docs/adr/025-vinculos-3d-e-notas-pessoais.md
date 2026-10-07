# 025 — Vínculos 3D e privacidade das notas pessoais

- Estado: aceita, implementação local
- Data: 2026-10-03
- Escopo: item 50 e correção de acesso às notas pessoais

## Decisão

Guardar vários vínculos por objeto como identificadores tipados, incluindo o caderno para notas, com limite de 90 e identidade própria por relação. Resolver títulos/conteúdo apenas pela visão autorizada atual, inclusive na abertura direta, HTTP, SSE e exportação. Vincular não compartilha a nota. Somente mestre/ADM em modo mestre altera relações; bloqueio de transformações não bloqueia metadados. Duplicar cria IDs novos sem duplicar destinos ou pacotes.

O usuário confirmou que notas pessoais são privadas também diante de mestre/ADM. Corrigir snapshots, histórico, edição e observações legadas para respeitar autoria ou compartilhamento explícito. Mantém-se a proteção de histórico/exportação da decisão 012. **Minhas notas** oferece criação a todos os papéis em todas as abas, preservando a identidade dos rascunhos antes usada na ficha. **Notas do mestre** continua sendo o caderno da campanha gerenciado por mestres/ADM.

Propagar o modo do mapa à sincronização geral mantendo o papel real. Destinos sem acesso não têm IDs/títulos enviados aos jogadores; administradores recebem marcador genérico com identidade da relação para retirá-la. A versão dos objetos é calculada antes da filtragem. A projeção de pontos em quadros não apaga ligações ocultas quando se salva outra alteração no mesmo cartão.

Estado 3 acrescenta listas vazias aos objetos antigos em uma migração transacional registrada. Não há mudança do banco SQL 4, framework, original dos modelos ou estratégia de persistência.

## Consequências e validação

A regra atual substitui o acesso privilegiado histórico às notas pessoais; os testes antigos foram atualizados com autorização expressa. O bug antigo de criação pelo jogador não se reproduziu, mas o acesso foi simplificado. O usuário pediu validação rápida: um teste HTTP integrado cobre o fluxo e seus riscos, acompanhado de suíte de 126, build e navegador desktop/celular. Sem nova API externa ou dependência. Contrato, evidências e limites em [TABLETOP_REFERENCES.md](../TABLETOP_REFERENCES.md).
