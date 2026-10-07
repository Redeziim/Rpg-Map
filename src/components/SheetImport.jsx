import {useEffect,useRef,useState} from 'react';
import {FileUp,X} from 'lucide-react';
import {confidenceLabel,fillGaps,interpretSheetText,mergeInterpretations} from '../shared/sheetImport.js';
import {interpretSheetWords} from '../shared/sheetLayout.js';
import './SheetImport.css';

const same=(a,b)=>JSON.stringify(a??'')===JSON.stringify(b??'');
const describe=value=>value&&typeof value==='object'?`${value.current} / ${value.max}`:String(value??'');

// Reads a PDF or an image of a sheet on this device and proposes values for the table's fields.
// Nothing is saved until the person confirms the rows they want.
export default function SheetImport({fields,currentValues={},onApply,disabled}){
  const [phase,setPhase]=useState('idle'),[message,setMessage]=useState(''),[error,setError]=useState(''),[result,setResult]=useState(null),[rows,setRows]=useState([]),[notice,setNotice]=useState('');
  const abort=useRef(null),input=useRef(null),heading=useRef(null);
  useEffect(()=>()=>abort.current?.abort(),[]);
  useEffect(()=>{if(phase==='review')heading.current?.focus();},[phase]);
  async function choose(event){
    const file=event.target.files?.[0];event.target.value='';
    if(!file)return;
    const controller=new AbortController();abort.current=controller;
    setPhase('reading');setError('');setNotice('');setMessage('Abrindo o arquivo…');
    try{
      // The reader (PDF.js and the OCR engine) is large; it only loads when someone actually imports a file.
      const {readSheetFile}=await import('./sheetReader.js');
      const read=await readSheetFile(file,{onProgress:setMessage,signal:controller.signal});
      // Text in reading order is exact for PDFs. For pictures, reading by position comes first and the running text only fills gaps.
      const byText=interpretSheetText({text:read.text,formFields:read.formFields,fields});
      let interpreted=byText;
      if(read.wordSets?.length){
        let byPosition=null;
        for(const words of read.wordSets){const next=interpretSheetWords({words,fields});byPosition=byPosition?mergeInterpretations(byPosition,next,fields):next;}
        interpreted=fillGaps(byPosition,byText,fields,'media');
      }
      setResult({...interpreted,read,fileName:file.name});
      setRows(interpreted.matches.map(match=>({...match,use:match.confidence!=='baixa',draft:match.value})));
      setPhase('review');
    }catch(cause){
      if(cause?.name==='AbortError'){setPhase('idle');return;}
      setError(cause.message||'Não consegui ler o arquivo.');setPhase('idle');
    }finally{if(abort.current===controller)abort.current=null;}
  }
  const edit=(fieldId,patch)=>setRows(previous=>previous.map(row=>row.fieldId===fieldId?{...row,...patch}:row));
  const chosen=rows.filter(row=>row.use);
  async function apply(){
    const values={};
    for(const row of chosen){
      if(row.type==='status'){const current=Math.max(0,Number(row.draft.current)||0),max=Math.max(current,Math.max(0,Number(row.draft.max)||0));values[row.fieldId]={current,max};}
      else values[row.fieldId]=String(row.draft).trim();
    }
    setPhase('applying');
    const saved=await onApply(values);
    if(saved===false){setError('Não consegui salvar a ficha. Confira a conexão; o que você escolheu continua aqui.');setPhase('review');return;}
    setNotice(`Ficha preenchida com ${chosen.length} ${chosen.length===1?'campo':'campos'}. Confira e ajuste o que faltar.`);setPhase('idle');setResult(null);setRows([]);
  }
  function close(){setPhase('idle');setResult(null);setRows([]);setError('');input.current?.focus();}
  const importable=result?result.matches.length+result.missing.length:0;
  return <section className="sheet-import" aria-label="Importar ficha de um arquivo">
    {phase==='idle'&&<>
      <div className="sheet-import-start">
        <div><h4><FileUp size={16} aria-hidden="true"/>Importar de um PDF ou imagem</h4><p>Escolha o PDF da ficha ou um print. A leitura acontece neste navegador: o arquivo não é enviado ao servidor nem a nenhum serviço de IA. Você revisa tudo antes de salvar.</p></div>
        <label className="sheet-import-button"><input ref={input} type="file" accept="application/pdf,image/png,image/jpeg,image/webp,.pdf" disabled={disabled} onChange={choose}/>Escolher arquivo</label>
      </div>
      {notice&&<p role="status" className="sheet-import-notice">{notice}</p>}
      {error&&<p role="alert" className="sheet-import-error">{error}</p>}
    </>}
    {phase==='reading'&&<div className="sheet-import-progress" role="status"><p>{message}</p><button type="button" onClick={()=>abort.current?.abort()}><X size={15} aria-hidden="true"/>Cancelar leitura</button></div>}
    {(phase==='review'||phase==='applying')&&result&&<div className="sheet-import-review">
      <h4 ref={heading} tabIndex={-1}>Revise o que foi lido</h4>
      <p>De <strong>{result.fileName}</strong> ({result.read.method}) li {result.matches.length} de {importable} {importable===1?'campo':'campos'} do modelo. Marque o que quer usar e corrija os valores.{result.read.truncated?' Só as primeiras páginas foram lidas.':''}</p>
      {!result.matches.length&&<div className="sheet-import-empty" role="status"><p><strong>Não reconheci campos desta mesa nesse arquivo.</strong></p><ul><li>Prefira o PDF original a um print ou foto: ele traz o texto e, às vezes, os campos já preenchidos.</li><li>Em imagens, use uma captura nítida e inteira, com o texto horizontal e sem sombra.</li><li>Os nomes precisam bater com o modelo da mesa (por exemplo, Força, Agilidade, Pontos de vida). Peça ao mestre para aplicar o modelo do seu sistema em Editar modelo da ficha.</li></ul></div>}
      {result.matches.length>0&&<div className="sheet-import-bulk" role="group" aria-label="Seleção"><button type="button" disabled={phase==='applying'} onClick={()=>setRows(previous=>previous.map(row=>({...row,use:true})))}>Marcar todos</button><button type="button" disabled={phase==='applying'} onClick={()=>setRows(previous=>previous.map(row=>({...row,use:false})))}>Desmarcar todos</button><span>Os de confiança baixa começam desmarcados.</span></div>}
      {result.matches.length>0&&<div className="sheet-import-table-wrap"><table>
        <caption className="visually-hidden">Campos encontrados no arquivo</caption>
        <thead><tr><th scope="col">Usar</th><th scope="col">Campo</th><th scope="col">Valor lido</th><th scope="col">Confiança</th></tr></thead>
        <tbody>{rows.map(row=>{const existing=currentValues[row.fieldId],replaces=existing!==undefined&&existing!==''&&!same(existing,row.draft)&&!(row.type==='number'&&Number(existing)===Number(row.draft));return <tr key={row.fieldId} className={row.use?'':'is-off'}>
          <td><input type="checkbox" checked={row.use} disabled={phase==='applying'} aria-label={`Usar ${row.label}`} onChange={event=>edit(row.fieldId,{use:event.target.checked})}/></td>
          <th scope="row">{row.label}{replaces&&<small>Troca o valor atual: {describe(existing)}</small>}</th>
          <td>{row.type==='status'
            ?<span className="sheet-import-pair"><input type="number" min="0" aria-label={`${row.label}: valor atual`} value={row.draft.current} disabled={phase==='applying'} onChange={event=>edit(row.fieldId,{draft:{...row.draft,current:event.target.value}})}/><span aria-hidden="true">/</span><input type="number" min="0" aria-label={`${row.label}: valor máximo`} value={row.draft.max} disabled={phase==='applying'} onChange={event=>edit(row.fieldId,{draft:{...row.draft,max:event.target.value}})}/></span>
            :<input type={row.type==='number'?'number':'text'} aria-label={`${row.label}: valor`} value={row.draft} disabled={phase==='applying'} onChange={event=>edit(row.fieldId,{draft:event.target.value})}/>}</td>
          <td><span className={`sheet-import-confidence is-${row.confidence}`}>{confidenceLabel(row.confidence)}</span><small>{row.source==='campo do PDF'?'Campo do PDF':row.source==='posição'?'Posição na imagem':'Linha lida'}: {row.evidence}</small></td>
        </tr>;})}</tbody>
      </table></div>}
      {result.missing.length>0&&<details className="sheet-import-missing"><summary>Não encontrei {result.missing.length} {result.missing.length===1?'campo':'campos'}</summary><p>Preencha à mão: {result.missing.map(item=>item.label).join(', ')}.</p></details>}
      {result.manual.length>0&&<p className="sheet-import-manual">Textos longos, listas e imagens não são importados: {result.manual.map(item=>item.label).join(', ')}.</p>}
      {error&&<p role="alert" className="sheet-import-error">{error}</p>}
      <div className="sheet-import-actions">
        <button type="button" disabled={phase==='applying'} onClick={close}>Cancelar</button>
        <button type="button" className="is-primary" disabled={phase==='applying'||!chosen.length} onClick={apply}>{phase==='applying'?'Salvando…':`Preencher minha ficha com ${chosen.length} ${chosen.length===1?'campo':'campos'}`}</button>
      </div>
    </div>}
  </section>;
}
