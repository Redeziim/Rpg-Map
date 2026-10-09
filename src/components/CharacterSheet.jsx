import React, { useState, useEffect, useRef, useCallback, lazy, Suspense } from 'react';
import { Camera, Map, Users, Eye, Edit3, Plus, X, Upload, Grid, ChevronRight, Castle, Sword, Scroll, Skull, ScrollText, BookOpen, Dices, RotateCw, Image as ImageIcon, Type, GripVertical, Trash2, ListPlus, Settings2, ShoppingBag, Check, Hash, ArrowUp, ArrowDown, Palette, Minus, Heart, Calculator, ListChecks } from 'lucide-react';
import { DICE_SKINS } from './Dice3D.jsx';
import RolledDie from './RolledDie.jsx';
import { SHEET_FONTS, loadSheetFont, resolveFormulas } from './sheetHelpers.jsx';
import { exampleValues } from '../shared/sheetExample.js';
import { pairModifiers, formatModifier, isCompactCategory } from '../shared/sheetFormulas.js';
import { categoryWeight } from '../shared/bookPages.js';
import SheetBook from './SheetBook.jsx';
import './SheetGothic.css';
const SheetModelEditor = lazy(() => import('./SheetModelEditor.jsx'));
// Neste arquivo "Map" é o ícone do lucide-react; por isso o par vazio vem da própria função em vez de `new Map()`.
const NO_PAIRS = pairModifiers([]);

const CharacterSheet = ({ viewMode, sheetFields, onFieldsChange, sheetFont, onFontChange, playerName, onPlayerNameChange, playerSheets, onUpdatePlayerSheet, selectedPlayer, onSelectPlayer, playerNames: knownPlayers, profile, canEditSelected=false, notebookKey, onSaveNote, onShareNote, notebookMembers=[], notebookUsername='', mapPoints=[], onOpenPoint,openNoteRequest,roomId,preview=false,focusCategory=null }) => {
  // Só o mestre tem duas áreas: as fichas dos jogadores e o editor do modelo, que mostra a ficha do jogador ao lado enquanto se edita.
  const [workspace, setWorkspace] = useState('fichas');
  // o editor, depois de aberto uma vez, fica montado (só escondido) para não perder o modelo lido de um arquivo ao olhar uma ficha
  const [editorOpened, setEditorOpened] = useState(false);
  const openWorkspace = next => { if (next === 'modelo') setEditorOpened(true); setWorkspace(next); };
  const [editorFocus, setEditorFocus] = useState(null);
  // modelo lido de um arquivo (ou o resultado de somar/substituir) que a prévia mostra antes de ser aplicado à mesa
  const [draftPreview, setDraftPreview] = useState(null);
  const draftLabel = useRef(null);
  // ao aparecer um modelo novo na prévia, abre a primeira página dele (e não a capa vazia); mexer nas linhas dele não repete o salto
  const onPreviewFields = useCallback(value => {
    setDraftPreview(value);
    const label = value?.label ?? null;
    if (label !== draftLabel.current) setPreviewEntry(prev => ({ ...prev, values: {} }));
    if (label && label !== draftLabel.current && value.fields.length) setEditorFocus({ name: value.fields[0].tab || 'Geral', token: crypto.randomUUID() });
    draftLabel.current = label;
  }, []);
  const [previewEntry, setPreviewEntry] = useState({ extraFields: [], values: {} });
  const masterSelectedPlayer = selectedPlayer;
  const setMasterSelectedPlayer = onSelectPlayer;
  const [attackRolls, setAttackRolls] = useState({});

  const isMaster = viewMode === 'master';
  const readOnly = isMaster && !canEditSelected;
  const fontFamily = (SHEET_FONTS.find(f => f.id === sheetFont) || SHEET_FONTS[0]).family;
  // as fontes decorativas só são pedidas quando alguém as escolhe
  useEffect(() => { loadSheetFont(sheetFont); }, [sheetFont]);
  const playerNames = knownPlayers;
  const activePlayer = isMaster ? masterSelectedPlayer : playerName;
  const activeEntry = (playerSheets && playerSheets[activePlayer]) || { extraFields: [], values: {} };
  const extraFields = activeEntry.extraFields || [];

  const draftValues = activeEntry.values || {};
  const draftRef = { current: draftValues };
  const [saveStatus, setSaveStatus] = useState('idle');

  // --- Valores preenchidos (base + extras, mesmo objeto de valores) ---
  const setValue = async (id, value) => {
    if (readOnly || !activePlayer) return;
    setSaveStatus('saving');
    const saved=await onUpdatePlayerSheet(activePlayer, { values: { [id]: value } });
    setSaveStatus(saved===false?'error':'saved');
  };

  const handleImageField = (id, e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setValue(id, ev.target.result);
    reader.readAsDataURL(file);
  };

  const addListItem = (id) => setValue(id, [...(draftRef.current[id] || []), '']);
  const updateListItem = (id, idx, text) => {
    const current = [...(draftRef.current[id] || [])];
    current[idx] = text;
    setValue(id, current);
  };
  const removeListItem = (id, idx) => {
    setValue(id, (draftRef.current[id] || []).filter((_, i) => i !== idx));
  };

  // --- Lista marcável (checklist) ---
  const addChecklistItem = (id) => {
    const current = draftRef.current[id] || [];
    setValue(id, [...current, { id: `c_${Date.now()}`, text: '', checked: false }]);
  };
  const updateChecklistText = (id, itemId, text) => {
    const current = (draftRef.current[id] || []).map(it => it.id === itemId ? { ...it, text } : it);
    setValue(id, current);
  };
  const toggleChecklistItem = (id, itemId) => {
    const current = (draftRef.current[id] || []).map(it => it.id === itemId ? { ...it, checked: !it.checked } : it);
    setValue(id, current);
  };
  const removeChecklistItem = (id, itemId) => {
    setValue(id, (draftRef.current[id] || []).filter(it => it.id !== itemId));
  };

  // --- Ataque/Habilidade (bônus + dano com rolagem de dado 3D de verdade) ---
  const setAttackField = (id, key, val) => {
    const current = draftRef.current[id] || { bonus: 0, damage: '' };
    setValue(id, { ...current, [key]: val });
  };

  const rollAttack = (id) => {
    if(readOnly) return;
    const bonus=Number(draftValues[id]?.bonus)||0;
    setAttackRolls(prev=>({...prev,[id]:{...prev[id],atkRolling:true,atkSpin:(prev[id]?.atkSpin||0)+1,atk:null,bonus}}));
  };
  const rollDamage = (id) => {
    if(readOnly)return;
    const match=(draftValues[id]?.damage || '').replace(/\s/g,'').match(/^(\d+)d(4|6|8|10|12|20|100)([+-]\d+)?$/i);
    if(!match||Number(match[1])<1)return;
    const qty=Math.min(Number(match[1]),10),sides=Number(match[2]),mod=Number(match[3]||0);
    setAttackRolls(prev=>({...prev,[id]:{...prev[id],dmgRolling:true,dmgSpin:(prev[id]?.dmgSpin||0)+1,dmgDice:{qty,sides,mod},dmg:null,dmgValues:{}}}));
  };
  const receiveAttack=(id,value,trigger)=>setAttackRolls(prev=>{
    const roll=prev[id];if(!roll?.atkRolling||roll.atkSpin!==trigger)return prev;
    return {...prev,[id]:{...roll,atkRolling:false,atk:{d20:value,bonus:roll.bonus,total:value+roll.bonus}}};
  });
  const receiveDamage=(id,index,value,trigger)=>setAttackRolls(prev=>{
    const roll=prev[id];if(!roll?.dmgRolling||roll.dmgSpin!==trigger)return prev;
    const values={...roll.dmgValues,[index]:value};const done=Object.keys(values).length===roll.dmgDice.qty;
    const rolls=Array.from({length:roll.dmgDice.qty},(_,i)=>values[i]);
    return {...prev,[id]:{...roll,dmgValues:values,dmgRolling:!done,dmg:done?{rolls,mod:roll.dmgDice.mod,total:rolls.reduce((a,b)=>a+b,0)+roll.dmgDice.mod}:null}};
  });

  // Todos os campos (base + extras) — usado para resolver fórmulas por nome
  const allFieldsForFormulas = [...sheetFields, ...extraFields];
  const formulaResults = resolveFormulas(allFieldsForFormulas, draftValues);

  // Nomes de abas já usados em qualquer campo (base ou extra) — sugestões para o datalist

  // modField: fórmula do modificador pareada com este atributo (ver pairModifiers); aparece dentro do mesmo cartão.
  const renderField = (f, modField = null) => (
    <fieldset disabled={readOnly} key={f.id} className={`sheet-field sheet-field-${f.type}`}>
      <div className="sheet-field-label-row">
        <label htmlFor={`field-${f.id}`} style={{ fontFamily }}>{f.label}</label>

      </div>

      {f.type === 'status' && (() => {
        const stored = draftValues[f.id], value = stored && typeof stored === 'object' && !Array.isArray(stored) ? { current: Number(stored.current) || 0, max: Number(stored.max) || 0 } : { current: 0, max: 0 };
        return <div className="resource-field"><div className="status-bar-track"><div className="status-bar-fill" style={{width: `${value.max > 0 ? Math.min(100,Math.max(0,value.current/value.max*100)) : 0}%`}} /></div><div className="resource-inputs"><label>Atual<input type="number" aria-label={`${f.label}: valor atual`} min="0" value={value.current} onChange={e => setValue(f.id,{...value,current:Math.max(0,Math.min(value.max,Number(e.target.value)))})} /></label><span>/</span><label>Máximo<input type="number" aria-label={`${f.label}: valor máximo`} min="0" value={value.max} onChange={e => {const max=Math.max(0,Number(e.target.value));setValue(f.id,{max,current:Math.min(value.current,max)});}} /></label></div></div>;
      })()}
      {f.type === 'text' && (
        <input id={`field-${f.id}`} type="text" value={draftValues[f.id] || ''} onChange={e => setValue(f.id, e.target.value)} placeholder="Preencha aqui…" />
      )}
      {f.type === 'number' && (
        <input id={`field-${f.id}`} type="number" value={draftValues[f.id] ?? ''} onChange={e => setValue(f.id, e.target.value)} placeholder="0" />
      )}
      {f.type === 'number' && modField && (() => {
        const raw = draftValues[f.id], hasScore = raw !== undefined && raw !== null && raw !== '';
        const result = formulaResults.get(modField.id), text = formatModifier(result, hasScore);
        return <div className="attribute-mod" title={modField.label}><span className="attribute-mod-name" aria-hidden="true">mod.</span><strong className={`attribute-mod-value${hasScore && typeof result === 'number' && result < 0 ? ' is-negative' : ''}`}><span className="sr-only">{`${modField.label}: ${text === '—' ? 'sem valor' : ''}`}</span><span aria-hidden={text === '—' ? 'true' : undefined}>{text}</span></strong></div>;
      })()}
      {f.type === 'textarea' && (
        <textarea id={`field-${f.id}`} value={draftValues[f.id] || ''} onChange={e => setValue(f.id, e.target.value)} placeholder="Preencha aqui…" rows={4} />
      )}
      {f.type === 'image' && (
        <div className="sheet-field-image">
          {draftValues[f.id] ? <img src={draftValues[f.id]} alt={f.label} /> : (
            <div className="sheet-field-image-placeholder"><ImageIcon size={28} /></div>
          )}
          <label className="upload-btn sheet-image-upload-btn">
            <input type="file" accept="image/*" onChange={e => handleImageField(f.id, e)} />
            {draftValues[f.id] ? 'Trocar imagem' : 'Enviar imagem'}
          </label>
        </div>
      )}
      {f.type === 'list' && (
        <div className="sheet-field-list">
          {(Array.isArray(draftValues[f.id]) ? draftValues[f.id] : []).map((item, idx) => (
            <div key={idx} className="sheet-list-item">
              <input type="text" aria-label={`${f.label}, item ${idx + 1}`} value={item} onChange={e => updateListItem(f.id, idx, e.target.value)} placeholder={`Item ${idx + 1}`} />
              <button type="button" aria-label={`Remover item ${idx + 1} de ${f.label}`} onClick={() => removeListItem(f.id, idx)}><X size={14} aria-hidden="true" /></button>
            </div>
          ))}
          <button className="sheet-list-add-btn" onClick={() => addListItem(f.id)}>
            <Plus size={14} /> Adicionar item
          </button>
        </div>
      )}

      {f.type === 'formula' && (() => {
        const result = (formulaResults.get(f.id) ?? null);
        return (
          <div className="sheet-field-formula">
            <span className="formula-result">{result === null ? '—' : result}</span>
            <span className="formula-expr">{f.formula}</span>
          </div>
        );
      })()}

      {f.type === 'attack' && (() => {
        const val = draftValues[f.id] || { bonus: 0, damage: '' };
        const rolls = attackRolls[f.id] || {};
        const showAtkDice = rolls.atkRolling || rolls.atk;
        const showDmgDice = (rolls.dmgRolling || rolls.dmg) && rolls.dmgDice;
        return (
          <div className="sheet-field-attack">
            <div className="attack-inputs-row">
              <label className="attack-mini-label">Bônus
                <input type="number" value={val.bonus ?? 0} onChange={e => setAttackField(f.id, 'bonus', e.target.value)} />
              </label>
              <label className="attack-mini-label">Dano
                <input type="text" placeholder="1d8+2" title="Use d4, d6, d8, d10, d12, d20 ou d100. Ex.: 2d6+3." value={val.damage || ''} onChange={e => setAttackField(f.id, 'damage', e.target.value)} />
              </label>
            </div>
            <div className="attack-roll-row">
              <button className="attack-roll-btn" onClick={() => rollAttack(f.id)} disabled={rolls.atkRolling}>
                <Dices size={14} /> Rolar Ataque
              </button>
              <button className="attack-roll-btn" onClick={() => rollDamage(f.id)} disabled={!/^[1-9]\d*d(4|6|8|10|12|20|100)([+-]\d+)?$/i.test((val.damage || '').replace(/\s/g,'')) || rolls.dmgRolling}>
                <Dices size={14} /> Rolar Dano
              </button>
            </div>

            {showAtkDice && (
              <div className="attack-dice-row">
                <div className="dice-face-3d dice-face-3d-mini">
                  <RolledDie sides={20} skinId={DICE_SKINS[0].id} spinTrigger={rolls.atkRolling ? rolls.atkSpin : 0} onResult={(value,trigger)=>receiveAttack(f.id,value,trigger)} />
                  <span className="dice-face-label">d20</span>
                  {rolls.atk && <span className={`dice-face-value dice-face-value-mini ${rolls.atkRolling ? 'flicker' : ''}`}>{rolls.atk.d20}</span>}
                </div>
              </div>
            )}
            {showDmgDice && (
              <div className="attack-dice-row">
                {Array.from({ length: rolls.dmgDice.qty }).map((_, i) => (
                  <div key={i} className="dice-face-3d dice-face-3d-mini">
                    <RolledDie sides={rolls.dmgDice.sides} skinId={DICE_SKINS[0].id} spinTrigger={rolls.dmgRolling ? rolls.dmgSpin : 0} onResult={(value,trigger)=>receiveDamage(f.id,i,value,trigger)} />
                    <span className="dice-face-label">d{rolls.dmgDice.sides}</span>
                    {rolls.dmg && <span className={`dice-face-value dice-face-value-mini ${rolls.dmgRolling ? 'flicker' : ''}`}>{rolls.dmg.rolls[i]}</span>}
                  </div>
                ))}
              </div>
            )}

            {(rolls.atk || rolls.dmg) && (
              <div className="attack-result-row">
                {rolls.atk && <span>Ataque: d20({rolls.atk.d20}) + {rolls.atk.bonus} = <strong>{rolls.atk.total}</strong></span>}
                {rolls.dmg && <span>Dano: [{rolls.dmg.rolls.join(', ')}]{rolls.dmg.mod ? ` ${rolls.dmg.mod > 0 ? '+' : ''}${rolls.dmg.mod}` : ''} = <strong>{rolls.dmg.total}</strong></span>}
              </div>
            )}
          </div>
        );
      })()}

      {f.type === 'checklist' && (
        <div className="sheet-field-checklist">
          {(Array.isArray(draftValues[f.id]) ? draftValues[f.id] : []).filter(item => item && typeof item === 'object').map(item => (
            <div key={item.id} className="checklist-item-row">
              <input type="checkbox" aria-label={`Concluir ${item.text || 'item'} em ${f.label}`} checked={!!item.checked} onChange={() => toggleChecklistItem(f.id, item.id)} />
              <input
                type="text"
                aria-label={`Item de ${f.label}`}
                value={item.text}
                onChange={e => updateChecklistText(f.id, item.id, e.target.value)}
                placeholder="Descreva o item..."
                className={item.checked ? 'checklist-text-done' : ''}
              />
              <button type="button" aria-label={`Remover ${item.text || 'item'} de ${f.label}`} onClick={() => removeChecklistItem(f.id, item.id)}><X size={14} aria-hidden="true" /></button>
            </div>
          ))}
          <button className="sheet-list-add-btn" onClick={() => addChecklistItem(f.id)}>
            <Plus size={14} /> Adicionar item
          </button>
        </div>
      )}
    </fieldset>
  );

  const categories = Array.from(new Set([...sheetFields, ...extraFields].map(f => f.tab || 'Geral')));
  const VIEW_KEY='grimorio-ficha-vista';
  const [sheetView,setSheetView]=useState(()=>{if(preview)return 'livro';try{return window.localStorage.getItem(VIEW_KEY)==='lista'?'lista':'livro';}catch{return 'livro';}});
  const chooseView=view=>{setSheetView(view);if(preview)return;try{window.localStorage.setItem(VIEW_KEY,view);}catch{/* o navegador pode recusar; a escolha vale só nesta sessão */}};
  const allFields=[...sheetFields,...extraFields];
  const categoryItems=categories.map((category,i)=>{
    const categoryFields=allFields.filter(f=>(f.tab||'Geral')===category),pairs=category==='Atributos'?pairModifiers(categoryFields):NO_PAIRS;
    const kind=category==='Atributos'?'attributes':category==='Identidade'?'identity':isCompactCategory(categoryFields)?'compact':'default';
    return {category,weight:categoryWeight(categoryFields,{kind,cards:categoryFields.length-pairs.hidden.size}),node:<section className={`sheet-category ${category==='Atributos' ? 'attribute-category' : ''} ${category==='Identidade' ? 'identity-category' : ''} ${category!=='Atributos' && isCompactCategory(categoryFields) ? 'compact-category' : ''}`}>
      <div className="section-heading"><h3 style={{ fontFamily }}><span className="section-number">{String(i+1).padStart(2,'0')}</span>{category}</h3><span>✦</span></div>
      <div className="sheet-fields-grid">{categoryFields.filter(f => !pairs.hidden.has(f.id)).map(f => renderField(f, pairs.mods.get(f.id)))}</div>
    </section>};
  });
  const profileAside=<aside className="dossier-profile" aria-label="Perfil do personagem">{profile}<div className="profile-footnote"><span>✦</span><p>Cada marca, uma escolha.<br />Cada escolha, um caminho.</p></div></aside>;
  const titleBlock=activePlayer?<div className="dossier-title"><div><span className="eyebrow">Registro de personagem</span><h3>{draftValues[sheetFields.find(f => f.label.toLowerCase()==='personagem')?.id] || activePlayer}</h3></div><span className="save-status" aria-live="polite">{preview ? 'Prévia' : isMaster ? 'Consulta' : saveStatus==='saving' ? 'Salvando…' : saveStatus==='saved' ? 'Salvo' : saveStatus==='error' ? 'Falha ao salvar' : 'Sua ficha'}</span></div>:null;
  const notesHelp=preview?<p className="sheet-notes-help">Os valores desta prévia não são salvos.</p>:<p className="sheet-notes-help">{activePlayer===notebookUsername?'Crie e abra suas anotações em Minhas notas, na faixa acima.':'As notas pessoais são privadas. Notas compartilhadas com você aparecem na faixa acima.'}</p>;
  const asBook=Boolean(activePlayer)&&categories.length>0&&sheetView==='livro';

  const fontChoice = <label className="font-choice">Tipografia<select value={sheetFont} onChange={e => onFontChange(e.target.value)}>{SHEET_FONTS.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}</select></label>;
  const showEditor = isMaster && !preview && workspace === 'modelo';
  const shownFields = editorOpened && draftPreview ? draftPreview.fields : sheetFields;
  const workspaceKeys = e => { if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); const next = workspace === 'fichas' ? 'modelo' : 'fichas'; openWorkspace(next); document.getElementById(`sheet-workspace-${next}`)?.focus(); } };
  const previewProfile = <div className="preview-profile"><div className="status-avatar-placeholder"><ImageIcon size={20} aria-hidden="true" /></div><p>O retrato e as barras de vida do jogador aparecem aqui.</p></div>;
  const previewSheet = editorOpened && !preview ? <CharacterSheet preview viewMode="player" sheetFields={shownFields} sheetFont={sheetFont} playerName="Nome do jogador" playerNames={[]} playerSheets={{ "Nome do jogador": previewEntry }}
    onUpdatePlayerSheet={async (_name, patch) => { setPreviewEntry(prev => ({ ...prev, values: { ...prev.values, ...patch.values } })); return true; }}
    profile={previewProfile} focusCategory={editorFocus} onFieldsChange={() => {}} /> : null;

  return (
    <div className={`character-sheet${preview ? ' is-preview' : ''}`}>
      {!preview && <div className="sheet-heading">
        <div><span className="eyebrow">{isMaster ? 'O arquivo da mesa' : 'Seu lugar nesta história'}</span><h2>{isMaster ? 'Fichas da campanha' : 'Ficha de personagem'}</h2></div>
        <span className="sheet-seal"><ScrollText size={18} /> {isMaster ? 'Mestre' : 'Jogador'}</span>
      </div>}
      {isMaster && !preview && <div className="sheet-workspace-tabs" role="tablist" aria-label="Área da ficha" onKeyDown={workspaceKeys}>
        <button type="button" role="tab" id="sheet-workspace-fichas" aria-selected={workspace === 'fichas'} aria-controls="sheet-workspace-panel" tabIndex={workspace === 'fichas' ? 0 : -1} onClick={() => openWorkspace('fichas')}><Eye size={16} aria-hidden="true" />Fichas dos jogadores</button>
        <button type="button" role="tab" id="sheet-workspace-modelo" aria-selected={workspace === 'modelo'} aria-controls="sheet-workspace-panel" tabIndex={workspace === 'modelo' ? 0 : -1} onClick={() => openWorkspace('modelo')}><Settings2 size={16} aria-hidden="true" />Editor do modelo<span className="sheet-workspace-count">{sheetFields.length}</span></button>
      </div>}
      <div role={isMaster && !preview ? 'tabpanel' : undefined} id={isMaster && !preview ? 'sheet-workspace-panel' : undefined} aria-labelledby={isMaster && !preview ? `sheet-workspace-${workspace}` : undefined}>
      {editorOpened && !preview && <div hidden={!showEditor}><Suspense fallback={<p role="status">Abrindo o editor do modelo…</p>}>
        <SheetModelEditor sheetFields={sheetFields} onFieldsChange={onFieldsChange} fontChoice={fontChoice} preview={previewSheet} previewNote={draftPreview?.label} onPreviewFields={onPreviewFields}
          onFocusCategory={(name, force = false) => setEditorFocus(prev => (!force && prev?.name === name ? prev : { name, token: crypto.randomUUID() }))}
          previewCount={shownFields.length}
          onFillExample={() => setPreviewEntry(prev => ({ ...prev, values: exampleValues(shownFields) }))}
          onClearExample={() => setPreviewEntry(prev => ({ ...prev, values: {} }))} />
      </Suspense></div>}
      {!showEditor && <>
      {isMaster && <div className="sheet-master-toolbar">{fontChoice}</div>}
      {isMaster && <label className="player-select">Consultar personagem<select value={selectedPlayer} onChange={e => onSelectPlayer(e.target.value)}><option value="">Selecione um jogador…</option>{playerNames.map(n => <option key={n}>{n}</option>)}</select><span><Eye size={14} /> {readOnly?'Somente leitura':'Acesso de ADM'}</span></label>}
      {asBook?<SheetBook focusCategory={focusCategory} quiet={preview} label={preview?'Páginas da ficha de teste':isMaster?'Ficha consultada':'Sua ficha'} cover={<div className="book-cover">{profileAside}{titleBlock}{notesHelp}</div>} items={categoryItems} onShowList={()=>chooseView('lista')} />:<>
      {Boolean(activePlayer)&&categories.length>0&&<div className="sheet-view-switch"><button type="button" className="sheet-tool-btn" onClick={()=>chooseView('livro')}><BookOpen size={16} aria-hidden="true" />Abrir como livro</button></div>}
      <div className="dossier-layout">
        {profileAside}
        <div className="dossier-content">
          {!activePlayer ? <div className="empty-state sheet-empty"><ScrollText size={42} /><h3>{isMaster ? 'Um olhar sobre a mesa' : 'Sua ficha começa aqui'}</h3><p>{isMaster ? 'Selecione um jogador para consultar seus atributos, recursos e observações.' : 'Informe seu nome ao lado para acessar a ficha da campanha.'}</p></div> : <>
            {titleBlock}
            {!categories.length && <div className="empty-state sheet-empty"><ScrollText size={36} /><h3>O modelo ainda está em branco</h3><p>{preview ? 'Adicione campos ao lado e a ficha aparece aqui.' : isMaster ? 'Crie os campos no editor do modelo.' : 'O mestre irá definir os campos da campanha. Você já pode registrar observações abaixo.'}</p>{isMaster && !preview && <button type="button" className="sheet-tool-btn" onClick={() => openWorkspace('modelo')}><Settings2 size={16} aria-hidden="true" />Abrir o editor do modelo</button>}</div>}
            <div className="category-layout">{categoryItems.map(item => <React.Fragment key={item.category}>{item.node}</React.Fragment>)}</div>
            {notesHelp}
          </>}
        </div>
      </div></>}
      </>}
      </div>
    </div>
  );
};
export default CharacterSheet;
