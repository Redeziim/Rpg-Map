export function trapDialogFocus(event){
  if(event.key!=='Tab')return;
  const focusable=[...event.currentTarget.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]),textarea:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])')]
    .filter(element=>element.getClientRects().length>0);
  if(!focusable.length){event.preventDefault();return;}
  const first=focusable[0],last=focusable.at(-1);
  if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
  else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
}
