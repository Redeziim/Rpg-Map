# Item 55 — revisão das condições e efeitos

## Direção e revisão

Faixa tática existente, listas com divisórias e margem ocre. Aviso em texto por turno; painel de consulta compacto e criação em seção própria. Sem animação nova.

Skills: `frontend-design`, `vercel-react-best-practices`, `tdd`, `web-design-guidelines`. Regras atuais consultadas em [Web Interface Guidelines](https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md).

- `src/components/CombatEffects.jsx:25` — avisos de turno e quantidade usam status; encerramento tem texto explícito, inclusive nome do efeito no turno do alvo.
- `src/components/CombatEffects.jsx:29` — formulários com labels, nomes, limites, exemplos e controles de 44 px; duração em rodadas com entrada numérica. Sem autofocus ou bloqueio de colagem.
- `src/components/CombatEffects.jsx:47` — lista contém nome/alvo/origem/duração; remoção tem nome acessível e confirmação inline, com Cancelar e revisão de conflito. Depois de confirmar/cancelar, foco volta ao resumo do painel.
- `src/components/CombatEffects.jsx:19` — texto não enviado avisa antes de recarregar/fechar. Valor/versão capturados na edição; confirmação limpa somente uma intenção ainda correspondente.
- `src/components/TurnTracker.css` — uma coluna no celular, quebra de textos, foco de 2 px, botões ≥44 px, opções nativas com cores explícitas, toque/rolagem interna e `content-visibility` para até 80 registros. Sem transição genérica ou leitura de layout no render.

## Evidências reais

`npm run dev`, Vite 5178/API 3106, SQLite descartável. Inicialização aplicou 0 migrações SQL e 1 mesa JSON, preservando modelos/notas/mapa e rodada 5. Não foi usado o banco real.

Desktop 1440×900:

- Adição por Enter de Proteção, duas rodadas; Atordoado até próximo turno; efeito reservado manual.
- Pular para Guarda encerrou Atordoado; aviso citou seu nome e lista mostrou Encerrado.
- Próxima rodada mostrou Proteção com 1 restante. Outro mestre alterou o combate enquanto um nome estava digitado; texto permaneceu, submit ficou bloqueado e revisão explícita permitiu adicionar.
- Cancelar remoção conservou o efeito; Confirmar removeu e devolveu foco ao resumo, outline 2 px.

Celular 390×844:

- Adicionar um efeito, preencher e enviar por teclado; Abençoado manual apareceu no turno do jogador.
- Página 382 px, sem overflow horizontal; botões Remover medidos em 74×44 px e foco 2 px.
- Modo jogador sem criação/remoção nem nome/origem de Maldição reservada; contagens incluíram somente os efeitos públicos.
- Recarga/reabertura conservou rodada 6, Proteção com 1 restante e Abençoado manual. Console de erros vazio.

Imagens: `55-effects-desktop.png`, `55-effects-mobile.png`, `55-effects-player-mobile.png`. HTTP integrado cobre privacidade em GET/SSE/exportação, confirmação por identidade, duração, falha/rollback e backups/migração. Suíte 133/133 e build aprovados.

Auditoria geral de todas as telas continua nos itens 60–66. Leitor de tela e zoom geral não foram declarados validados por esta revisão restrita.
