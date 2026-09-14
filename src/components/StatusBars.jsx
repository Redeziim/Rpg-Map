import React, { useState } from 'react';
import { Camera, Heart, Image as ImageIcon, Minus, Plus, Trash2, GripVertical, Type, ListPlus } from 'lucide-react';

const StatusBars = ({ viewMode, playerName, onPlayerNameChange, allPlayersBars, onUpdatePlayerBars, onUpdatePlayerAvatar, selectedPlayer }) => {
  const [nameDraft, setNameDraft] = useState(playerName || '');
  const [newLabel, setNewLabel] = useState('');
  const [newColor, setNewColor] = useState('#c0392b');
  const [newMax, setNewMax] = useState(100);
  const masterSelectedPlayer = selectedPlayer;

  const isMaster = viewMode === 'master';
  const playerNames = Object.keys(allPlayersBars || {});
  const activePlayer = isMaster ? masterSelectedPlayer : playerName;
  const activeEntry = (allPlayersBars && allPlayersBars[activePlayer]) || { avatar: null, bars: [] };
  const activeBars = activeEntry.bars || [];

  const confirmName = () => {
    const trimmed = nameDraft.trim();
    if (trimmed) onPlayerNameChange(trimmed);
  };

  const addBar = () => {
    if(isMaster) return;
    const label = newLabel.trim();
    if (!label || !activePlayer) return;
    const bar = { id: `bar_${Date.now()}`, label, color: newColor, max: Number(newMax) || 100, current: Number(newMax) || 100 };
    onUpdatePlayerBars(activePlayer, [...activeBars, bar]);
    setNewLabel('');
    setNewMax(100);
  };

  const removeBar = (barId) => {
    if (isMaster) return;
    onUpdatePlayerBars(activePlayer, activeBars.filter(b => b.id !== barId));
  };

  const setBarValue = (barId, value) => {
    if (isMaster) return;
    const clamped = Math.max(0, Math.min(value, activeBars.find(b => b.id === barId)?.max ?? value));
    onUpdatePlayerBars(activePlayer, activeBars.map(b => b.id === barId ? { ...b, current: clamped } : b));
  };

  const handleAvatarUpload = (e) => {
    if (isMaster) return;
    const file = e.target.files[0];
    if (!file || !activePlayer) return;
    const reader = new FileReader();
    reader.onload = (ev) => onUpdatePlayerAvatar(activePlayer, ev.target.result);
    reader.readAsDataURL(file);
  };

  const adjustBar = (barId, delta) => {
    const bar = activeBars.find(b => b.id === barId);
    if (!bar) return;
    setBarValue(barId, bar.current + delta);
  };

  // Modo Jogador sem nome definido ainda: pede o nome antes de tudo
  if (!isMaster && !playerName) {
    return (
      <div className="status-bars-panel">
        <h3><Heart size={17} /> Personagem</h3>
        <p className="status-bars-hint">Seu nome identifica a ficha nesta mesa. Os campos são preparados pelo mestre.</p>
        <div className="status-name-row">
          <input
            type="text"
            aria-label="Seu nome de jogador"
            autoComplete="nickname"
            placeholder="Seu nome de jogador…"
            value={nameDraft}
            onChange={e => setNameDraft(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && confirmName()}
          />
          <button className="sheet-tool-btn" onClick={confirmName} disabled={!nameDraft.trim()}>Confirmar</button>
        </div>
      </div>
    );
  }

  return (
    <div className="status-bars-panel">
      <h3><Heart size={17} /> Personagem</h3>

      {activePlayer && (
        <div className="status-player-header">
          <div className="status-avatar-wrap">
            {activeEntry.avatar ? (
              <img src={activeEntry.avatar} alt={activePlayer} className="status-avatar-img" />
            ) : (
              <div className="status-avatar-placeholder"><ImageIcon size={20} /></div>
            )}
            {!isMaster && <label className="status-avatar-upload-btn" title="Foto do personagem">
              <input type="file" accept="image/*" onChange={handleAvatarUpload} />
              <Camera size={13} />
            </label>}
          </div>
          <p className="status-bars-hint"><span className="eyebrow">{isMaster ? 'Personagem em consulta' : 'Jogando como'}</span><strong>{activePlayer}</strong></p>
        </div>
      )}

      {isMaster && !masterSelectedPlayer && (
        <p className="status-bars-hint">
          {playerNames.length === 0
            ? 'Nenhum jogador criou barras de status ainda.'
            : 'Escolha um jogador acima para consultar seus recursos.'}
        </p>
      )}

      {activePlayer && (
        <>
          <div className="status-bar-list">
            {activeBars.map(bar => (
              <div key={bar.id} className="status-bar-row">
                <div className="status-bar-top">
                  <span className="status-bar-label">{bar.label}</span>
                  <span className="status-bar-numbers">{bar.current} / {bar.max}</span>
                </div>
                <div className="status-bar-track">
                  <div
                    className="status-bar-fill legacy-resource"
                    style={{ width: `${Math.min(100, (bar.current / bar.max) * 100)}%`, background: bar.color }}
                  />
                </div>
                {!isMaster && <div className="status-bar-controls">
                  <button onClick={() => adjustBar(bar.id, -1)}><Minus size={13} /></button>
                  <input
                    type="number"
                    value={bar.current}
                    onChange={e => setBarValue(bar.id, Number(e.target.value))}
                  />
                  <button onClick={() => adjustBar(bar.id, 1)}><Plus size={13} /></button>
                  <button onClick={() => adjustBar(bar.id, -5)} className="status-bar-quick">-5</button>
                  <button onClick={() => adjustBar(bar.id, 5)} className="status-bar-quick">+5</button>
                  <button onClick={() => removeBar(bar.id)} className="status-bar-remove"><Trash2 size={13} /></button>
                </div>}
              </div>
            ))}
          </div>


        </>
      )}
    </div>
  );
};

export default StatusBars;

