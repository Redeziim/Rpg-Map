// O que o botão "Turnos" precisa mostrar mesmo com o painel fechado, para um comando sem confirmação ou um aviso nunca ficar escondido.
// recovery vem de useCombatRecovery ({pending, phase, notice}); error é o texto de erro do bloco de turnos.
// Devolve {kind, key}:
//   'checking' conferindo o comando (transitório: só o botão avisa)
//   'pending'  comando sem confirmação (marca o botão enquanto estiver pendente e abre o painel)
//   'notice'   resultado da conferência ou erro de ação (abre o painel; marca o botão até a pessoa ver)
//   ''         nada a mostrar
// key identifica o aviso, para o botão saber se a pessoa já viu aquele texto.
export function turnAttention(recovery,error=''){
  if(recovery?.pending)return {kind:['sending','checking'].includes(recovery.phase)?'checking':'pending',key:recovery.pending.operationId||recovery.phase||''};
  const message=recovery?.notice||error;
  return message?{kind:'notice',key:message}:{kind:'',key:''};
}
// Só estes estados abrem o painel sozinhos; "checking" dura um instante e não vale interromper a pessoa.
export const opensTurnPanel=kind=>kind==='pending'||kind==='notice';
// O botão fica marcado enquanto houver algo para ver: comando em curso ou pendente, ou um aviso que ainda não foi aberto.
export const turnNeedsAttention=({kind,key},seenKey)=>kind==='checking'||kind==='pending'||(kind==='notice'&&key!==seenKey);
