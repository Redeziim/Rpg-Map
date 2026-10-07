export function createWebGLRecovery({onChange,onRebuild}){
  let generation=0,automaticUsed=false,closed=false,phase='starting';
  const emit=next=>{phase=next;onChange({phase,automaticUsed});};
  const rebuild=()=>{generation++;emit('recovering');onRebuild();};
  const failed=token=>{if(closed||token!==generation)return;if(!automaticUsed){automaticUsed=true;rebuild();}else{generation++;emit('unavailable');}};
  return {
    begin(){if(closed)return null;generation++;emit(automaticUsed?'recovering':'starting');return generation;},
    ready(token){if(!closed&&token===generation)emit('ready');},
    failed,lost:failed,
    retry(){if(!closed&&phase==='unavailable')rebuild();},
    dispose(){closed=true;generation++;}
  };
}
