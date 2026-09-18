import React,{useEffect,useState} from 'react';
import {Castle,Upload} from 'lucide-react';
import {api} from '../api.js';
import {importDiceStructure} from './diceStructureImport.js';
export default function DiceStructurePicker({roomId,structures=[],value,onChange,disabled,roll,serverTime}){
  const [open,setOpen]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const [rolling,setRolling]=useState(false);
  useEffect(()=>{const remaining=roll?roll.startedAt+roll.duration-(serverTime||Date.now()):0;setRolling(remaining>0);const timer=setTimeout(()=>setRolling(false),Math.max(0,remaining));return()=>clearTimeout(timer);},[roll?.id]);
  disabled=disabled||rolling;
  async function upload(e){const file=e.target.files?.[0];e.target.value='';if(!file)return;setBusy(true);setError('');try{const mesh=await importDiceStructure(file);const result=await api(`/rooms/${roomId}/dice-structures`,{method:'POST',data:mesh,signal:AbortSignal.timeout(120000)});onChange(result.structureId);}catch(e){setError(e.message);}finally{setBusy(false);}}
  return <div className="structure-picker"><button type="button" aria-label="Escolher estrutura para rolar os dados" aria-expanded={open} onClick={()=>setOpen(!open)} disabled={disabled||busy}><Castle size={20}/><span>Estrutura de rolagem</span></button>
    {open&&<div className="structure-options"><p>Escolha onde seus dados vão rolar. Todos verão a mesma jogada.</p><label>Estrutura<select value={value} disabled={busy||disabled} onChange={e=>onChange(e.target.value)}><option value="tray">Bandeja hexagonal · arremessar</option><option value="tower">Torre com escada · soltar pelo topo</option>{structures.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
      <label className="structure-upload"><Upload size={18}/>{busy?'Preparando estrutura…':'Adicionar estrutura'}<input type="file" accept=".3mf,.stl,.obj,.glb" disabled={busy||disabled} onChange={upload}/></label><small>3MF, STL, OBJ ou GLB · até 30 MB e 60 mil triângulos. A abertura é estimada no topo; confira a posição da mão antes de soltar.</small>{value!=='tray'&&<small>Os dados caem um de cada vez. Se ficarem presos ou inclinados, tente novamente.</small>}{error&&<p role="alert">{error}</p>}</div>}
  </div>;
}
