import React, { useState } from 'react';
import { Camera, Heart, Image as ImageIcon, Minus, Plus, Trash2, GripVertical, Type, ListPlus } from 'lucide-react';

const StatusBars = ({ viewMode, playerName, onPlayerNameChange, allPlayersBars, onUpdatePlayerBars, onUpdatePlayerAvatar }) => {
  const [nameDraft, setNameDraft] = useState(playerName || '');
  const [newLabel, setNewLabel] = useState('');
  const [newColor, setNewColor] = useState('#c0392b');
  const [newMax, setNewMax] = useState(100);
  const [masterSelectedPlayer, setMasterSelectedPlayer] = useState('');

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
    const label = newLabel.trim();
    if (!label || !activePlayer) return;
    const bar = { id: `bar_${Date.now()}`, label, color: newColor, max: Number(newMax) || 100, current: Number(newMax) || 100 };
    onUpdatePlayerBars(activePlayer, [...activeBars, bar]);
    setNewLabel('');
    setNewMax(100);
  };

  const removeBar = (barId) => {
    onUpdatePlayerBars(activePlayer, activeBars.filter(b => b.id !== barId));
  };

  const setBarValue = (barId, value) => {
    const clamped = Math.max(0, Math.min(value, activeBars.find(b => b.id === barId)?.max ?? value));
    onUpdatePlayerBars(activePlayer, activeBars.map(b => b.id === barId ? { ...b, current: clamped } : b));
  };

  const handleAvatarUpload = (e) => {
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
        <h3><Heart size={17} /> Barras de Status</h3>
        <p className="status-bars-hint">Defina seu nome de jogador para criar suas barras (vida, sanidade, etc).</p>
        <div className="status-name-row">
          <input
            type="text"
            placeholder="Seu nome de jogador"
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
      <h3><Heart size={17} /> Barras de Status</h3>

      {isMaster && (
        <div className="status-master-select-row">
          <span>Ver/editar barras de:</span>
          <select value={masterSelectedPlayer} onChange={e => setMasterSelectedPlayer(e.target.value)}>
            <option value="">Selecione um jogador...</option>
            {playerNames.map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
      )}

      {!isMaster && (
        <div className="status-player-header">
          <div className="status-avatar-wrap">
            {activeEntry.avatar ? (
              <img src={activeEntry.avatar} alt={playerName} className="status-avatar-img" />
            ) : (
              <div className="status-avatar-placeholder"><ImageIcon size={20} /></div>
            )}
            <label className="status-avatar-upload-btn" title="Foto do personagem">
              <input type="file" accept="image/*" onChange={handleAvatarUpload} />
              <Camera size={13} />
            </label>
          </div>
          <p className="status-bars-hint">Jogando como <strong>{playerName}</strong></p>
        </div>
      )}

      {isMaster && !masterSelectedPlayer && (
        <p className="status-bars-hint">
          {playerNames.length === 0
            ? 'Nenhum jogador criou barras de status ainda.'
            : 'Escolha um jogador acima para visualizar e ajustar suas barras.'}
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
                    className="status-bar-fill"
                    style={{ width: `${Math.min(100, (bar.current / bar.max) * 100)}%`, background: bar.color }}
                  />
                </div>
                <div className="status-bar-controls">
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
                </div>
              </div>
            ))}
          </div>

          {!isMaster && (
            <div className="status-bar-add-row">
              <input
                type="text"
                placeholder="Nome (ex: Vida, Sanidade)"
                value={newLabel}
                onChange={e => setNewLabel(e.target.value)}
              />
              <input
                type="color"
                value={newColor}
                onChange={e => setNewColor(e.target.value)}
                title="Cor da barra"
              />
              <input
                type="number"
                placeholder="Máx"
                value={newMax}
                onChange={e => setNewMax(e.target.value)}
                className="status-bar-max-input"
              />
              <button className="field-add-btn" onClick={addBar} disabled={!newLabel.trim()}>
                <Plus size={14} />
                Adicionar barra
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default StatusBars;

