import React, { useState, useEffect, useRef } from 'react';
import { DICE_SKINS } from './Dice3D.jsx';
import RolledDie from './RolledDie.jsx';
import { Dices, RotateCw, ArrowUp, ArrowDown, Hash, ListChecks, ShoppingBag, X, Check } from 'lucide-react';

const DICE_OPTIONS = [4, 6, 8, 10, 12, 20, 100];

const DiceRoller = ({onTrayRoll,sharedOnly=false,scenes=[]}) => {
  const [trayEnabled,setUseTray]=useState(false),[trayBusy,setTrayBusy]=useState(false),[trayError,setTrayError]=useState('');
  // Rolagem na mesa (aba Status do Grupo) começa pública; rolagem pela ficha começa privada.
  const [privateRoll,setPrivateRoll]=useState(!sharedOnly);
  const useTray=sharedOnly||trayEnabled;
  const [terms, setTerms] = useState([{ id: 'init', sign: 1, qty: 1, sides: 20 }]);
  const [nextSign, setNextSign] = useState(1);
  const [breakdown, setBreakdown] = useState(null);
  const [rolling, setRolling] = useState(false);
  const [history, setHistory] = useState([]);
  const [spinTrigger, setSpinTrigger] = useState(0);
  const [skinId, setSkinId] = useState(DICE_SKINS[0].id);
  const [pouchOpen, setPouchOpen] = useState(false);
  const pendingRoll = useRef(null);
  const [sceneChoice,setSceneChoice]=useState('');
  const availableScenes=scenes.filter(scene=>!scene.archived),sceneId=availableScenes.some(scene=>scene.id===sceneChoice)?sceneChoice:'';

  const addTerm = (sides) => {
    if (rolling) return;
    setBreakdown(null);
    setTerms(prev => {
      const existingIndex = prev.findIndex(t => t.sides === sides && t.sign === nextSign);
      if (existingIndex !== -1) {
        return prev.map((t, i) => i === existingIndex ? { ...t, qty: Math.min(20, t.qty + 1) } : t);
      }
      if (prev.length >= 6) return prev; // limite de termos na expressão
      return [...prev, { id: `${sides}-${nextSign}-${Date.now()}`, sign: nextSign, qty: 1, sides }];
    });
  };

  const updateTermQty = (id, delta) => {
    if (rolling) return;
    setBreakdown(null);
    setTerms(prev => prev.map(t => t.id === id ? { ...t, qty: Math.max(1, Math.min(20, t.qty + delta)) } : t));
  };

  const removeTerm = (id) => {
    if (rolling) return;
    setBreakdown(null);
    setTerms(prev => prev.filter(t => t.id !== id));
  };

  const formula = terms
    .map((t, i) => `${i === 0 ? (t.sign === 1 ? '' : '− ') : (t.sign === 1 ? '+ ' : '− ')}${t.qty}d${t.sides}`)
    .join(' ');

  const rollDice = async () => {
    if(useTray&&onTrayRoll){
      if(terms.reduce((n,t)=>n+t.qty*(t.sides===100?2:1),0)>20){setTrayError('A mão comporta até 20 dados físicos (d100 usa dois).');return;}
      if(trayBusy||terms.length===0)return;
      setTrayBusy(true);setTrayError('');
      try{const result=await onTrayRoll(terms,skinId,{sceneId:sceneId||null,private:privateRoll});if(result===false)setTrayError('Não foi possível rolar. Confira a mensagem da mesa e tente novamente.');}finally{setTrayBusy(false);}
      return;
    }
    if (rolling || terms.length === 0) return;
    const trigger = spinTrigger + 1;
    pendingRoll.current = {trigger, formula, terms: terms.map(t=>({...t})), values: new Map()};
    setRolling(true); setBreakdown(null); setSpinTrigger(trigger);
  };
  const receiveResult = (termIndex,dieIndex,value,trigger) => {
    const pending=pendingRoll.current;
    if(!pending || pending.trigger!==trigger)return;
    pending.values.set(`${termIndex}:${dieIndex}`,value);
    if(pending.values.size!==pending.terms.reduce((sum,t)=>sum+t.qty,0))return;
    const parts=pending.terms.map((t,i)=>({...t,rolls:Array.from({length:t.qty},(_,j)=>pending.values.get(`${i}:${j}`))}));
    const total=parts.reduce((sum,p)=>sum+p.sign*p.rolls.reduce((a,b)=>a+b,0),0);
    pendingRoll.current=null;setBreakdown({parts,total});setRolling(false);
    setHistory(prev=>[{id:crypto.randomUUID(),formula:pending.formula,total},...prev.slice(0,7)]);
  };

  return (
    <div className="dice-roller">
      <h3>
        <Dices size={18} />
        Dados
        <button
          className="pouch-btn"
          onClick={() => setPouchOpen(o => !o)}
          title="Escolher bolsa de dados"
        >
          <ShoppingBag size={17} />
        </button>
      </h3>

      {pouchOpen && (
        <div className="pouch-panel">
          {DICE_SKINS.map(skin => (
            <button
              key={skin.id}
              className={`pouch-skin-btn ${skinId === skin.id ? 'active' : ''}`}
              onClick={() => { setSkinId(skin.id); setPouchOpen(false); }}
              disabled={rolling}
            >
              <span className="skin-preview" style={{background:skin.color}} aria-hidden="true" />
              <span>{skin.label}</span>
              {skinId === skin.id && <Check size={14} className="pouch-check" />}
            </button>
          ))}
        </div>
      )}

      <div className="dice-formula-bar">
        {terms.length === 0 ? (
          <span className="dice-formula-empty">Adicione um dado abaixo</span>
        ) : (
          terms.map((t, i) => (
            <div key={t.id} className="dice-term-chip">
              {i > 0 && <span className="term-sign">{t.sign === 1 ? '+' : '−'}</span>}
              <button aria-label={`Diminuir quantidade de d${t.sides}`} onClick={() => updateTermQty(t.id, -1)} disabled={rolling}>-</button>
              <span className="term-label">{t.qty}d{t.sides}</span>
              <button aria-label={`Aumentar quantidade de d${t.sides}`} onClick={() => updateTermQty(t.id, 1)} disabled={rolling}>+</button>
              <button aria-label={`Remover d${t.sides}`} className="term-remove" onClick={() => removeTerm(t.id)} disabled={rolling}>
                <X size={12} />
              </button>
            </div>
          ))
        )}
      </div>

      <div className="dice-op-toggle">
        <span>Próximo dado:</span>
        <button className={nextSign === 1 ? 'active' : ''} onClick={() => setNextSign(1)} disabled={rolling}>+</button>
        <button className={nextSign === -1 ? 'active' : ''} onClick={() => setNextSign(-1)} disabled={rolling}>−</button>
      </div>

      <div className="dice-type-grid">
        {DICE_OPTIONS.map(d => (
          <button
            key={d}
            className="dice-type-btn"
            onClick={() => addTerm(d)}
            disabled={rolling || terms.length >= 6}
          >
            d{d}
          </button>
        ))}
      </div>

      {onTrayRoll&&!sharedOnly&&<label className="tray-option"><input type="checkbox" checked={useTray} disabled={rolling||trayBusy} onChange={e=>setUseTray(e.target.checked)}/>Jogar na bandeja da mesa<small>Sem marcar, a rolagem fica só na sua tela e ninguém mais a vê. Marque para enviá-la à mesa.</small></label>}
      {onTrayRoll&&useTray&&<label className="tray-option tray-private-option"><input type="checkbox" checked={privateRoll} disabled={rolling||trayBusy} onChange={e=>setPrivateRoll(e.target.checked)}/>Rolagem privada · só você e o ADM veem o resultado e o histórico. Desmarque para todos verem.</label>}
      {!useTray&&<div className="dice-display-area">
        {terms.length === 0 ? (
          <div className="dice-face-3d dice-face-3d-empty">
            <span className="dice-face-label">Adicione um dado</span>
          </div>
        ) : (
          <div className="dice-multi-row">
            {terms.flatMap((t,i) => Array.from({length:t.qty},(_,j) => <div key={`${t.id}-${j}`} className="dice-face-3d dice-face-3d-mini">
              <RolledDie sides={t.sides} skinId={skinId} spinTrigger={rolling ? spinTrigger : 0} onResult={(value,trigger)=>receiveResult(i,j,value,trigger)} />
              <span className="dice-face-label">{t.sign===-1?'− ':''}d{t.sides}{t.sides===100?' · dezenas / unidades':''}</span>
              {breakdown && <span className="dice-face-value dice-face-value-mini">{breakdown.parts[i].rolls[j]}</span>}
            </div>))}
          </div>
        )}
        {breakdown && (
          <>
            <div className="dice-breakdown">
              {breakdown.parts.map((p, i) => (
                <span key={i} className="dice-breakdown-part">
                  {i > 0 && <span className="breakdown-sign">{p.sign === 1 ? '+' : '−'}</span>}
                  {p.qty}d{p.sides}: [{p.rolls.join(', ')}]
                </span>
              ))}
            </div>
            <div className="dice-total-line" aria-live="polite">
              Total: <strong>{breakdown.total}</strong>
            </div>
          </>
        )}
      </div>}

      {trayError&&<p className="tray-send-error" role="alert">{trayError}</p>}
      {useTray&&availableScenes.length>0&&<label className="dice-scene-label">Cena da rolagem (opcional)<select name="rollScene" autoComplete="off" value={sceneId} disabled={trayBusy} onChange={event=>setSceneChoice(event.target.value)}><option value="">Sem cena</option>{availableScenes.map(scene=><option key={scene.id} value={scene.id}>{scene.title}</option>)}</select></label>}
      <button className="roll-btn" onClick={rollDice} disabled={rolling || trayBusy || terms.length === 0}>
        <RotateCw size={18} className={rolling ? 'spin' : ''} />
        {trayBusy?'Enviando…':rolling ? 'Rolando...' : useTray?'Pegar dados na mão':'Rolar'}
      </button>

      {history.length > 0 && (
        <div className="dice-history">
          <h4>Histórico</h4>
          {history.map(h => (
            <div key={h.id} className="dice-history-item">
              <span>{h.formula}</span>
              <strong>{h.total}</strong>
            </div>
          ))}

        </div>
      )}
    </div>
  );
};

export default DiceRoller;


// Fontes temáticas de RPG disponíveis para o Mestre escolher na ficha
