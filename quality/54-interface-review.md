# Item 54 — revisão da recuperação de combate

## Escopo e direção

Aviso na faixa de turnos da bancada tática existente: margem ocre, título curto, explicação e ações nomeadas. Sem nova animação. React 18/Vite preservados; estado confirmado não é copiado para um segundo combate local.

Skills aplicadas: `frontend-design`, `vercel-react-best-practices`, `tdd` e `web-design-guidelines`. Regras atualizadas consultadas em [Web Interface Guidelines](https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md).

## Revisão

- `src/components/TurnTracker.jsx:58` — aviso usa status sem depender de cor; botões semânticos com ações específicas. Controles de alteração bloqueados enquanto pendente. Título e explicação foram separados para evitar texto colado.
- `src/components/TurnTracker.css:8` — texto quebra, ações se distribuem, foco visível de 2 px. Botões de recuperação têm pelo menos 44 px de altura. Sem `transition: all` nem movimento novo.
- `src/components/useCombatRecovery.js` — consulta automática depende da retomada de conexão/identidade; não há repetição automática de POST. Valores derivados não usam efeitos extras. Estado local contém intenção, não uma ordem reconstruída.
- `src/components/TurnTracker.jsx:23` — confirmação limpa o nome apenas se ainda corresponder ao personagem enviado. Corrigida limpeza redundante que apagava um próximo nome digitado durante a resposta pendente; validado no navegador.

## Evidências do navegador

Banco descartável com contas de teste, sem tocar no banco real. Vite 5178 e API isolada; proxy temporário de teste fora do produto para descartar/segurar respostas HTTP.

1. POST confirmado com resposta descartada: avanço aparece uma vez; outros comandos bloqueados.
2. Recarga conserva a identidade pendente. Reconexão/reinício consulta e libera o mesmo resultado.
3. Pedido não encaminhado: consulta sem confirmação oferece reenvio explícito da mesma ação; aplica uma vez.
4. Resposta antiga segurada, seguida de ação de outro mestre/SSE mais novo: a ordem recente permanece ao liberar a resposta.
5. Celular 390×844: largura de conteúdo 382 px, sem rolagem horizontal da página; Verificar resultado com 44 px. Enter confirma sem novo avanço; rodada 5 e participante ativo conservados.
6. Nome do próximo personagem permanece `Próximo personagem` ao confirmar o anterior.

Erros de rede HTTP durante as simulações são esperados. O servidor normal e uma aba nova foram conferidos depois da retirada do proxy. Imagens: `54-combat-unknown-desktop.png`, `54-combat-unknown-mobile.png`, `54-combat-confirmed-mobile.png` e `54-combat-confirmed-desktop.png`.

## Limites

Revisão restrita aos controles afetados. Auditoria geral de zoom, contraste, leitor de tela e demais telas continua nos itens 60–66. Expiração e cópia local ilegível pedem conferência explícita; não há fila de execução offline.
