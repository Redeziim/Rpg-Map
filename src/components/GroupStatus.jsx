import React, { useState, useEffect, useRef } from 'react';
import { Users, Eye, Edit3, Plus, X, ImageIcon, Minus } from 'lucide-react';

const GroupStatus = ({ viewMode, allPlayersBars, onUpdatePlayerBars, onOpenSheet, activePlayer }) => {
  const isMaster = viewMode === 'master';
  const playerNames = Object.keys(allPlayersBars || {});

  // Detecta mudanças de valor nas barras (dano/cura) comparando com o snapshot anterior,
  // e dispara uma animação flutuante tipo "-12" / "+8" sobre a barra afetada
  const [effects, setEffects] = useState({}); // { "player::barId": { delta, kind, key } }
  const prevValuesRef = useRef({});
  const initializedRef = useRef(false);

  useEffect(() => {
    const prev = prevValuesRef.current;
    const next = {};
    const newEffects = {};

    playerNames.forEach(name => {
      (allPlayersBars[name]?.bars || []).forEach(bar => {
        const key = `${name}::${bar.id}`;
        next[key] = bar.current;
        if (initializedRef.current && prev[key] !== undefined && prev[key] !== bar.current) {
          const delta = bar.current - prev[key];
          newEffects[key] = { delta, kind: delta > 0 ? 'heal' : 'damage', key: Date.now() + Math.random() };
        }
      });
    });

    if (Object.keys(newEffects).length > 0) {
      setEffects(curr => ({ ...curr, ...newEffects }));
      Object.keys(newEffects).forEach(key => {
        const effectKey = newEffects[key].key;
        setTimeout(() => {
          setEffects(curr => (curr[key]?.key === effectKey ? (({ [key]: _, ...rest }) => rest)(curr) : curr));
        }, 1600);
      });
    }

    prevValuesRef.current = next;
    initializedRef.current = true;
  }, [allPlayersBars]);

  const adjustBar = (targetPlayerName, bar, delta) => {
    const entry = allPlayersBars[targetPlayerName];
    const clamped = Math.max(0, Math.min(bar.current + delta, bar.max));
    const newBars = entry.bars.map(b => b.id === bar.id ? { ...b, current: clamped } : b);
    onUpdatePlayerBars(targetPlayerName, newBars);
  };

  if (playerNames.length === 0) {
    return (
      <div className="group-status-empty empty-state">
        <Users size={64} />
        <h2>Ninguém configurou status ainda</h2>
        <p>Assim que os jogadores criarem suas barras na aba "Ficha de Personagem", eles aparecem aqui.</p>
      </div>
    );
  }

  return (
    <div className="group-status-grid">
      {playerNames.map(name => {
        const entry = allPlayersBars[name] || { avatar: null, bars: [] };
        const cardHasDamage = (entry.bars || []).some(bar => effects[`${name}::${bar.id}`]?.kind === 'damage');
        return (
          <div key={name} className={`group-status-card ${cardHasDamage ? 'card-hit-shake' : ''} ${activePlayer===name?'is-current-turn':''}`}>
            <div className="group-status-card-header">
              {entry.avatar ? (
                <img src={entry.avatar} alt={name} className="group-status-avatar" />
              ) : (
                <div className="group-status-avatar group-status-avatar-placeholder">
                  <ImageIcon size={22} />
                </div>
              )}
              <h3>{name}{activePlayer===name&&<span className="turn-badge">Em turno</span>}</h3>
            </div>

            {isMaster && <button className="sheet-tool-btn" onClick={() => onOpenSheet(name)}><Eye size={15} />Consultar ficha</button>}
            <div className="group-status-bars">
              {entry.bars.length === 0 && (
                <p className="status-bars-hint status-bars-empty">Nenhuma barra de status ainda. Elas aparecem aqui quando forem configuradas na ficha.</p>
              )}
              {entry.bars.map(bar => {
                const effect = effects[`${name}::${bar.id}`];
                return (
                  <div key={bar.id} className="status-bar-row">
                    <div className="status-bar-top">
                      <span className="status-bar-label">{bar.label}</span>
                      <span className="status-bar-numbers">{bar.current} / {bar.max}</span>
                    </div>
                    <div className={`status-bar-track ${effect ? `bar-flash-${effect.kind}` : ''}`}>
                      <div
                        className="status-bar-fill"
                        style={{ width: `${Math.min(100, (bar.max > 0 ? bar.current / bar.max : 0) * 100)}%`, background: bar.color }}
                      />
                      {effect && (
                        <span key={effect.key} className={`bar-float-text bar-float-${effect.kind}`}>
                          {effect.delta > 0 ? `+${effect.delta}` : effect.delta}
                        </span>
                      )}
                      {bar.current === 0 && (
                        <span className="bar-down-badge" title="Caído">☠</span>
                      )}
                    </div>

                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default GroupStatus;

