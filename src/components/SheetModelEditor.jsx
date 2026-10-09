import React,{Suspense,lazy,useEffect,useRef,useState} from 'react';
import {ArrowDown,ArrowUp,Plus,Trash2} from 'lucide-react';
import {DEFAULT_TABS,FIELD_TYPES,suggestTab} from './sheetHelpers.jsx';
import './SheetModelEditor.css';

const SheetModels=lazy(()=>import('./SheetModels.jsx'));
const DEFAULT_TAB='Geral';
const makeId=()=>`f_${crypto.randomUUID()}`;
const STARTER=[
  ['text','Personagem','Identidade'],['text','Origem','Identidade'],['text','Classe','Identidade'],
  ...['Força','Agilidade','Intelecto','Presença','Vigor'].map(name=>['number',name,'Atributos']),
  ['number','Defesa','Combate'],['number','Deslocamento','Combate'],
  ['number','Percepção','Perícias'],['number','Investigação','Perícias'],['number','Furtividade','Perícias'],
  ['textarea','Habilidades','Habilidades'],['list','Inventário','Equipamento'],
  ['status','Vida','Recursos'],['status','Sanidade','Recursos'],['status','Esforço','Recursos'],
];

// Categoria com rascunho próprio: dá para apagar tudo e digitar de novo sem criar categorias intermediárias ("A", "At"…); vale ao sair do campo ou com Enter.
function CategoryInput({field,onCommit}){
  const current=field.tab||DEFAULT_TAB;
  const [text,setText]=useState(current);
  useEffect(()=>setText(current),[current]);
  const commit=()=>{const next=text.trim();if(!next)setText(current);else if(next!==current)onCommit(field.id,next);};
  return <input aria-label={`Categoria de ${field.label||'campo sem nome'}`} value={text} list="model-tab-options" onChange={event=>setText(event.target.value)} onBlur={commit} onKeyDown={event=>{if(event.key==='Enter'){event.preventDefault();commit();}}}/>;
}

// Editor do modelo da ficha: os campos à esquerda e, ao lado, a ficha como o jogador a vê (a prévia é uma ficha de jogador de verdade,
// recebida pronta em `preview`). Cada mudança aparece na prévia na hora, e editar uma categoria abre a página dela no livro.
// Em largura estreita, as duas metades viram dois painéis alternados.
export default function SheetModelEditor({sheetFields,onFieldsChange,fontChoice,preview,previewNote,previewCount,onPreviewFields,onFocusCategory,onFillExample,onClearExample}){
  const [pane,setPane]=useState('editar');
  const root=useRef(null);
  // em painel único, trocar de painel leva ao começo do editor em vez de largar a página no meio do outro painel
  const choosePane=next=>{setPane(next);root.current?.scrollIntoView({block:'start'});};
  const [type,setType]=useState('text'),[label,setLabel]=useState(''),[formula,setFormula]=useState(''),[tab,setTab]=useState('');
  const tabNames=Array.from(new Set([...DEFAULT_TABS,...sheetFields.map(field=>field.tab).filter(Boolean)]));

  const addField=event=>{
    event.preventDefault();
    const name=label.trim();
    if(!name)return;
    const category=tab.trim()||suggestTab(name);
    const field={id:makeId(),type,label:name,tab:category};
    if(type==='formula')field.formula=formula.trim();
    onFieldsChange([...sheetFields,field]);
    onFocusCategory(category,true);
    setLabel('');setFormula('');setTab('');
  };
  const removeField=id=>onFieldsChange(sheetFields.filter(field=>field.id!==id));
  const renameField=(id,next)=>onFieldsChange(sheetFields.map(field=>field.id===id?{...field,label:next}:field));
  const setFieldTab=(id,next)=>onFieldsChange(sheetFields.map(field=>field.id===id?{...field,tab:next||DEFAULT_TAB}:field));
  const moveField=(index,dir)=>{
    const target=index+dir;
    if(target<0||target>=sheetFields.length)return;
    const next=[...sheetFields];
    [next[index],next[target]]=[next[target],next[index]];
    onFieldsChange(next);
    onFocusCategory(next[target].tab||DEFAULT_TAB,true);
  };
  const createStarter=()=>{
    if(sheetFields.length)return;
    onFieldsChange(STARTER.map(([kind,name,category])=>({id:makeId(),type:kind,label:name,tab:category})));
  };

  return <section ref={root} className="model-editor" data-pane={pane} aria-label="Editor do modelo da ficha">
    <header className="model-editor-bar">
      <div className="model-editor-title">
        <h3>Modelo da campanha</h3>
        <p>{sheetFields.length===1?'1 campo':`${sheetFields.length} campos`}. Cada jogador preenche os próprios valores.</p>
      </div>
      {fontChoice}
    </header>
    <div className="model-editor-switch" role="group" aria-label="Painel visível">
      <button type="button" className="sheet-tool-btn" aria-pressed={pane==='editar'} onClick={()=>choosePane('editar')}>Editar</button>
      <button type="button" className="sheet-tool-btn" aria-pressed={pane==='previa'} onClick={()=>choosePane('previa')}>Prévia</button>
    </div>
    <datalist id="model-tab-options">{tabNames.map(name=><option key={name} value={name}/>)}</datalist>
    <div className="model-editor-grid">
      <div className="model-editor-edit">
        {!sheetFields.length&&<button type="button" className="sheet-tool-btn starter-button" onClick={createStarter}><Plus size={16} aria-hidden="true"/>Começar com uma ficha base</button>}
        <Suspense fallback={<p role="status">Carregando os modelos…</p>}><SheetModels sheetFields={sheetFields} onFieldsChange={onFieldsChange} makeId={makeId} onPreview={onPreviewFields}/></Suspense>
        <section className="model-editor-section" aria-labelledby="model-add-title">
          <h4 id="model-add-title">Novo campo</h4>
          <div className="field-type-grid" role="group" aria-label="Tipo do campo">{FIELD_TYPES.map(item=>{const Icon=item.icon;return <button key={item.id} type="button" className={`field-type-btn ${type===item.id?'active':''}`} aria-pressed={type===item.id} onClick={()=>setType(item.id)}><Icon size={15} aria-hidden="true"/>{item.label}</button>;})}</div>
          <form className="field-add-row" onSubmit={addField}>
            <label>Nome do campo<input value={label} onChange={event=>setLabel(event.target.value)} placeholder="Ex.: Força…" required/></label>
            <label>Categoria<input value={tab} onChange={event=>setTab(event.target.value)} list="model-tab-options" placeholder={label?suggestTab(label):'Escolha ou crie uma categoria…'}/></label>
            {type==='formula'&&<label>Fórmula<input value={formula} onChange={event=>setFormula(event.target.value)} placeholder="Ex.: (Força-10)/2…" required/></label>}
            <button className="field-add-btn" type="submit"><Plus size={16} aria-hidden="true"/>Adicionar campo</button>
          </form>
        </section>
        <section className="model-editor-section" aria-labelledby="model-list-title">
          <h4 id="model-list-title">Campos do modelo ({sheetFields.length})</h4>
          {!sheetFields.length&&<p className="status-bars-hint">Nenhum campo ainda. Comece pela ficha base, use um sistema pronto ou crie um campo acima.</p>}
          <div className="field-list">{sheetFields.map((field,index)=><div className="field-list-row" key={field.id} onFocusCapture={()=>onFocusCategory(field.tab||DEFAULT_TAB)}>
            <input aria-label={`Nome (campo ${index+1}${field.label?`: ${field.label}`:''})`} value={field.label} onChange={event=>renameField(field.id,event.target.value)}/>
            <span className="field-list-type">{FIELD_TYPES.find(item=>item.id===field.type)?.label}</span>
            <CategoryInput field={field} onCommit={setFieldTab}/>
            <button type="button" aria-label={`Subir ${field.label}`} onClick={()=>moveField(index,-1)} disabled={index===0}><ArrowUp size={14} aria-hidden="true"/></button>
            <button type="button" aria-label={`Descer ${field.label}`} onClick={()=>moveField(index,1)} disabled={index===sheetFields.length-1}><ArrowDown size={14} aria-hidden="true"/></button>
            <button type="button" aria-label={`Remover ${field.label}`} onClick={()=>{if(window.confirm(`Remover o campo “${field.label}” do modelo?`))removeField(field.id);}}><Trash2 size={14} aria-hidden="true"/></button>
          </div>)}</div>
        </section>
      </div>
      <aside className="model-editor-preview" aria-labelledby="model-preview-title" aria-describedby="model-preview-hint">
        <div className="model-editor-preview-head">
          <div><h4 id="model-preview-title">Como o jogador vê</h4><p id="model-preview-hint">Digite na prévia para testar. Nada aqui é salvo.</p></div>
          <div className="model-editor-preview-actions">
            <button type="button" className="sheet-tool-btn" onClick={onFillExample} disabled={!previewCount}>Preencher com exemplo</button>
            <button type="button" className="sheet-tool-btn" onClick={onClearExample}>Limpar</button>
          </div>
        </div>
        {previewNote&&<p className="model-editor-preview-note" role="status">{previewNote}. Ainda não foi aplicado à mesa.</p>}
        {preview}
      </aside>
    </div>
  </section>;
}
