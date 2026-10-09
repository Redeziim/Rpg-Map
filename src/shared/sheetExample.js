// Valores de exemplo para a prévia do editor do modelo: deixam ver a ficha preenchida (números grandes, barras, fórmulas)
// sem que o mestre precise digitar. São só da prévia e nunca vão para o servidor.
export function exampleValues(fields){
  const values={};
  fields.forEach((field,index)=>{
    const id=field.id;
    switch(field.type){
      case 'number':values[id]=String(field.tab==='Atributos'?10+(index*3)%7:1+(index*2)%5);break;
      case 'text':values[id]=field.label.trim().toLowerCase()==='personagem'?'Aria Valdemar':'Exemplo';break;
      case 'textarea':values[id]='Texto de exemplo.\nUma segunda linha para ver como a caixa cresce.';break;
      case 'status':values[id]={current:7,max:10};break;
      case 'list':values[id]=['Item de exemplo','Outro item'];break;
      case 'checklist':values[id]=[{id:'c_exemplo_1',text:'Item de exemplo',checked:true},{id:'c_exemplo_2',text:'Outro item',checked:false}];break;
      case 'attack':values[id]={bonus:3,damage:'1d8+2'};break;
      default:break;
    }
  });
  return values;
}
