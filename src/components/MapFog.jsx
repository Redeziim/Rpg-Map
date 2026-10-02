import './MapFog.css';

export default function MapFog({fog,canManage,tool,onTool,onChange,busy,hasImage}){
  return <fieldset className="map-fog-controls"><legend>Névoa de guerra</legend>
    <p>{!hasImage?canManage?'Envie uma imagem para começar.':'O mestre ainda não enviou o mapa.':fog.enabled?'Jogadores veem somente as áreas reveladas.':'O mapa inteiro está visível para jogadores.'}</p>
    {canManage?<>
      <button type="button" disabled={busy||!hasImage} onClick={()=>onChange(fog.enabled?'disable':'enable')}>{fog.enabled?'Mostrar mapa inteiro':'Ativar névoa'}</button>
      {fog.enabled&&<>
        <div role="group" aria-label="Alterar áreas reveladas">
          <button type="button" aria-pressed={tool==='reveal'} disabled={busy} onClick={()=>onTool('reveal')}>Revelar área</button>
          <button type="button" aria-pressed={tool==='cover'} disabled={busy} onClick={()=>onTool('cover')}>Cobrir área</button>
        </div>
        <p>Arraste no mapa ou toque em dois cantos para marcar um retângulo. No teclado: foque o mapa, Enter inicia, setas ajustam o tamanho, Alt+setas movem a área, Enter salva e Escape cancela.</p>
        <p>As áreas ficam salvas na mesa. Cobrir novamente não apaga o que alguém já viu.</p>
      </>}
    </>:fog.enabled&&<p>Peça ao mestre para revelar novas áreas. Traços aparecem quando seu caminho inteiro estiver revelado.</p>}
  </fieldset>;
}

export function MapFogOverlay({fog,master,id}){
  if(!fog.enabled)return null;
  return <g className="map-fog-overlay"><defs><mask id={id} maskUnits="userSpaceOnUse" x="0" y="0" width={fog.width} height={fog.height}><rect width={fog.width} height={fog.height} fill="white"/>{fog.areas.map((area,index)=><rect key={index} {...area} fill="black"/>)}</mask></defs><rect width={fog.width} height={fog.height} fill="#151913" opacity={master ? .62 : 1} mask={`url(#${id})`}/></g>;
}
