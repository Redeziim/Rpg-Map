import Notebook from './Notebook.jsx';
import TurnTracker from './TurnTracker.jsx';
import {AboutPanel,ScenesPanel} from './CampaignPages.jsx';
import React, { Suspense, lazy, useState, useEffect, useRef } from 'react';
import { Camera, Map, ShieldCheck, Users, Eye, Edit3, Plus, X, Upload, Grid, ChevronRight, Castle, Sword, Scroll, Skull, ScrollText, Dices, RotateCw, Image as ImageIcon, Type, GripVertical, Trash2, ListPlus, Settings2, ShoppingBag, Check, Hash, ArrowUp, ArrowDown, Palette, Minus, Heart, Calculator, ListChecks, Clapperboard, Info } from 'lucide-react';
import RoomManagement from './RoomManagement.jsx';
import { ROLE_LABELS } from '../api.js';
import StatusBars from './StatusBars.jsx';
import { SHEET_FONTS, FIELD_TYPES, evaluateFormula } from './sheetHelpers.jsx';
import { trapDialogFocus } from './trapDialogFocus.js';

const TabletopMap=lazy(()=>import('./tabletop/TabletopMap.jsx'));
const Scene3D=lazy(()=>import('./Scene3D.jsx'));
const DiceTray=lazy(()=>import('./DiceTray.jsx'));
const DiceFocus=lazy(()=>import('./DiceFocus.jsx'));
const DiceRoller=lazy(()=>import('./DiceRoller.jsx'));
const CharacterSheet=lazy(()=>import('./CharacterSheet.jsx'));
const GroupStatus=lazy(()=>import('./GroupStatus.jsx'));

const RPGMapExplorer = ({room,user,mutate,onExit,onLogout,connection,saving,error}) => {
  const [heldDice,setHeldDice]=useState(null);
  const [diceStructure,setDiceStructure]=useState('tray');
  const onTrayRoll=(terms,skinId)=>{setHeldDice({terms,skinId,structureId:'tray'});return true;};
  const throwHeldDice=async (gesture,physics)=>{if(!heldDice)return false;const result=await mutate('/tray-rolls',{...heldDice,gesture,physics},'POST');if(result)setHeldDice(null);return result;};
  const [selectedPlayer,setSelectedPlayer]=useState('');
  const [adminMode,setAdminMode]=useState('master');
  const viewMode=room.role==='admin'?adminMode:room.role==='master'?'master':'player';
  const canManageScenes=room.role==='admin'||room.role==='master';
  const [activeTab,setActiveTab]=useState('mesa');
  useEffect(()=>{if(activeTab==='cenas'&&!canManageScenes)setActiveTab('mesa');},[activeTab,canManageScenes]);
  const [mapMode,setMapMode]=useState('3d');
  const [mapFocus,setMapFocus]=useState(false);
  const [map2dToolsOpen,setMap2dToolsOpen]=useState(false);
  const [mapCanvasSize,setMapCanvasSize]=useState({width:0,height:0});
  const [mapViewportSize,setMapViewportSize]=useState({width:0,height:0});
  const {masterNotes='',mapImage,points,sheetFields,sheetFont,playerSheets,statusBarsData}=room.state;
  const playerName=user.username;
  const [selectedPoint,setSelectedPoint]=useState(null);
  const [showPointModal,setShowPointModal]=useState(false);
  const [pointSaveError,setPointSaveError]=useState(false);
  const [newPoint,setNewPoint]=useState({x:0,y:0,name:'',description:'',type:'cidade'});
  const [show3DScene,setShow3DScene]=useState(null);
  const [scale,setScale]=useState(1);
  const [position,setPosition]=useState({x:0,y:0});
  const [dragging,setDragging]=useState(false);
  const [dragStart,setDragStart]=useState({x:0,y:0});
  const canvasRef=useRef(null),canvasWrapperRef=useRef(null),mapRef=useRef(null),pointDialogRef=useRef(null),pointNameRef=useRef(null);
  useEffect(()=>{
    if(!showPointModal){setPointSaveError(false);return;}
    const dialog=pointDialogRef.current,opener=document.activeElement;
    dialog.showModal();
    pointNameRef.current?.focus();
    return()=>{if(dialog.open)dialog.close();requestAnimationFrame(()=>{if(opener?.isConnected)opener.focus();});};
  },[showPointModal]);
  const mapFit=mapCanvasSize.width&&mapCanvasSize.height&&mapViewportSize.width&&mapViewportSize.height
    ?Math.min((mapViewportSize.width-20)/mapCanvasSize.width,(mapViewportSize.height-20)/mapCanvasSize.height):1;
  const saveShared=patch=>mutate('/state',patch,'PATCH',current=>({...current,state:{...current.state,...patch}}));
  const saveSheetFields=sheetFields=>saveShared({sheetFields});
  const saveSheetFont=sheetFont=>saveShared({sheetFont});
  const savePlayerName=()=>{};
  const updatePlayerSheet=(name,updates)=>mutate(`/sheets/${encodeURIComponent(name)}`,updates,'PATCH',current=>{
    const previous=current.state.playerSheets[name]||{values:{},extraFields:[]};
    return {...current,state:{...current.state,playerSheets:{...current.state.playerSheets,[name]:{...previous,...updates,values:{...previous.values,...updates.values}}}}};
  });
  const updateProfile=(name,updates)=>mutate(`/profiles/${encodeURIComponent(name)}`,updates,'PATCH',current=>({...current,state:{...current.state,statusBarsData:{...current.state.statusBarsData,[name]:{...current.state.statusBarsData[name],...updates}}}}));
  const updatePlayerBars=(name,bars)=>updateProfile(name,{bars});
  const updatePlayerAvatar=(name,avatar)=>updateProfile(name,{avatar});
  const savePoints=points=>saveShared({points});
  const handleImageUpload=e=>{
    const file=e.target.files[0];if(!file)return;
    const reader=new FileReader();reader.onload=()=>saveShared({mapImage:reader.result});reader.readAsDataURL(file);
  };

  const pointTypes = [
    { value: 'cidade', label: 'Cidade', icon: Castle, color: '#c7ab76' },
    { value: 'dungeon', label: 'Dungeon', icon: Skull, color: '#8b0000' },
    { value: 'taverna', label: 'Taverna', icon: Scroll, color: '#cd853f' },
    { value: 'floresta', label: 'Floresta', icon: Grid, color: '#228b22' },
    { value: 'evento', label: 'Evento', icon: Sword, color: '#ff4500' },
  ];

  const handleCanvasClick = (e) => {
    if (dragging) return;

    const canvas=canvasRef.current;
    canvas.focus();
    const rect=canvas.getBoundingClientRect();
    const x=(e.clientX-rect.left)*canvas.width/rect.width;
    const y=(e.clientY-rect.top)*canvas.height/rect.height;

    // Verificar se clicou em um ponto existente
    const clickedPoint = points.find(p => {
      const distance = Math.sqrt(Math.pow(p.x - x, 2) + Math.pow(p.y - y, 2));
      return distance < 15;
    });

    if (clickedPoint) {
      setShow3DScene(clickedPoint);
    } else if (viewMode === 'master') {
      setNewPoint({ ...newPoint, x, y });
      setShowPointModal(true);
    }
  };

  const handlePointClick = (point) => {
    setShow3DScene(point);
  };

  const addPoint = async () => {
    if (!newPoint.name) return;
    
    const point = {
      ...newPoint,
      id: Date.now().toString(),
      createdAt: new Date().toISOString()
    };
    
    const saved=await savePoints([...points, point]);
    if(!saved){setPointSaveError(true);return;}
    setPointSaveError(false);
    setShowPointModal(false);
    setNewPoint({ x: 0, y: 0, name: '', description: '', type: 'cidade' });
  };

  const deletePoint = async (pointId) => {
    await savePoints(points.filter(p => p.id !== pointId));
  };

  const handleWheel = (e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setScale(prev => Math.min(Math.max(prev * delta, 0.5), 3));
  };

  const handleCanvasKeyDown=e=>{
    const step=e.shiftKey?16:48;
    if(e.key==='ArrowLeft')setPosition(p=>({...p,x:p.x+step}));
    else if(e.key==='ArrowRight')setPosition(p=>({...p,x:p.x-step}));
    else if(e.key==='ArrowUp')setPosition(p=>({...p,y:p.y+step}));
    else if(e.key==='ArrowDown')setPosition(p=>({...p,y:p.y-step}));
    else if(e.key==='+'||e.key==='=')setScale(s=>Math.min(s*1.2,3));
    else if(e.key==='-')setScale(s=>Math.max(s/1.2,.5));
    else if(e.key==='Home'){setScale(1);setPosition({x:0,y:0});}
    else return;
    e.preventDefault();
  };

  const handleMouseDown = (e) => {
    if (e.button === 0) {
      setDragging(true);
      setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
    }
  };

  const handleMouseMove = (e) => {
    if (dragging) {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    }
  };

  const handleMouseUp = () => {
    setDragging(false);
  };

  useEffect(() => {
    if (!canvasRef.current || !mapImage) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const img = new Image();
    let cancelled=false;
    
    img.onload = () => {
      if(cancelled)return;
      canvas.width = img.width;
      canvas.height = img.height;
      setMapCanvasSize({width:img.width,height:img.height});
      
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);

      // Desenhar pontos
      points.forEach(point => {
        const typeInfo = pointTypes.find(t => t.value === point.type);
        
        // Sombra
        ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
        ctx.shadowBlur = 10;
        ctx.shadowOffsetX = 2;
        ctx.shadowOffsetY = 2;

        // Círculo
        ctx.beginPath();
        ctx.arc(point.x, point.y, 12, 0, Math.PI * 2);
        ctx.fillStyle = typeInfo?.color || '#c7ab76';
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 3;
        ctx.stroke();

        ctx.shadowColor = 'transparent';

        // Nome
        ctx.font = 'bold 14px "Cinzel", serif';
        ctx.fillStyle = '#191c1a';
        ctx.textAlign = 'center';
        ctx.fillText(point.name, point.x, point.y - 20);
      });
    };
    
    img.src = mapImage;
    return()=>{cancelled=true;img.onload=null;};
  }, [mapImage, points, mapMode, activeTab]);

  useEffect(()=>{
    if(mapMode!=='2d'||activeTab!=='mapa'||!mapImage||!canvasWrapperRef.current)return;
    const wrapper=canvasWrapperRef.current;
    const measure=()=>{const rect=wrapper.getBoundingClientRect();setMapViewportSize(previous=>previous.width===rect.width&&previous.height===rect.height?previous:{width:rect.width,height:rect.height});};
    const observer=new ResizeObserver(measure);
    observer.observe(wrapper);measure();
    return()=>observer.disconnect();
  },[mapMode,activeTab,mapImage]);

  const playerNames=room.members.filter(m=>m.role!=='master').map(m=>m.username);
  const groupEntries=room.groupBars;
  return (
    <div className={`rpg-container mist-theme ${activeTab==='mapa'&&mapFocus?'map-focus':''}`}>
      <a className="skip-link" href="#main-content">Pular para o conteúdo</a>
      
      {/* Header */}
      <header className="header">
        <div className="header-content">
          <div className="logo">
            <div className="brand-mark"><ScrollText size={25} /></div><div><span className="brand-kicker">SUA MESA DE RPG</span><h1>Grimório</h1></div>
          </div>
          <div className="header-controls">
            <div className="room-title-nav">{room.name}</div>
            {room.role==='admin'?<button className={`mode-btn ${viewMode==='master'?'active':''}`} onClick={()=>setAdminMode(viewMode==='master'?'player':'master')} title="Como ADM, você pode alternar entre jogador e mestre"><ShieldCheck size={18}/>{viewMode==='master'?'ADM · modo mestre':'ADM · modo jogador'}</button>:<div className="identity-label">{ROLE_LABELS[room.role]} · @{user.username}</div>}
            <span className={`sync-status ${connection!=='online'?'offline':''}`} role="status">{saving?'Enviando alterações…':connection==='online'?'Conectado à mesa':connection==='connecting'?'Conectando…':'Reconectando ao servidor…'}</span>
            <div className="account-nav-actions"><button onClick={onExit}>Minhas mesas</button><button onClick={onLogout}>Sair da conta</button></div>
            <div className="user-indicator">
              <Users size={20} />
              <span>{points.length} pontos</span>
            </div>
          </div>
        </div>
        <nav className="tab-nav" aria-label="Navegação principal"><button className={`tab-btn ${activeTab==='mesa'?'active':''}`} aria-pressed={activeTab==='mesa'} onClick={()=>setActiveTab('mesa')}><Users size={18}/>Mesa</button>
          <button
            className={`tab-btn ${activeTab === 'mapa' ? 'active' : ''}`}
            aria-pressed={activeTab === 'mapa'}
            onClick={() => setActiveTab('mapa')}
          >
            <Map size={18} />
            Mapa
          </button>
          <button
            className={`tab-btn ${activeTab === 'ficha' ? 'active' : ''}`}
            aria-label={viewMode==='master'?'Mestre · fichas':'Jogador · ficha'}
            aria-pressed={activeTab === 'ficha'}
            onClick={() => setActiveTab('ficha')}
          >
            <ScrollText size={18} />
            <span className="tab-label-full">{viewMode==='master'?'Mestre · fichas':'Jogador · ficha'}</span><span className="tab-label-short" aria-hidden="true">Ficha</span>
          </button>
          <button
            className={`tab-btn ${activeTab === 'grupo' ? 'active' : ''}`}
            aria-label="Status do Grupo"
            aria-pressed={activeTab === 'grupo'}
            onClick={() => setActiveTab('grupo')}
          >
            <Heart size={18} />
            <span className="tab-label-full">Status do Grupo</span><span className="tab-label-short" aria-hidden="true">Grupo</span>
          </button>
          {canManageScenes&&<button className={`tab-btn ${activeTab==='cenas'?'active':''}`} aria-pressed={activeTab==='cenas'} onClick={()=>setActiveTab('cenas')}><Clapperboard size={18} aria-hidden="true"/>Cenas</button>}
        </nav>
        <div className="nav-footer"><button className={`nav-about-button ${activeTab==='sobre'?'active':''}`} aria-pressed={activeTab==='sobre'} onClick={()=>setActiveTab('sobre')}><Info size={18} aria-hidden="true"/>Sobre</button></div>
      </header>

      <div className="room-content"><div className="session-strip"><TurnTracker room={room} username={user.username} editable={viewMode==='master'} saving={saving} mutate={mutate}/>{viewMode==='master'&&<Notebook key={room.id+':master'} storageKey={room.id+':'+user.id+':master'} className="master-notebook" title="Notas do mestre" hint="Privadas · várias janelas" scope="@master" username={user.username} members={room.members} canShare notes={room.state.masterNotebooks||[]} onSave={(_,id,note)=>mutate('/notes/@master/'+id,note,'PATCH')} onShare={(_,id,data)=>mutate('/notes/@master/'+id+'/share',data,'PATCH')}/>}<Notebook key={room.id+':shared:'+user.id} storageKey={room.id+':'+user.id+':shared'} className="shared-notebook" title="Notas compartilhadas" hint="Acesso e edição em grupo" scope="shared" username={user.username} members={room.members} notes={room.state.sharedNotebooks||[]} onSave={(scope,id,note)=>mutate(`/notes/${encodeURIComponent(scope)}/${id}`,note,'PATCH')}/></div>
      <div id="main-content" className={`main-content view-${activeTab}`} tabIndex={-1}>
        {activeTab==='mesa'?<RoomManagement room={room} mutate={mutate}/>:activeTab === 'mapa' ? (
          <>
            <div className="map-mode-tabs" role="group" aria-label="Visualização do mapa"><button aria-pressed={mapMode==='3d'} onClick={()=>setMapMode('3d')}>Mesa 3D</button><button aria-pressed={mapMode==='2d'} onClick={()=>setMapMode('2d')}>Mapa 2D e pontos</button>{mapMode==='2d'&&<button aria-expanded={map2dToolsOpen} aria-controls="map-2d-tools" onClick={()=>setMap2dToolsOpen(open=>!open)}>{map2dToolsOpen?'Fechar ferramentas':'Ferramentas 2D'}</button>}<button className="map-focus-button" aria-pressed={mapFocus} onClick={()=>setMapFocus(focus=>!focus)}>{mapFocus?'Sair do foco':'Ampliar mapa'}</button></div>
            {mapMode==='3d'?<Suspense fallback={<p role="status">Preparando a mesa 3D…</p>}><TabletopMap room={room} mutate={mutate} editable={room.role==='admin'||room.role==='master'}/></Suspense>:<div className="legacy-map-layout">
            {/* Sidebar */}
            <aside id="map-2d-tools" className="sidebar" hidden={!map2dToolsOpen}>
              <div className="sidebar-section">
                <h3>
                  <Upload size={18} />
                  Mapa
                </h3>
                {viewMode === 'master' && (
                  <label className="upload-btn">
                    <input type="file" accept="image/*" onChange={handleImageUpload} />
                    Selecionar imagem
                  </label>
                )}
              </div>

              <div className="sidebar-section">
                <h3>
                  <Grid size={18} />
                  Pontos de Interesse ({points.length})
                </h3>
                <div className="points-list">
                  {points.map(point => {
                    const typeInfo = pointTypes.find(t => t.value === point.type);
                    const Icon = typeInfo?.icon || Castle;
                    return (
                      <div key={point.id} className="point-item">
                        <button className="point-info" onClick={() => handlePointClick(point)}>
                          <Icon size={16} style={{ color: typeInfo?.color }} />
                          <div>
                            <strong>{point.name}</strong>
                            <small>{point.type}</small>
                          </div>
                        </button>
                        {viewMode === 'master' && (
                          <button 
                            className="delete-btn"
                            aria-label={`Excluir ponto ${point.name}`}
                            onClick={() => deletePoint(point.id)}
                          >
                            <X size={16} />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="sidebar-section">
                <h3>Controles</h3>
                <div className="controls-info">
                  <p><strong>Roda do mouse:</strong> aproximar ou afastar</p>
                  <p><strong>Arrastar:</strong> mover o mapa</p>
                  <p><strong>Clique:</strong> {viewMode === 'master' ? 'adicionar ponto' : 'ver ponto'}</p>
                  <p id="map-keyboard-help"><strong>Teclado:</strong> foco no mapa, setas para mover, +/− para zoom e Home para centralizar. Abra pontos pela lista acima.</p>
                </div>
                {mapImage&&<div className="map-keyboard-actions" role="group" aria-label="Controles do mapa 2D">
                  <button onClick={()=>setScale(prev=>Math.min(prev*1.2,3))}>Aproximar</button>
                  <button onClick={()=>setScale(prev=>Math.max(prev/1.2,.5))}>Afastar</button>
                  <button onClick={()=>{setScale(1);setPosition({x:0,y:0});}}>Centralizar</button>
                  {viewMode==='master'&&<button onClick={()=>{const canvas=canvasRef.current;setNewPoint({...newPoint,x:(canvas?.width||0)/2,y:(canvas?.height||0)/2});setShowPointModal(true);}}>Adicionar ponto no centro</button>}
                </div>}
                <div className="zoom-indicator">
                  Zoom: {Math.round(scale * 100)}%
                </div>
              </div>
            </aside>

            {/* Canvas principal */}
            <main className="canvas-area">
              {!mapImage ? (
                <div className="empty-state">
                  <Map size={64} />
                  <h2>Nenhum mapa carregado</h2>
                  <p>{viewMode === 'master' ? 'Envie um mapa pelo painel para começar a exploração.' : 'O mestre ainda não revelou o mapa desta jornada.'}</p>
                </div>
              ) : (
                <div 
                  className="canvas-wrapper"
                  ref={canvasWrapperRef}
                  onWheel={handleWheel}
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseUp}
                >
                  <canvas
                    ref={canvasRef}
                    className="map-canvas"
                    tabIndex={0}
                    role="img"
                    aria-label="Mapa 2D. Setas movem, mais e menos ajustam zoom, Home centraliza. Abra pontos na lista das ferramentas."
                    onClick={handleCanvasClick}
                    onKeyDown={handleCanvasKeyDown}
                    style={{
                      width:mapCanvasSize.width*mapFit||undefined,
                      height:mapCanvasSize.height*mapFit||undefined,
                      transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
                      cursor: dragging ? 'grabbing' : 'grab'
                    }}
                  />
                </div>
              )}
            </main>
            </div>}
          </>
        ) : activeTab === 'ficha' ? (
          <>
            {/* Área principal da Ficha de Personagem */}
            <main className="sheet-area">
              <Suspense fallback={<p role="status">Preparando a ficha…</p>}>
              <CharacterSheet
                notebookKey={`${room.id}:${user.id}`}
                onSaveNote={(name,id,note)=>mutate(`/notes/${encodeURIComponent(name)}/${id}`,note,'PATCH')}
                onShareNote={(name,id,data)=>mutate(`/notes/${encodeURIComponent(name)}/${id}/share`,data,'PATCH')}
                notebookMembers={room.members}
                notebookUsername={user.username}
                canEditSelected={room.role==='admin'}
                selectedPlayer={selectedPlayer}
                onSelectPlayer={setSelectedPlayer}
                playerNames={playerNames}
                profile={<StatusBars
                selectedPlayer={selectedPlayer}
                viewMode={viewMode}
                playerName={playerName}
                onPlayerNameChange={savePlayerName}
                allPlayersBars={statusBarsData}
                onUpdatePlayerBars={updatePlayerBars}
                onUpdatePlayerAvatar={updatePlayerAvatar}
              />}
                viewMode={viewMode}
                sheetFields={sheetFields}
                onFieldsChange={saveSheetFields}
                sheetFont={sheetFont}
                onFontChange={saveSheetFont}
                playerName={playerName}
                onPlayerNameChange={savePlayerName}
                playerSheets={playerSheets}
                onUpdatePlayerSheet={updatePlayerSheet}
              />
              </Suspense>
            </main>

            {/* Painel lateral com o Dado */}
            <aside className="sheet-sidebar">
              <Suspense fallback={<p role="status">Preparando os dados…</p>}><DiceRoller onTrayRoll={onTrayRoll}/></Suspense>
            </aside>
          </>
        ) : activeTab==='cenas' ? (canManageScenes?<ScenesPanel/>:null) : activeTab==='sobre' ? <AboutPanel roomId={room.id} username={user.username} role={room.role}/> : (
          <main className="group-status-area"><div className="sheet-heading"><div><span className="eyebrow">Companheiros de jornada</span><h2>Status do grupo</h2></div><span className="sheet-seal"><Users size={16} />{playerNames.length} {playerNames.length===1?'jogador':'jogadores'}</span></div>
            <div className="group-workspace"><section className="party-roster" aria-label="Personagens da mesa"><Suspense fallback={<p role="status">Preparando o grupo…</p>}><GroupStatus
              viewMode={viewMode}
              activePlayer={room.state.activePlayer}
              allPlayersBars={groupEntries}
              onOpenSheet={name => {setSelectedPlayer(name);setActiveTab('ficha');}}
              onUpdatePlayerBars={updatePlayerBars}
            /></Suspense>
            </section><aside className="group-roll-station" aria-label="Bandeja e dados"><Suspense fallback={<p role="status">Preparando a bandeja…</p>}><DiceTray roll={room.trayRoll} serverTime={room.serverTime} held={heldDice} onThrow={throwHeldDice} onCancel={()=>setHeldDice(null)}/></Suspense><div className="group-dice-controls"><Suspense fallback={<p role="status">Preparando os dados…</p>}><DiceRoller onTrayRoll={onTrayRoll} sharedOnly/></Suspense></div></aside></div>
          </main>
        )}
      </div>

      </div>
      {activeTab!=='grupo'&&<Suspense fallback={<p role="status">Preparando a bandeja…</p>}><DiceTray roll={room.trayRoll} serverTime={room.serverTime} held={heldDice} onThrow={throwHeldDice} onCancel={()=>setHeldDice(null)} compact/></Suspense>}
      <Suspense fallback={null}><DiceFocus roll={room.trayRoll} serverTime={room.serverTime} enabled={activeTab==='grupo'||room.trayRoll?.username===user.username}/></Suspense>
      {/* Modal de adicionar ponto */}
      {showPointModal && (
        <dialog ref={pointDialogRef} className="modal-overlay" aria-labelledby="new-point-title" onKeyDown={trapDialogFocus} onCancel={e=>{e.preventDefault();setShowPointModal(false);}}>
          <div className="modal">
            <div className="modal-header">
              <h2 id="new-point-title">Novo Ponto de Interesse</h2>
              <button aria-label="Fechar novo ponto" onClick={() => setShowPointModal(false)}>
                <X size={24} />
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label htmlFor="new-point-name">Nome</label>
                <input
                  id="new-point-name"
                  ref={pointNameRef}
                  name="pointName"
                  autoComplete="off"
                  type="text"
                  value={newPoint.name}
                  onChange={(e) => setNewPoint({ ...newPoint, name: e.target.value })}
                  placeholder="Ex: Cidade de Eldoria"
                />
              </div>
              <div className="form-group">
                <label htmlFor="new-point-description">Descrição</label>
                <textarea
                  id="new-point-description"
                  name="pointDescription"
                  value={newPoint.description}
                  onChange={(e) => setNewPoint({ ...newPoint, description: e.target.value })}
                  placeholder="Descreva este local..."
                  rows={3}
                />
              </div>
              <div className="form-group">
                <span id="new-point-type">Tipo</span>
                <div className="type-grid" role="group" aria-labelledby="new-point-type">
                  {pointTypes.map(type => {
                    const Icon = type.icon;
                    return (
                      <button
                        key={type.value}
                        className={`type-btn ${newPoint.type === type.value ? 'active' : ''}`}
                        aria-pressed={newPoint.type === type.value}
                        onClick={() => setNewPoint({ ...newPoint, type: type.value })}
                        style={{ '--type-color': type.color }}
                      >
                        <Icon size={20} />
                        {type.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
            {pointSaveError&&<p className="modal-error" role="alert">{error||'Não foi possível salvar o ponto. Revise o mapa e tente novamente.'}</p>}
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowPointModal(false)}>
                Cancelar
              </button>
              <button className="btn-primary" onClick={addPoint} disabled={!newPoint.name.trim()}>
                <Plus size={18} />
                Adicionar Ponto
              </button>
            </div>
          </div>
        </dialog>
      )}

      {/* Visualização 3D */}
      {show3DScene && (
        <Suspense fallback={<p role="status">Abrindo local…</p>}><Scene3D
          pointData={show3DScene}
          onClose={() => setShow3DScene(null)}
        /></Suspense>
      )}

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700&family=Crimson+Pro:wght@300;400;600&family=MedievalSharp&family=Uncial+Antiqua&family=IM+Fell+English:ital@0;1&family=Metamorphous&family=Grenze:wght@400;600&display=swap');

        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }

        .rpg-container {
          width: 100%;
          height: 100vh;
          font-family: 'Crimson Pro', serif;
          background: linear-gradient(135deg, #121413 0%, #222321 100%);
          color: #e9dfcd;
          position: relative;
          overflow: hidden;
        }

        .header {
          background: linear-gradient(180deg, rgba(25, 28, 26, 0.95) 0%, rgba(25, 28, 26, 0.85) 100%);
          border-bottom: 3px solid #c7ab76;
          box-shadow: 0 4px 20px rgba(199, 171, 118, 0.2);
          position: relative;
          z-index: 10;
        }

        .header-content {
          max-width: 1800px;
          margin: 0 auto;
          padding: 1rem 2rem;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .logo {
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        .logo svg {
          color: #c7ab76;
          filter: drop-shadow(0 2px 4px rgba(199, 171, 118, 0.5));
        }

        .logo h1 {
          font-family: 'Cinzel', serif;
          font-size: 1.8rem;
          font-weight: 700;
          color: #c7ab76;
          text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.8);
          letter-spacing: 1px;
        }

        .header-controls {
          display: flex;
          gap: 1rem;
          align-items: center;
        }

        .mode-btn {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.75rem 1.5rem;
          background: rgba(151, 126, 96, 0.3);
          border: 2px solid #51493e;
          border-radius: 8px;
          color: #e9dfcd;
          font-family: 'Crimson Pro', serif;
          font-size: 1rem;
          font-weight: 600;
          cursor: pointer;
          transition: background-color 0.3s ease;
        }

        .mode-btn:hover {
          background: rgba(151, 126, 96, 0.5);
          border-color: #c7ab76;
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(199, 171, 118, 0.3);
        }

        .mode-btn.active {
          background: linear-gradient(135deg, #c7ab76 0%, #b98867 100%);
          border-color: #c7ab76;
          color: #191c1a;
          box-shadow: 0 4px 16px rgba(199, 171, 118, 0.5);
        }

        .user-indicator {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.75rem 1rem;
          background: rgba(0, 0, 0, 0.3);
          border-radius: 8px;
          border: 1px solid rgba(199, 171, 118, 0.3);
        }

        .tab-nav {
          display: flex;
          gap: 0.5rem;
          max-width: 1800px;
          margin: 0 auto;
          padding: 0 2rem 0.75rem;
        }

        .tab-btn {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.6rem 1.25rem;
          background: rgba(0, 0, 0, 0.25);
          border: 2px solid rgba(151, 126, 96, 0.6);
          border-bottom: none;
          border-radius: 8px 8px 0 0;
          color: #b9b09f;
          font-family: 'Cinzel', serif;
          font-size: 0.9rem;
          font-weight: 600;
          letter-spacing: 0.5px;
          cursor: pointer;
          transition: background-color 0.25s ease;
        }

        .tab-btn:hover {
          color: #e9dfcd;
          background: rgba(151, 126, 96, 0.3);
        }

        .tab-btn.active {
          color: #191c1a;
          background: linear-gradient(135deg, #c7ab76 0%, #b98867 100%);
          border-color: #c7ab76;
          box-shadow: 0 -2px 12px rgba(199, 171, 118, 0.4);
        }

        .sheet-area {
          flex: 1;
          position: relative;
          overflow-y: auto;
          background: radial-gradient(circle at center, #191c1a 0%, #121413 100%);
        }

        .sheet-sidebar {
          width: 320px;
          background: linear-gradient(180deg, rgba(25, 28, 26, 0.95) 0%, rgba(20, 23, 21, 0.95) 100%);
          border-left: 3px solid #51493e;
          padding: 1.5rem;
          overflow-y: auto;
          box-shadow: -4px 0 20px rgba(0, 0, 0, 0.5);
        }

        .status-player-header {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          margin-bottom: 0.75rem;
        }

        .status-avatar-wrap {
          position: relative;
          flex-shrink: 0;
        }

        .status-avatar-img,
        .status-avatar-placeholder {
          width: 48px;
          height: 48px;
          border-radius: 50%;
          object-fit: cover;
          border: 2px solid #c7ab76;
        }

        .status-avatar-placeholder {
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(0, 0, 0, 0.3);
          color: #a39988;
        }

        .status-avatar-upload-btn {
          position: absolute;
          bottom: -2px;
          right: -2px;
          width: 20px;
          height: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #c7ab76;
          color: #191c1a;
          border-radius: 50%;
          cursor: pointer;
          border: 2px solid #121413;
        }

        .status-avatar-upload-btn input {
          display: none;
        }

        .group-status-area {
          flex: 1;
          padding: 2rem;
          overflow-y: auto;
          background: radial-gradient(circle at center, #191c1a 0%, #121413 100%);
        }

        .group-status-empty {
          height: 100%;
        }

        .group-status-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 1.25rem;
          max-width: 1400px;
          margin: 0 auto;
        }

        .group-status-card {
          background: rgba(0, 0, 0, 0.3);
          border: 2px solid rgba(199, 171, 118, 0.35);
          border-radius: 12px;
          padding: 1.1rem;
          transition: none;
        }

        .group-status-card:hover {
          border-color: #d6b36b;
          background: #252117;
        }

        .group-status-card-header {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          margin-bottom: 1rem;
          padding-bottom: 0.75rem;
          border-bottom: 1px solid rgba(199, 171, 118, 0.2);
        }

        .group-status-avatar {
          width: 44px;
          height: 44px;
          border-radius: 50%;
          object-fit: cover;
          border: 2px solid #c7ab76;
          flex-shrink: 0;
        }

        .group-status-avatar-placeholder {
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(151, 126, 96, 0.3);
          color: #a39988;
        }

        .group-status-card-header h4 {
          font-family: 'Cinzel', serif;
          color: #e9dfcd;
          font-size: 1rem;
        }

        .group-status-bars {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        /* --- Animações de dano/cura no Status do Grupo --- */

        .bar-float-text {
          position: absolute;
          left: 50%;
          bottom: 100%;
          transform: translateX(-50%);
          font-family: 'Cinzel', serif;
          font-weight: 700;
          font-size: 1rem;
          text-shadow: 0 2px 6px rgba(0, 0, 0, 0.9);
          pointer-events: none;
          white-space: nowrap;
          animation: floatUpFade 1.6s ease-out forwards;
          z-index: 3;
        }

        .bar-float-damage {
          color: #ff4d4d;
        }

        .bar-float-heal {
          color: #4dff8f;
        }

        @keyframes floatUpFade {
          0% { opacity: 0; transform: translateX(-50%) translateY(0) scale(0.8); }
          15% { opacity: 1; transform: translateX(-50%) translateY(-4px) scale(1.15); }
          70% { opacity: 1; transform: translateX(-50%) translateY(-22px) scale(1); }
          100% { opacity: 0; transform: translateX(-50%) translateY(-34px) scale(0.95); }
        }

        .bar-flash-damage {
          animation: barFlashDamage 0.5s ease-out;
        }

        .bar-flash-heal {
          animation: barFlashHeal 0.5s ease-out;
        }

        @keyframes barFlashDamage {
          0%, 100% { box-shadow: none; }
          25% { box-shadow: 0 0 0 3px rgba(255, 60, 60, 0.7); }
        }

        @keyframes barFlashHeal {
          0%, 100% { box-shadow: none; }
          25% { box-shadow: 0 0 0 3px rgba(80, 255, 140, 0.7); }
        }

        .card-hit-shake {
          animation: cardHitShake 0.4s ease-in-out;
        }

        @keyframes cardHitShake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-5px); }
          40% { transform: translateX(4px); }
          60% { transform: translateX(-3px); }
          80% { transform: translateX(2px); }
        }

        .bar-down-badge {
          position: absolute;
          right: 4px;
          top: 50%;
          transform: translateY(-50%);
          font-size: 0.7rem;
          filter: drop-shadow(0 0 2px rgba(0, 0, 0, 0.9));
          z-index: 2;
        }

        .status-bars-panel {
          max-width: 1000px;
          margin: 0 auto 1.5rem;
          padding: 1.25rem 1.5rem;
          background: rgba(0, 0, 0, 0.3);
          border: 2px solid rgba(199, 171, 118, 0.35);
          border-radius: 12px;
        }

        .status-bars-panel h3 {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-family: 'Cinzel', serif;
          color: #c7ab76;
          font-size: 1rem;
          text-transform: uppercase;
          letter-spacing: 1px;
          margin-bottom: 0.75rem;
        }

        .status-bars-hint {
          color: #b9b09f;
          font-size: 0.85rem;
          margin-bottom: 0.75rem;
        }

        .status-bars-hint strong {
          color: #c7ab76;
        }

        .status-name-row,
        .status-master-select-row {
          display: flex;
          gap: 0.6rem;
          align-items: center;
        }

        .status-name-row input,
        .status-master-select-row select {
          padding: 0.55rem 0.75rem;
          background: rgba(0, 0, 0, 0.4);
          border: 2px solid rgba(199, 171, 118, 0.3);
          border-radius: 6px;
          color: #e9dfcd;
          font-size: 0.9rem;
        }

        .status-master-select-row {
          margin-bottom: 1rem;
          color: #b9b09f;
          font-size: 0.85rem;
        }

        .status-master-select-row select {
          flex: 1;
          max-width: 260px;
        }

        .status-bar-list {
          display: flex;
          flex-direction: column;
          gap: 0.9rem;
          margin-bottom: 1rem;
        }

        .status-bar-row {
          display: flex;
          flex-direction: column;
          gap: 0.35rem;
        }

        .status-bar-top {
          display: flex;
          justify-content: space-between;
          font-size: 0.85rem;
        }

        .status-bar-label {
          color: #e9dfcd;
          font-weight: 600;
        }

        .status-bar-numbers {
          color: #b9b09f;
        }

        .status-bar-track {
          position: relative;
          width: 100%;
          height: 14px;
          background: rgba(0, 0, 0, 0.4);
          border: 1px solid rgba(199, 171, 118, 0.25);
          border-radius: 8px;
          overflow: visible;
        }

        .status-bar-fill {
          height: 100%;
          border-radius: 7px;
          transition: width 0.3s ease;
        }

        .status-bar-controls {
          display: flex;
          align-items: center;
          gap: 0.4rem;
        }

        .status-bar-controls button {
          width: 26px;
          height: 26px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(151, 126, 96, 0.3);
          border: 1px solid #51493e;
          border-radius: 4px;
          color: #e9dfcd;
          cursor: pointer;
        }

        .status-bar-controls button:hover {
          background: rgba(151, 126, 96, 0.5);
          border-color: #c7ab76;
        }

        .status-bar-controls input[type="number"] {
          width: 60px;
          padding: 0.3rem;
          text-align: center;
          background: rgba(0, 0, 0, 0.4);
          border: 1px solid rgba(199, 171, 118, 0.3);
          border-radius: 4px;
          color: #e9dfcd;
          font-size: 0.85rem;
        }

        .status-bar-quick {
          width: auto !important;
          padding: 0 0.5rem;
          font-size: 0.7rem;
        }

        .status-bar-remove {
          margin-left: auto;
          background: rgba(139, 0, 0, 0.25) !important;
          border-color: #8b0000 !important;
          color: #ff6b6b !important;
        }

        .status-bar-remove:hover {
          background: rgba(139, 0, 0, 0.5) !important;
        }

        .status-bar-add-row {
          display: flex;
          gap: 0.5rem;
          flex-wrap: wrap;
          align-items: center;
          padding-top: 0.75rem;
          border-top: 1px solid rgba(199, 171, 118, 0.2);
        }

        .status-bar-add-row input[type="text"] {
          flex: 1;
          min-width: 160px;
          padding: 0.5rem 0.7rem;
          background: rgba(0, 0, 0, 0.4);
          border: 2px solid rgba(199, 171, 118, 0.3);
          border-radius: 6px;
          color: #e9dfcd;
          font-size: 0.85rem;
        }

        .status-bar-add-row input[type="color"] {
          width: 40px;
          height: 36px;
          padding: 2px;
          background: transparent;
          border: 2px solid rgba(199, 171, 118, 0.3);
          border-radius: 6px;
          cursor: pointer;
        }

        .status-bar-max-input {
          width: 70px !important;
          flex: none !important;
        }


          padding: 2rem;
          max-width: 1000px;
          margin: 0 auto;
        }

        .sheet-master-toolbar {
          display: flex;
          gap: 0.75rem;
          margin-bottom: 1.25rem;
          flex-wrap: wrap;
        }

        .save-status {
          position: sticky;
          top: 0;
          z-index: 5;
          display: inline-flex;
          align-items: center;
          gap: 0.35rem;
          margin-bottom: 0.75rem;
          padding: 0.3rem 0.75rem;
          border-radius: 20px;
          font-family: 'Crimson Pro', serif;
          font-size: 0.8rem;
          transition: opacity 0.3s ease;
          min-height: 1.6rem;
        }

        .save-status-idle {
          opacity: 0;
          pointer-events: none;
        }

        .save-status-saving {
          background: rgba(151, 126, 96, 0.3);
          color: #c7ab76;
        }

        .save-status-saved {
          background: rgba(34, 139, 34, 0.2);
          color: #7ed17e;
        }

        .sheet-tool-btn {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.6rem 1.1rem;
          background: linear-gradient(135deg, #c7ab76 0%, #b98867 100%);
          border: 2px solid #c7ab76;
          border-radius: 8px;
          color: #191c1a;
          font-family: 'Cinzel', serif;
          font-weight: 700;
          font-size: 0.85rem;
          cursor: pointer;
          transition: background-color 0.25s ease;
        }

        .sheet-tool-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 14px rgba(199, 171, 118, 0.4);
        }

        .font-picker-panel {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
          gap: 0.75rem;
          margin-bottom: 1.25rem;
          padding: 1rem;
          background: rgba(0, 0, 0, 0.3);
          border: 1px solid rgba(199, 171, 118, 0.3);
          border-radius: 10px;
        }

        .font-swatch-btn {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.3rem;
          padding: 0.9rem 0.5rem;
          background: rgba(151, 126, 96, 0.2);
          border: 2px solid rgba(199, 171, 118, 0.3);
          border-radius: 8px;
          color: #e9dfcd;
          font-size: 1.3rem;
          cursor: pointer;
          transition: background-color 0.25s ease;
        }

        .font-swatch-btn:hover {
          background: rgba(151, 126, 96, 0.4);
          border-color: #c7ab76;
        }

        .font-swatch-btn.active {
          border-color: #c7ab76;
          background: rgba(199, 171, 118, 0.15);
          box-shadow: 0 0 12px rgba(199, 171, 118, 0.3);
        }

        .font-swatch-btn small {
          font-family: 'Crimson Pro', serif;
          font-size: 0.7rem;
          color: #b9b09f;
        }

        .field-builder-panel {
          margin-bottom: 1.5rem;
          padding: 1.25rem;
          background: rgba(0, 0, 0, 0.3);
          border: 1px solid rgba(199, 171, 118, 0.3);
          border-radius: 10px;
        }

        .field-builder-panel h4 {
          font-family: 'Cinzel', serif;
          color: #c7ab76;
          font-size: 0.95rem;
          text-transform: uppercase;
          letter-spacing: 1px;
          margin-bottom: 0.85rem;
        }

        .field-type-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
          gap: 0.5rem;
          margin-bottom: 1rem;
        }

        .field-type-btn {
          display: flex;
          align-items: center;
          gap: 0.4rem;
          padding: 0.55rem 0.7rem;
          background: rgba(151, 126, 96, 0.2);
          border: 2px solid rgba(199, 171, 118, 0.3);
          border-radius: 6px;
          color: #e9dfcd;
          font-size: 0.8rem;
          cursor: pointer;
          transition: background-color 0.25s ease;
        }

        .field-type-btn:hover {
          background: rgba(151, 126, 96, 0.4);
        }

        .field-type-btn.active {
          background: linear-gradient(135deg, #c7ab76 0%, #b98867 100%);
          border-color: #c7ab76;
          color: #191c1a;
        }

        .field-add-row {
          display: flex;
          gap: 0.6rem;
          margin-bottom: 1rem;
        }

        .field-add-row input {
          flex: 1;
          padding: 0.6rem 0.85rem;
          background: rgba(0, 0, 0, 0.4);
          border: 2px solid rgba(199, 171, 118, 0.3);
          border-radius: 6px;
          color: #e9dfcd;
          font-size: 0.9rem;
        }

        .field-add-row input:focus {
          outline: none;
          border-color: #c7ab76;
        }

        .field-add-btn {
          display: flex;
          align-items: center;
          gap: 0.4rem;
          padding: 0.6rem 1rem;
          background: linear-gradient(135deg, #c7ab76 0%, #b98867 100%);
          border: none;
          border-radius: 6px;
          color: #191c1a;
          font-weight: 700;
          font-size: 0.85rem;
          cursor: pointer;
          white-space: nowrap;
        }

        .field-add-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        /* Dica de auto-categorização enquanto o nome é digitado */
        .auto-cat-hint {
          font-family: 'Crimson Pro', serif;
          font-size: 0.78rem;
          color: #c7ab76;
          white-space: nowrap;
          font-style: italic;
          animation: hintPulse 1.4s ease-in-out infinite;
        }

        @keyframes hintPulse {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 1; }
        }

        .field-list {
          display: flex;
          flex-direction: column;
          gap: 0.4rem;
        }

        .field-list-row {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.5rem 0.6rem;
          background: rgba(151, 126, 96, 0.15);
          border: 1px solid rgba(199, 171, 118, 0.2);
          border-radius: 6px;
        }

        .field-list-icon {
          color: #c7ab76;
          flex-shrink: 0;
        }

        .field-list-label-input {
          flex: 1;
          padding: 0.35rem 0.5rem;
          background: rgba(0, 0, 0, 0.3);
          border: 1px solid rgba(199, 171, 118, 0.25);
          border-radius: 4px;
          color: #e9dfcd;
          font-size: 0.85rem;
          min-width: 100px;
        }

        .field-list-label-input:focus {
          outline: none;
          border-color: #c7ab76;
        }

        .field-list-type {
          font-size: 0.72rem;
          color: #a39988;
          white-space: nowrap;
        }

        .field-list-row button {
          width: 26px;
          height: 26px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(0, 0, 0, 0.3);
          border: 1px solid #51493e;
          border-radius: 4px;
          color: #e9dfcd;
          cursor: pointer;
          flex-shrink: 0;
        }

        .field-list-row button:hover:not(:disabled) {
          background: rgba(151, 126, 96, 0.5);
          border-color: #c7ab76;
        }

        .field-list-row button:disabled {
          opacity: 0.3;
          cursor: not-allowed;
        }

        .field-remove-btn {
          background: rgba(139, 0, 0, 0.25) !important;
          border-color: #8b0000 !important;
          color: #ff6b6b !important;
        }

        .field-remove-btn:hover {
          background: rgba(139, 0, 0, 0.5) !important;
        }

        .field-tab-input {
          width: 130px !important;
          flex: none !important;
        }

        .field-list-tab-input {
          width: 100px;
          padding: 0.35rem 0.5rem;
          background: rgba(0, 0, 0, 0.3);
          border: 1px solid rgba(199, 171, 118, 0.25);
          border-radius: 4px;
          color: #b9b09f;
          font-size: 0.75rem;
          flex-shrink: 0;
        }

        .field-list-tab-input:focus {
          outline: none;
          border-color: #c7ab76;
          color: #e9dfcd;
        }

        .sheet-subtab-nav {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
          margin-bottom: 1.25rem;
          padding-bottom: 0.75rem;
          border-bottom: 2px solid rgba(199, 171, 118, 0.25);
        }

        .sheet-subtab-btn {
          padding: 0.5rem 1.1rem;
          background: rgba(151, 126, 96, 0.2);
          border: 2px solid rgba(199, 171, 118, 0.3);
          border-radius: 20px;
          color: #b9b09f;
          font-family: 'Cinzel', serif;
          font-size: 0.82rem;
          cursor: pointer;
          transition: background-color 0.25s ease;
        }

        .sheet-subtab-btn:hover {
          background: rgba(151, 126, 96, 0.4);
          color: #e9dfcd;
        }

        .sheet-subtab-btn.active {
          background: linear-gradient(135deg, #c7ab76 0%, #b98867 100%);
          border-color: #c7ab76;
          color: #191c1a;
          font-weight: 700;
        }

        .sheet-fields-area {
          min-height: 200px;
        }

        .sheet-fields-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
          gap: 1.25rem;
        }

        .sheet-field {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          padding: 1rem;
          background: rgba(0, 0, 0, 0.25);
          border: 1px solid rgba(151, 126, 96, 0.5);
          border-radius: 10px;
          /* Light animation on attribute borders — subtle golden pulse */
          animation: borderGlow 3s ease-in-out infinite;
        }

        @keyframes borderGlow {
          0%, 100% {
            border-color: rgba(151, 126, 96, 0.5);
            box-shadow: 0 0 0px rgba(199, 171, 118, 0);
          }
          50% {
            border-color: rgba(199, 171, 118, 0.7);
            box-shadow: 0 0 8px rgba(199, 171, 118, 0.15);
          }
        }

        .sheet-field-textarea,
        .sheet-field-image,
        .sheet-field-list,
        .sheet-field-attack,
        .sheet-field-checklist {
          grid-column: span 2;
        }

        .sheet-field label {
          color: #c7ab76;
          font-size: 1rem;
          letter-spacing: 0.5px;
        }

        .sheet-field-label-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .sheet-field-remove-mini {
          width: 20px;
          height: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(139, 0, 0, 0.25);
          border: 1px solid #8b0000;
          border-radius: 4px;
          color: #ff6b6b;
          cursor: pointer;
          flex-shrink: 0;
        }

        .sheet-field-remove-mini:hover {
          background: rgba(139, 0, 0, 0.5);
        }

        .extra-field-builder {
          grid-column: 1 / -1;
          margin-top: 1.5rem;
          padding-top: 1.25rem;
          border-top: 1px dashed rgba(199, 171, 118, 0.3);
        }

        .sheet-field input[type="text"],
        .sheet-field input[type="number"],
        .sheet-field textarea {
          padding: 0.6rem 0.75rem;
          background: rgba(0, 0, 0, 0.35);
          border: 2px solid rgba(199, 171, 118, 0.3);
          border-radius: 6px;
          color: #ece6f7;
          font-size: 0.95rem;
          font-family: 'Crimson Pro', serif;
          resize: vertical;
        }

        .sheet-field input:focus,
        .sheet-field textarea:focus {
          outline: none;
          border-color: #c7ab76;
        }

        .sheet-field-image {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.75rem;
        }

        .sheet-field-image img {
          width: 100%;
          max-width: 240px;
          aspect-ratio: 1;
          object-fit: cover;
          border-radius: 8px;
          border: 2px solid #c7ab76;
        }

        .sheet-field-image-placeholder {
          width: 100%;
          max-width: 240px;
          aspect-ratio: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(0, 0, 0, 0.3);
          border: 2px dashed rgba(199, 171, 118, 0.4);
          border-radius: 8px;
          color: #a39988;
        }

        .sheet-image-upload-btn {
          font-size: 0.8rem;
          padding: 0.5rem 1rem;
        }

        .sheet-field-list {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .sheet-list-item {
          display: flex;
          gap: 0.5rem;
        }

        .sheet-list-item input {
          flex: 1;
          padding: 0.5rem 0.7rem;
          background: rgba(0, 0, 0, 0.35);
          border: 2px solid rgba(199, 171, 118, 0.3);
          border-radius: 6px;
          color: #ece6f7;
          font-family: 'Crimson Pro', serif;
        }

        .sheet-list-item input:focus {
          outline: none;
          border-color: #c7ab76;
        }

        .sheet-list-item button {
          width: 34px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(139, 0, 0, 0.25);
          border: 1px solid #8b0000;
          border-radius: 6px;
          color: #ff6b6b;
          cursor: pointer;
        }

        .sheet-list-add-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.4rem;
          padding: 0.5rem;
          background: rgba(151, 126, 96, 0.2);
          border: 1px dashed rgba(199, 171, 118, 0.4);
          border-radius: 6px;
          color: #c7ab76;
          font-size: 0.8rem;
          cursor: pointer;
        }

        .sheet-list-add-btn:hover {
          background: rgba(151, 126, 96, 0.4);
        }

        .formula-input {
          min-width: 180px;
        }

        .sheet-field-formula {
          display: flex;
          align-items: baseline;
          gap: 0.6rem;
          padding: 0.6rem 0.75rem;
          background: rgba(0, 0, 0, 0.35);
          border: 2px solid rgba(199, 171, 118, 0.3);
          border-radius: 6px;
        }

        .formula-result {
          font-family: 'Cinzel', serif;
          font-size: 1.3rem;
          font-weight: 700;
          color: #c7ab76;
        }

        .formula-expr {
          font-size: 0.75rem;
          color: #a39988;
          font-family: 'Crimson Pro', serif;
        }

        .sheet-field-attack {
          display: flex;
          flex-direction: column;
          gap: 0.6rem;
        }

        .attack-inputs-row {
          display: flex;
          gap: 1rem;
        }

        .attack-mini-label {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
          font-size: 0.72rem;
          color: #b9b09f;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .attack-mini-label input {
          padding: 0.45rem 0.6rem;
          background: rgba(0, 0, 0, 0.35);
          border: 2px solid rgba(199, 171, 118, 0.3);
          border-radius: 6px;
          color: #ece6f7;
          font-family: 'Crimson Pro', serif;
          width: 90px;
        }

        .attack-roll-row {
          display: flex;
          gap: 0.6rem;
        }

        .attack-roll-btn {
          display: flex;
          align-items: center;
          gap: 0.4rem;
          padding: 0.45rem 0.8rem;
          background: linear-gradient(135deg, #c7ab76 0%, #b98867 100%);
          border: none;
          border-radius: 6px;
          color: #191c1a;
          font-weight: 700;
          font-size: 0.78rem;
          cursor: pointer;
        }

        .attack-roll-btn:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        .attack-dice-row {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
        }

        .attack-result-row {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
          font-size: 0.8rem;
          color: #e9dfcd;
          padding-top: 0.4rem;
          border-top: 1px dashed rgba(199, 171, 118, 0.25);
        }

        .attack-result-row strong {
          color: #c7ab76;
        }

        .sheet-field-checklist {
          display: flex;
          flex-direction: column;
          gap: 0.4rem;
        }

        .checklist-item-row {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .checklist-item-row input[type="checkbox"] {
          width: 18px;
          height: 18px;
          accent-color: #c7ab76;
          flex-shrink: 0;
        }

        .checklist-item-row input[type="text"] {
          flex: 1;
          padding: 0.45rem 0.65rem;
          background: rgba(0, 0, 0, 0.35);
          border: 2px solid rgba(199, 171, 118, 0.3);
          border-radius: 6px;
          color: #ece6f7;
          font-family: 'Crimson Pro', serif;
        }

        .checklist-text-done {
          text-decoration: line-through;
          opacity: 0.55;
        }

        .checklist-item-row button {
          width: 30px;
          height: 30px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(139, 0, 0, 0.25);
          border: 1px solid #8b0000;
          border-radius: 6px;
          color: #ff6b6b;
          cursor: pointer;
          flex-shrink: 0;
        }

        .dice-roller h3 {
          font-family: 'Cinzel', serif;
          font-size: 1.1rem;
          color: #c7ab76;
          margin-bottom: 1rem;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          text-transform: uppercase;
          letter-spacing: 1px;
        }

        .pouch-btn {
          margin-left: auto;
          width: 30px;
          height: 30px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(151, 126, 96, 0.25);
          border: 2px solid rgba(199, 171, 118, 0.4);
          border-radius: 8px;
          color: #c7ab76;
          cursor: pointer;
          transition: background-color 0.25s ease;
        }

        .pouch-btn:hover {
          background: rgba(151, 126, 96, 0.5);
          border-color: #c7ab76;
          transform: scale(1.05);
        }

        .pouch-panel {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 0.5rem;
          margin-bottom: 1rem;
          padding: 0.75rem;
          background: rgba(0, 0, 0, 0.3);
          border: 1px solid rgba(199, 171, 118, 0.3);
          border-radius: 10px;
        }

        .pouch-skin-btn {
          position: relative;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.3rem;
          padding: 0.4rem;
          background: transparent;
          border: 2px solid transparent;
          border-radius: 8px;
          cursor: pointer;
          transition: background-color 0.2s ease;
        }

        .pouch-skin-btn:hover:not(:disabled) {
          background: rgba(151, 126, 96, 0.25);
        }

        .pouch-skin-btn.active {
          border-color: #c7ab76;
          background: rgba(199, 171, 118, 0.15);
        }

        .pouch-skin-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .pouch-skin-btn img {
          width: 44px;
          height: 44px;
          object-fit: cover;
          border-radius: 6px;
          border: 1px solid rgba(199, 171, 118, 0.4);
        }

        .pouch-skin-btn span {
          font-size: 0.68rem;
          color: #b3a8d6;
          text-align: center;
        }

        .pouch-check {
          position: absolute;
          top: 2px;
          right: 2px;
          background: #c7ab76;
          color: #191c1a;
          border-radius: 50%;
          padding: 1px;
        }

        .dice-formula-bar {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
          margin-bottom: 0.75rem;
          min-height: 2.2rem;
        }

        .dice-formula-empty {
          font-size: 0.85rem;
          color: #a39988;
          font-style: italic;
        }

        .dice-term-chip {
          display: flex;
          align-items: center;
          gap: 0.35rem;
          padding: 0.3rem 0.4rem;
          background: rgba(151, 126, 96, 0.25);
          border: 1px solid rgba(199, 171, 118, 0.4);
          border-radius: 20px;
        }

        .term-sign {
          color: #c7ab76;
          font-weight: 700;
          font-size: 0.9rem;
          padding-left: 0.15rem;
        }

        .dice-term-chip button {
          width: 20px;
          height: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(0, 0, 0, 0.3);
          border: 1px solid #51493e;
          border-radius: 50%;
          color: #e9dfcd;
          font-weight: 700;
          font-size: 0.8rem;
          line-height: 1;
          cursor: pointer;
          padding: 0;
        }

        .dice-term-chip button:hover:not(:disabled) {
          background: rgba(151, 126, 96, 0.5);
          border-color: #c7ab76;
        }

        .dice-term-chip button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .term-label {
          font-family: 'Cinzel', serif;
          font-size: 0.85rem;
          font-weight: 600;
          color: #e9dfcd;
          min-width: 2.4rem;
          text-align: center;
        }

        .term-remove {
          background: rgba(139, 0, 0, 0.3) !important;
          border-color: #8b0000 !important;
          color: #ff6b6b !important;
        }

        .term-remove:hover:not(:disabled) {
          background: rgba(139, 0, 0, 0.6) !important;
        }

        .dice-op-toggle {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin-bottom: 0.75rem;
          font-size: 0.8rem;
          color: #b9b09f;
        }

        .dice-op-toggle button {
          width: 28px;
          height: 28px;
          background: rgba(151, 126, 96, 0.2);
          border: 2px solid rgba(199, 171, 118, 0.3);
          border-radius: 6px;
          color: #e9dfcd;
          font-weight: 700;
          cursor: pointer;
          transition: background-color 0.25s ease;
        }

        .dice-op-toggle button:hover:not(:disabled) {
          background: rgba(151, 126, 96, 0.4);
          border-color: #c7ab76;
        }

        .dice-op-toggle button.active {
          background: linear-gradient(135deg, #c7ab76 0%, #b98867 100%);
          border-color: #c7ab76;
          color: #191c1a;
        }

        .dice-type-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 0.5rem;
          margin-bottom: 1rem;
        }

        .dice-type-btn {
          padding: 0.5rem 0.25rem;
          background: rgba(151, 126, 96, 0.2);
          border: 2px solid rgba(199, 171, 118, 0.3);
          border-radius: 6px;
          color: #e9dfcd;
          font-family: 'Cinzel', serif;
          font-weight: 600;
          font-size: 0.85rem;
          cursor: pointer;
          transition: background-color 0.25s ease;
        }

        .dice-type-btn:hover:not(:disabled) {
          background: rgba(151, 126, 96, 0.4);
          border-color: #c7ab76;
        }

        .dice-type-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .dice-display-area {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.6rem;
          margin-bottom: 1.25rem;
        }

        .dice-multi-row {
          display: flex;
          flex-wrap: wrap;
          justify-content: center;
          align-items: flex-start;
          gap: 0.6rem;
        }

        .dice-face-3d {
          position: relative;
          width: 150px;
          height: 150px;
          background: linear-gradient(135deg, #222321 0%, #191c1a 100%);
          border: 3px solid #c7ab76;
          border-radius: 16px;
          box-shadow: 0 6px 20px rgba(0, 0, 0, 0.6), inset 0 0 24px rgba(199, 171, 118, 0.12);
          overflow: hidden;
        }

        .dice-face-3d-empty {
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .dice-face-3d-empty .dice-face-label {
          position: static;
          transform: none;
        }

        .dice-face-3d-mini {
          width: 84px;
          height: 84px;
          border-width: 2px;
          border-radius: 12px;
          flex-shrink: 0;
        }

        .dice-mini-sign {
          position: absolute;
          top: -2px;
          left: -8px;
          z-index: 2;
          width: 20px;
          height: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #c7ab76;
          color: #191c1a;
          border-radius: 50%;
          font-weight: 700;
          font-size: 0.75rem;
        }

        .dice-3d-canvas {
          width: 100%;
          height: 100%;
        }

        .dice-3d-canvas canvas {
          display: block;
          width: 100% !important;
          height: 100% !important;
        }

        .dice-face-label {
          position: absolute;
          top: 8px;
          left: 50%;
          transform: translateX(-50%);
          font-family: 'Cinzel', serif;
          font-size: 0.75rem;
          color: #b9b09f;
          text-transform: uppercase;
          letter-spacing: 1px;
          text-shadow: 0 1px 3px rgba(0, 0, 0, 0.9);
          pointer-events: none;
        }

        .dice-face-3d-mini .dice-face-label {
          top: 4px;
          font-size: 0.55rem;
        }

        .dice-face-value {
          position: absolute;
          bottom: 8px;
          left: 50%;
          transform: translateX(-50%);
          font-family: 'Cinzel', serif;
          font-size: 1.4rem;
          font-weight: 700;
          color: #c7ab76;
          text-shadow: 2px 2px 6px rgba(0, 0, 0, 0.9);
          background: rgba(0, 0, 0, 0.4);
          padding: 0.1rem 0.7rem;
          border-radius: 6px;
          pointer-events: none;
          transition: color 0.1s ease;
        }

        .dice-face-value-mini {
          bottom: 3px;
          font-size: 0.75rem;
          padding: 0.05rem 0.4rem;
        }

        .dice-total-line {
          font-family: 'Cinzel', serif;
          font-size: 1rem;
          color: #b9b09f;
        }

        .dice-total-line strong {
          color: #c7ab76;
          font-size: 1.2rem;
        }

        .dice-face-value.flicker {
          color: #ff9d2e;
        }

        .dice-breakdown {
          display: flex;
          flex-wrap: wrap;
          justify-content: center;
          gap: 0.4rem;
          font-size: 0.8rem;
          color: #b9b09f;
          text-align: center;
        }

        .dice-breakdown-part {
          display: inline-flex;
          align-items: center;
          gap: 0.3rem;
        }

        .breakdown-sign {
          color: #c7ab76;
          font-weight: 700;
        }

        .roll-btn {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          padding: 0.85rem;
          background: linear-gradient(135deg, #c7ab76 0%, #b98867 100%);
          border: 2px solid #c7ab76;
          border-radius: 8px;
          color: #191c1a;
          font-family: 'Cinzel', serif;
          font-weight: 700;
          font-size: 1rem;
          letter-spacing: 0.5px;
          cursor: pointer;
          transition: background-color 0.3s ease;
        }

        .roll-btn:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 4px 16px rgba(199, 171, 118, 0.5);
        }

        .roll-btn:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }

        .roll-btn .spin {
          animation: spin 0.6s linear infinite;
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        .dice-history {
          margin-top: 1.5rem;
          padding-top: 1rem;
          border-top: 1px solid rgba(151, 126, 96, 0.3);
        }

        .dice-history h4 {
          font-family: 'Cinzel', serif;
          font-size: 0.85rem;
          color: #b9b09f;
          text-transform: uppercase;
          letter-spacing: 1px;
          margin-bottom: 0.6rem;
        }

        .dice-history-item {
          display: flex;
          justify-content: space-between;
          font-size: 0.85rem;
          color: #e9dfcd;
          padding: 0.4rem 0;
          border-bottom: 1px dashed rgba(151, 126, 96, 0.3);
        }

        .dice-history-item strong {
          color: #c7ab76;
        }

        .main-content {
          display: flex;
          height: calc(100vh - 80px);
          position: relative;
          z-index: 1;
        }

        .sidebar {
          width: 320px;
          background: linear-gradient(180deg, rgba(25, 28, 26, 0.95) 0%, rgba(20, 23, 21, 0.95) 100%);
          border-right: 3px solid #51493e;
          padding: 1.5rem;
          overflow-y: auto;
          box-shadow: 4px 0 20px rgba(0, 0, 0, 0.5);
        }

        .sidebar-section {
          margin-bottom: 2rem;
          padding-bottom: 1.5rem;
          border-bottom: 1px solid rgba(151, 126, 96, 0.3);
        }

        .sidebar-section:last-child {
          border-bottom: none;
        }

        .sidebar-section h3 {
          font-family: 'Cinzel', serif;
          font-size: 1.1rem;
          color: #c7ab76;
          margin-bottom: 1rem;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          text-transform: uppercase;
          letter-spacing: 1px;
        }

        .upload-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0.75rem;
          background: linear-gradient(135deg, #51493e 0%, #2e2354 100%);
          border: 2px solid #c7ab76;
          border-radius: 8px;
          color: #e9dfcd;
          font-weight: 600;
          cursor: pointer;
          transition: background-color 0.3s ease;
          text-align: center;
        }

        .upload-btn:hover {
          background: linear-gradient(135deg, #6654a0 0%, #51493e 100%);
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(199, 171, 118, 0.4);
        }

        .upload-btn input {
          display: none;
        }

        .points-list {
          max-height: 400px;
          overflow-y: auto;
        }

        .point-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0.75rem;
          margin-bottom: 0.5rem;
          background: rgba(151, 126, 96, 0.2);
          border: 1px solid rgba(199, 171, 118, 0.3);
          border-radius: 6px;
          transition: background-color 0.3s ease;
        }

        .point-item:hover {
          background: rgba(151, 126, 96, 0.4);
          border-color: #c7ab76;
          transform: translateX(4px);
        }

        .point-info {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          cursor: pointer;
          flex: 1;
        }

        .point-info div {
          display: flex;
          flex-direction: column;
        }

        .point-info strong {
          font-size: 0.95rem;
          color: #e9dfcd;
        }

        .point-info small {
          font-size: 0.8rem;
          color: #b9b09f;
          text-transform: capitalize;
        }

        .delete-btn {
          background: rgba(139, 0, 0, 0.3);
          border: 1px solid #8b0000;
          border-radius: 4px;
          padding: 0.4rem;
          color: #ff6b6b;
          cursor: pointer;
          transition: background-color 0.2s ease;
        }

        .delete-btn:hover {
          background: rgba(139, 0, 0, 0.6);
          transform: scale(1.1);
        }

        .controls-info {
          background: rgba(0, 0, 0, 0.3);
          padding: 1rem;
          border-radius: 6px;
          border: 1px solid rgba(199, 171, 118, 0.2);
        }

        .controls-info p {
          margin-bottom: 0.5rem;
          font-size: 0.9rem;
        }

        .zoom-indicator {
          margin-top: 1rem;
          text-align: center;
          font-size: 1.1rem;
          font-weight: 600;
          color: #c7ab76;
          padding: 0.5rem;
          background: rgba(199, 171, 118, 0.1);
          border-radius: 4px;
        }

        .canvas-area {
          flex: 1;
          position: relative;
          overflow: hidden;
          background: radial-gradient(circle at center, #191c1a 0%, #121413 100%);
        }

        .empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100%;
          gap: 1rem;
          color: #a39988;
        }

        .empty-state svg {
          opacity: 0.3;
        }

        .empty-state h2 {
          font-family: 'Cinzel', serif;
          font-size: 1.8rem;
          color: #b9b09f;
        }

        .canvas-wrapper {
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
        }

        .map-canvas {
          transform-origin: center;
          transition: transform 0.1s ease-out;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.8);
          border: 4px solid #51493e;
          border-radius: 4px;
        }

        .map-canvas:focus-visible {
          outline: 3px solid #e2c786;
          outline-offset: 5px;
        }

        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.85);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          animation: fadeIn 0.3s ease;
        }

        dialog.modal-overlay,
        dialog.scene-overlay {
          width: 100vw;
          height: 100dvh;
          max-width: none;
          max-height: none;
          margin: 0;
          padding: 0;
          border: 0;
          color: inherit;
          overscroll-behavior: contain;
        }

        dialog.modal-overlay::backdrop,
        dialog.scene-overlay::backdrop {
          background: rgba(0, 0, 0, 0.85);
        }

        @media (prefers-reduced-motion: reduce) {
          .modal-overlay, .modal, .scene-overlay { animation: none; }
          .map-canvas { transition: none; }
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        .modal {
          background: linear-gradient(180deg, #191c1a 0%, #141715 100%);
          border: 3px solid #c7ab76;
          border-radius: 12px;
          width: 90%;
          max-width: 500px;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.9);
          animation: slideUp 0.3s ease;
        }

        @keyframes slideUp {
          from { 
            transform: translateY(50px);
            opacity: 0;
          }
          to { 
            transform: translateY(0);
            opacity: 1;
          }
        }

        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1.5rem;
          border-bottom: 2px solid #51493e;
        }

        .modal-header h2 {
          font-family: 'Cinzel', serif;
          font-size: 1.5rem;
          color: #c7ab76;
        }

        .modal-header button {
          background: transparent;
          border: none;
          color: #e9dfcd;
          cursor: pointer;
          transition: background-color 0.2s ease;
        }

        .modal-header button:hover {
          color: #c7ab76;
          transform: rotate(90deg);
        }

        .modal-body {
          padding: 1.5rem;
        }

        .form-group {
          margin-bottom: 1.5rem;
        }

        .form-group label {
          display: block;
          margin-bottom: 0.5rem;
          font-weight: 600;
          color: #c7ab76;
          font-family: 'Cinzel', serif;
          font-size: 0.9rem;
          text-transform: uppercase;
          letter-spacing: 1px;
        }

        .form-group input,
        .form-group textarea {
          width: 100%;
          padding: 0.75rem;
          background: rgba(151, 126, 96, 0.2);
          border: 2px solid rgba(199, 171, 118, 0.3);
          border-radius: 6px;
          color: #e9dfcd;
          font-family: 'Crimson Pro', serif;
          font-size: 1rem;
          transition: background-color 0.3s ease;
        }

        .form-group input:focus,
        .form-group textarea:focus {
          outline: none;
          border-color: #c7ab76;
          background: rgba(151, 126, 96, 0.3);
          box-shadow: 0 0 0 3px rgba(199, 171, 118, 0.1);
        }

        .type-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 0.75rem;
        }

        .type-btn {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.75rem;
          background: rgba(151, 126, 96, 0.2);
          border: 2px solid rgba(199, 171, 118, 0.3);
          border-radius: 6px;
          color: #e9dfcd;
          font-family: 'Crimson Pro', serif;
          font-weight: 600;
          cursor: pointer;
          transition: background-color 0.3s ease;
        }

        .type-btn:hover {
          background: rgba(151, 126, 96, 0.4);
          border-color: var(--type-color);
          transform: translateY(-2px);
        }

        .type-btn.active {
          background: var(--type-color);
          border-color: var(--type-color);
          color: #fff;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
        }

        .modal-footer {
          display: flex;
          justify-content: flex-end;
          gap: 1rem;
          padding: 1.5rem;
          border-top: 2px solid #51493e;
        }

        .modal-error {
          margin: 0 1.5rem;
          color: #ffd0c6;
          font-size: 0.95rem;
          line-height: 1.4;
        }

        .btn-secondary,
        .btn-primary {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.75rem 1.5rem;
          border-radius: 6px;
          font-family: 'Crimson Pro', serif;
          font-weight: 600;
          cursor: pointer;
          transition: background-color 0.3s ease;
        }

        .btn-secondary {
          background: rgba(151, 126, 96, 0.3);
          border: 2px solid #51493e;
          color: #e9dfcd;
        }

        .btn-secondary:hover {
          background: rgba(151, 126, 96, 0.5);
          transform: translateY(-2px);
        }

        .btn-primary {
          background: linear-gradient(135deg, #c7ab76 0%, #b98867 100%);
          border: 2px solid #c7ab76;
          color: #191c1a;
        }

        .btn-primary:hover {
          background: linear-gradient(135deg, #e0bf47 0%, #c7ab76 100%);
          transform: translateY(-2px);
          box-shadow: 0 4px 16px rgba(199, 171, 118, 0.5);
        }

        .scene-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.9);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 2000;
          animation: fadeIn 0.3s ease;
        }

        .scene-container {
          width: 90%;
          height: 90%;
          max-width: 1200px;
          background: linear-gradient(180deg, #191c1a 0%, #141715 100%);
          border: 4px solid #c7ab76;
          border-radius: 12px;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          box-shadow: 0 20px 80px rgba(0, 0, 0, 0.9);
        }

        .scene-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1.5rem;
          background: rgba(25, 28, 26, 0.8);
          border-bottom: 2px solid #51493e;
        }

        .scene-header h2 {
          font-family: 'Cinzel', serif;
          font-size: 1.8rem;
          color: #c7ab76;
          margin-bottom: 0.5rem;
        }

        .scene-header p {
          color: #b9b09f;
          font-size: 1rem;
        }

        .close-btn {
          background: rgba(139, 0, 0, 0.3);
          border: 2px solid #8b0000;
          border-radius: 6px;
          padding: 0.5rem;
          color: #ff6b6b;
          cursor: pointer;
          transition: background-color 0.3s ease;
        }

        .close-btn:hover {
          background: rgba(139, 0, 0, 0.6);
          transform: rotate(90deg);
        }

        .scene-canvas {
          flex: 1;
          background: radial-gradient(circle at center, #121413 0%, #000 100%);
        }

        .scene-footer {
          padding: 1rem 1.5rem;
          background: rgba(25, 28, 26, 0.8);
          border-top: 2px solid #51493e;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .scene-type {
          display: inline-block;
          padding: 0.5rem 1rem;
          background: rgba(199, 171, 118, 0.2);
          border: 1px solid #c7ab76;
          border-radius: 20px;
          color: #c7ab76;
          font-weight: 600;
          text-transform: uppercase;
          font-size: 0.9rem;
          letter-spacing: 1px;
        }

        ::-webkit-scrollbar {
          width: 8px;
        }

        ::-webkit-scrollbar-track {
          background: rgba(25, 28, 26, 0.3);
        }

        ::-webkit-scrollbar-thumb {
          background: #51493e;
          border-radius: 4px;
        }

        ::-webkit-scrollbar-thumb:hover {
          background: #c7ab76;
        }
      `}</style>
    </div>
  );
};

export default RPGMapExplorer;
