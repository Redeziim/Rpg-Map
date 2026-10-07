# Combate confirmado — item 52

O mestre pode reorganizar participantes com as setas, dar o turno a alguém, retirar do combate e **Pular turno**. Jogadores acompanham a mesma ordem. O ADM em modo jogador também apenas acompanha. A iniciativa é opcional: valores inteiros de -999 a 999; **Ordenar por iniciativa** coloca os maiores primeiro, mantém empates na ordem existente e deixa valores em branco por último. Digitar ou salvar uma iniciativa não reorganiza automaticamente a mesa.

## Regras de condução

- Iniciar escolhe o primeiro participante e começa na rodada 1.
- Pular passa ao próximo; ao voltar do último ao primeiro, aumenta a rodada.
- Dar turno escolhe alguém diretamente e conserva a rodada; se ainda não começou, inicia na rodada 1.
- Mover na ordem ou ordenar por iniciativa conserva quem está na vez e a rodada.
- Retirar quem está na vez passa ao próximo participante da ordem anterior. Ao cruzar o fim dessa ordem, aumenta a rodada. Sem participantes restantes, encerra: ativo vazio e rodada 0.
- Retirar um jogador do combate mantém sua conta e iniciativa; **Recolocar na ordem** o acrescenta ao final. Retirar um NPC elimina esse personagem e sua iniciativa.
- Entrar na mesa ou passar de mestre a jogador acrescenta a pessoa ao final. Remover uma conta ou nomear um jogador como mestre retira a pessoa da ordem/exclusões e limpa sua iniciativa na mesma transação. Se estiver na vez, aplica o mesmo avanço.
- Encerrar esvazia o participante ativo e zera a rodada, conservando ordem, NPCs e iniciativas.

## Contrato

O JSON da mesa está na versão **6**, com as condições do [item 55](COMBAT_EFFECTS.md). A única fonte persistida e enviada por HTTP/SSE/exportação é `state.combat`:

```json
{
  "schemaVersion": 2,
  "version": 1,
  "order": [],
  "excluded": [],
  "npcs": [],
  "initiative": {},
  "activeId": null,
  "round": 0,
  "effects": []
}
```

`schemaVersion` descreve o formato; `version` identifica alterações confirmadas. Jogadores usam o nome de conta, que não possui renomeação no produto atual; NPCs usam `npc:<uuid>`. Não crie uma cópia local editável da ordem confirmada. Os antigos `turnOrder`, `turnExcluded`, `turnNpcs` e `activePlayer` são removidos depois da migração, inclusive das respostas e exportações.

`POST /api/rooms/:id/turns` continua sendo a rota de ação. Envie `action` e a `version` consultada. Ações: `next`, `skip`, `end`, `select`, `up`, `down`, `remove`, `include`, `add`, `initiative` e `sort`. Ações por participante usam `player`; adicionar usa `name`/`kind`; iniciativa usa `value`, com `null` para limpar. Campos desconhecidos são recusados. Não há atualização livre do combate por `/state`.

Leitura, comparação da versão, ação, validação, revisão e registro administrativo são transacionais. Só depois do commit o servidor publica SSE. Uma alteração aumenta a versão do combate e a revisão da mesa uma vez. Uma ação sem mudança não regrava o estado/auditoria nem emite um evento, mas pode guardar sua confirmação por identidade. Versão ausente/inválida retorna 400; versão antiga, 409; acesso de jogador, 403. Alterações em outras áreas da mesa não invalidam a versão do combate.

## Rascunhos e migração

O campo de iniciativa conserva o valor e a versão em que a edição começou. Em conflito, apresenta a iniciativa confirmada ao lado do rascunho e oferece **Aplicar à ordem atual** ou **Cancelar**; não repete a escrita sozinho. O nome de NPC digitado também permanece se o envio falhar. O estado confirmado não é alterado antes da resposta.

A migração 005 aceita estados 0–4, conserva ordem/NPCs/exclusões válidos, materializa os jogadores que antes eram acrescentados somente na leitura e inicia a rodada em 1 se havia alguém ativo. Os dados antigos não tinham rodada ou iniciativa: não são inventados valores além desse início. Campo antigo incompatível impede toda a migração. Notas, pontos, imagens, pacotes, objetos, grupos, iluminação e acesso são preservados. Esquema SQL continua em 4.

Backup/restauração conferem os papéis e o contrato em memória, conservando os bytes das cópias anteriores. Reiniciar não repete a migração. Leia [MIGRATIONS.md](MIGRATIONS.md) e ADR 028.

## Validação

Um fluxo HTTP integrado cobre ações, rodada, papéis, ausência de versão, validação, concorrência 200/409, SSE, remoção/promoção/reentrada, migração 4→5, reinício, exportação, audit e backup/restauração. O teste existente de migrações cobre campo antigo inválido com rollback integral. Regressões de transações conservam estado e eventos quando a escrita falha.

Suíte completa: **130 testes aprovados**. Build aprovado. Navegador HTTP com banco descartável: desktop 1440×900 e celular 390×844, criação/reordenação, pular/retirar/recolocar, iniciativa por Enter, ordenação, conflito real com valor preservado, modo jogador, foco de 2 px e reabertura da mesa com rodada/NPCs/iniciativas conservados. Controles de pelo menos 44 px; página mobile 382 px; nenhum erro de console observado. Evidências em `quality/52-*`.

Não foi adicionada API externa ou dependência. A base pública do [53](DICE_HISTORY.md) está entregue, com privacidade do mestre pendente; [54](COMBAT_RECOVERY.md) recupera ações sem confirmação e [55](COMBAT_EFFECTS.md) acrescenta condições e efeitos. A evidência acima registra a entrega original do 52; a validação atual está nos contratos seguintes.
