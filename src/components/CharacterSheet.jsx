import React, { useState, useEffect, useRef } from 'react';
import { Camera, Map, Users, Eye, Edit3, Plus, X, Upload, Grid, ChevronRight, Castle, Sword, Scroll, Skull, ScrollText, Dices, RotateCw, Image as ImageIcon, Type, GripVertical, Trash2, ListPlus, Settings2, ShoppingBag, Check, Hash, ArrowUp, ArrowDown, Palette, Minus, Heart, Calculator, ListChecks } from 'lucide-react';
import { SHEET_FONTS, evaluateFormula, suggestTab, DEFAULT_TABS } from './sheetHelpers.jsx';

const CharacterSheet = ({ viewMode, sheetFields, onFieldsChange, sheetFont, onFontChange, playerName, onPlayerNameChange, playerSheets, onUpdatePlayerSheet }) => {
  const [builderOpen, setBuilderOpen] = useState(false);
  const [fontPickerOpen, setFontPickerOpen] = useState(false);
  const [newFieldType, setNewFieldType] = useState('text');
  const [newFieldLabel, setNewFieldLabel] = useState('');
  const [newFieldFormula, setNewFieldFormula] = useState('');
  const [newFieldTab, setNewFieldTab] = useState('');
  const [extraBuilderOpen, setExtraBuilderOpen] = useState(false);
  const [newExtraType, setNewExtraType] = useState('text');
  const [newExtraLabel, setNewExtraLabel] = useState('');
  const [newExtraFormula, setNewExtraFormula] = useState('');
  const [newExtraTab, setNewExtraTab] = useState('');
  const [masterSelectedPlayer, setMasterSelectedPlayer] = useState('');
  const [attackRolls, setAttackRolls] = useState({});
  const [activeSheetTab, setActiveSheetTab] = useState('Geral');

  const DEFAULT_TAB = 'Geral';

  const isMaster = viewMode === 'master';
  const fontFamily = (SHEET_FONTS.find(f => f.id === sheetFont) || SHEET_FONTS[0]).family;
  const playerNames = Object.keys(playerSheets || {});
  const activePlayer = isMaster ? masterSelectedPlayer : playerName;
  const activeEntry = (playerSheets && playerSheets[activePlayer]) || { extraFields: [], values: {} };
  const extraFields = activeEntry.extraFields || [];

  // Rascunho local dos VALORES do jogador ativo: digitar atualiza a UI na hora,
  // o storage só grava após uma pausa (debounce). Reseta ao trocar de jogador (Mestre).
  const [draftValues, setDraftValues] = useState(activeEntry.values || {});
  const [saveStatus, setSaveStatus] = useState('idle');
  const saveTimeoutRef = useRef(null);
  const draftRef = useRef(activeEntry.values || {});

  useEffect(() => {
    draftRef.current = activeEntry.values || {};
    setDraftValues(activeEntry.values || {});
    setSaveStatus('idle');
  }, [activePlayer]);

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, []);

  // --- Campos BASE (modelo do Mestre) ---
  const addField = () => {
    const label = newFieldLabel.trim();
    if (!label) return;
    // Auto-categoriza: se o Mestre não escolheu aba, sugere uma baseada no nome.
    const tab = newFieldTab.trim() || suggestTab(label);
    const field = { id: `f_${Date.now()}`, type: newFieldType, label, tab };
    if (newFieldType === 'formula') field.formula = newFieldFormula.trim();
    onFieldsChange([...sheetFields, field]);
    setNewFieldLabel('');
    setNewFieldFormula('');
    setNewFieldTab('');
  };

  const removeField = (id) => onFieldsChange(sheetFields.filter(f => f.id !== id));
  const renameField = (id, label) => onFieldsChange(sheetFields.map(f => f.id === id ? { ...f, label } : f));
  const setFieldTab = (id, tab) => onFieldsChange(sheetFields.map(f => f.id === id ? { ...f, tab: tab || DEFAULT_TAB } : f));
  const moveField = (index, dir) => {
    const target = index + dir;
    if (target < 0 || target >= sheetFields.length) return;
    const next = [...sheetFields];
    [next[index], next[target]] = [next[target], next[index]];
    onFieldsChange(next);
  };

  // --- Campos EXTRAS (cada jogador monta os seus, por cima do modelo base) ---
  const addExtraField = () => {
    const label = newExtraLabel.trim();
    if (!label || !activePlayer) return;
    // Auto-categorização também vale pros campos extras
    const tab = newExtraTab.trim() || suggestTab(label);
    const field = { id: `x_${Date.now()}`, type: newExtraType, label, tab };
    if (newExtraType === 'formula') field.formula = newExtraFormula.trim();
    onUpdatePlayerSheet(activePlayer, { extraFields: [...extraFields, field] });
    setNewExtraLabel('');
    setNewExtraFormula('');
    setNewExtraTab('');
  };

  const removeExtraField = (id) => {
    onUpdatePlayerSheet(activePlayer, { extraFields: extraFields.filter(f => f.id !== id) });
  };

  const renameExtraField = (id, label) => {
    onUpdatePlayerSheet(activePlayer, { extraFields: extraFields.map(f => f.id === id ? { ...f, label } : f) });
  };

  const setExtraFieldTab = (id, tab) => {
    onUpdatePlayerSheet(activePlayer, { extraFields: extraFields.map(f => f.id === id ? { ...f, tab: tab || DEFAULT_TAB } : f) });
  };

  const moveExtraField = (index, dir) => {
    const target = index + dir;
    if (target < 0 || target >= extraFields.length) return;
    const next = [...extraFields];
    [next[index], next[target]] = [next[target], next[index]];
    onUpdatePlayerSheet(activePlayer, { extraFields: next });
  };

  // --- Valores preenchidos (base + extras, mesmo objeto de valores) ---
  const setValue = (id, value) => {
    const next = { ...draftRef.current, [id]: value };
    draftRef.current = next;
    setDraftValues(next);
    setSaveStatus('saving');

    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(async () => {
      await onUpdatePlayerSheet(activePlayer, { values: next });
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus(prev => (prev === 'saved' ? 'idle' : prev)), 1800);
    }, 700);
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
    const current = draftRef.current[id] || { bonus: 0, damage: '' };
    const bonus = Number(current.bonus) || 0;
    setAttackRolls(prev => ({
      ...prev,
      [id]: { ...prev[id], atkRolling: true, atkSpin: (prev[id]?.atkSpin || 0) + 1, atk: null }
    }));
    setTimeout(() => {
      const d20 = 1 + Math.floor(Math.random() * 20);
      setAttackRolls(prev => ({
        ...prev,
        [id]: { ...prev[id], atkRolling: false, atk: { d20, bonus, total: d20 + bonus } }
      }));
    }, 1200);
  };

  const rollDamage = (id) => {
    const current = draftRef.current[id] || { bonus: 0, damage: '' };
    const cleaned = (current.damage || '').replace(/\s/g, '');
    const match = cleaned.match(/^(\d+)d(\d+)([+-]\d+)?$/i);
    if (!match) return;
    const qty = Math.min(parseInt(match[1], 10), 10);
    const sides = parseInt(match[2], 10);
    const mod = match[3] ? parseInt(match[3], 10) : 0;

    setAttackRolls(prev => ({
      ...prev,
      [id]: { ...prev[id], dmgRolling: true, dmgSpin: (prev[id]?.dmgSpin || 0) + 1, dmgDice: { qty, sides, mod }, dmg: null }
    }));
    setTimeout(() => {
      const rolls = Array.from({ length: qty }, () => 1 + Math.floor(Math.random() * sides));
      const total = rolls.reduce((a, b) => a + b, 0) + mod;
      setAttackRolls(prev => ({
        ...prev,
        [id]: { ...prev[id], dmgRolling: false, dmg: { rolls, mod, total } }
      }));
    }, 1200);
  };

  // Todos os campos (base + extras) — usado para resolver fórmulas por nome
  const allFieldsForFormulas = [...sheetFields, ...extraFields];

  // Nomes de abas já usados em qualquer campo (base ou extra) — sugestões para o datalist
  const allTabNames = Array.from(new Set(allFieldsForFormulas.map(f => f.tab).filter(Boolean)));

  const renderField = (f, { removable }) => (
    <div key={f.id} className={`sheet-field sheet-field-${f.type}`}>
      <div className="sheet-field-label-row">
        <label style={{ fontFamily }}>{f.label}</label>
        {removable && (
          <button className="sheet-field-remove-mini" onClick={() => removeExtraField(f.id)} title="Remover meu campo">
            <Trash2 size={12} />
          </button>
        )}
      </div>

      {f.type === 'text' && (
        <input type="text" value={draftValues[f.id] || ''} onChange={e => setValue(f.id, e.target.value)} placeholder="Preencha aqui..." />
      )}
      {f.type === 'number' && (
        <input type="number" value={draftValues[f.id] ?? ''} onChange={e => setValue(f.id, e.target.value)} placeholder="0" />
      )}
      {f.type === 'textarea' && (
        <textarea value={draftValues[f.id] || ''} onChange={e => setValue(f.id, e.target.value)} placeholder="Preencha aqui..." rows={4} />
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
          {(draftValues[f.id] || []).map((item, idx) => (
            <div key={idx} className="sheet-list-item">
              <input type="text" value={item} onChange={e => updateListItem(f.id, idx, e.target.value)} placeholder={`Item ${idx + 1}`} />
              <button onClick={() => removeListItem(f.id, idx)}><X size={14} /></button>
            </div>
          ))}
          <button className="sheet-list-add-btn" onClick={() => addListItem(f.id)}>
            <Plus size={14} /> Adicionar item
          </button>
        </div>
      )}

      {f.type === 'formula' && (() => {
        const labelValueMap = {};
        allFieldsForFormulas.forEach(other => {
          labelValueMap[other.label] = draftValues[other.id];
        });
        const result = evaluateFormula(f.formula, labelValueMap);
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
                <input type="text" placeholder="1d8+2" value={val.damage || ''} onChange={e => setAttackField(f.id, 'damage', e.target.value)} />
              </label>
            </div>
            <div className="attack-roll-row">
              <button className="attack-roll-btn" onClick={() => rollAttack(f.id)} disabled={rolls.atkRolling}>
                <Dices size={14} /> Rolar Ataque
              </button>
              <button className="attack-roll-btn" onClick={() => rollDamage(f.id)} disabled={!val.damage || rolls.dmgRolling}>
                <Dices size={14} /> Rolar Dano
              </button>
            </div>

            {showAtkDice && (
              <div className="attack-dice-row">
                <div className="dice-face-3d dice-face-3d-mini">
                  <Dice3D diceType={20} skinId={DICE_SKINS[0].id} spinTrigger={rolls.atkSpin} />
                  <span className="dice-face-label">d20</span>
                  {rolls.atk && <span className={`dice-face-value dice-face-value-mini ${rolls.atkRolling ? 'flicker' : ''}`}>{rolls.atk.d20}</span>}
                </div>
              </div>
            )}
            {showDmgDice && (
              <div className="attack-dice-row">
                {Array.from({ length: rolls.dmgDice.qty }).map((_, i) => (
                  <div key={i} className="dice-face-3d dice-face-3d-mini">
                    <Dice3D diceType={rolls.dmgDice.sides} skinId={DICE_SKINS[0].id} spinTrigger={rolls.dmgSpin} />
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
          {(draftValues[f.id] || []).map(item => (
            <div key={item.id} className="checklist-item-row">
              <input type="checkbox" checked={!!item.checked} onChange={() => toggleChecklistItem(f.id, item.id)} />
              <input
                type="text"
                value={item.text}
                onChange={e => updateChecklistText(f.id, item.id, e.target.value)}
                placeholder="Descreva o item..."
                className={item.checked ? 'checklist-text-done' : ''}
              />
              <button onClick={() => removeChecklistItem(f.id, item.id)}><X size={14} /></button>
            </div>
          ))}
          <button className="sheet-list-add-btn" onClick={() => addChecklistItem(f.id)}>
            <Plus size={14} /> Adicionar item
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div className="character-sheet" style={{ fontFamily }}>
      <datalist id="sheet-tab-options">
        {allTabNames.map(t => <option key={t} value={t} />)}
      </datalist>
      {activePlayer && (
        <div className={`save-status save-status-${saveStatus}`}>
          {saveStatus === 'saving' && <>Salvando...</>}
          {saveStatus === 'saved' && <><Check size={14} /> Salvo</>}
        </div>
      )}

      {isMaster && (
        <div className="sheet-master-toolbar">
          <button className="sheet-tool-btn" onClick={() => setBuilderOpen(o => !o)}>
            <Settings2 size={16} />
            {builderOpen ? 'Fechar construtor' : 'Configurar modelo base'}
          </button>
          <button className="sheet-tool-btn" onClick={() => setFontPickerOpen(o => !o)}>
            <Palette size={16} />
            Fonte da ficha
          </button>
        </div>
      )}

      {isMaster && fontPickerOpen && (
        <div className="font-picker-panel">
          {SHEET_FONTS.map(f => (
            <button
              key={f.id}
              className={`font-swatch-btn ${sheetFont === f.id ? 'active' : ''}`}
              style={{ fontFamily: f.family }}
              onClick={() => { onFontChange(f.id); setFontPickerOpen(false); }}
            >
              Abc 123
              <small>{f.label}</small>
            </button>
          ))}
        </div>
      )}

      {isMaster && builderOpen && (
        <div className="field-builder-panel">
          <h4>Adicionar campo ao modelo base (todos os jogadores recebem)</h4>
          <div className="field-type-grid">
            {FIELD_TYPES.map(ft => {
              const Icon = ft.icon;
              return (
                <button key={ft.id} className={`field-type-btn ${newFieldType === ft.id ? 'active' : ''}`} onClick={() => setNewFieldType(ft.id)}>
                  <Icon size={16} /> {ft.label}
                </button>
              );
            })}
          </div>
          <div className="field-add-row">
            <input
              type="text"
              placeholder="Nome do campo (ex: Força, Retrato, Inventário...)"
              value={newFieldLabel}
              onChange={e => setNewFieldLabel(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addField()}
            />
            {newFieldType === 'formula' && (
              <input
                type="text"
                placeholder="Fórmula (ex: (Força-10)/2)"
                value={newFieldFormula}
                onChange={e => setNewFieldFormula(e.target.value)}
                className="formula-input"
              />
            )}
            <input
              type="text"
              placeholder="Aba (opcional)"
              value={newFieldTab}
              onChange={e => setNewFieldTab(e.target.value)}
              list="sheet-tab-options"
              className="field-tab-input"
            />
            {newFieldLabel.trim() && !newFieldTab.trim() && (
              <span className="auto-cat-hint">→ Auto: {suggestTab(newFieldLabel)}</span>
            )}

            <button className="field-add-btn" onClick={addField} disabled={!newFieldLabel.trim()}>
              <Plus size={16} /> Adicionar
            </button>
          </div>
          {newFieldType === 'formula' && (
            <p className="status-bars-hint">Use os nomes de outros campos numéricos na fórmula, ex: (Força-10)/2</p>
          )}

          {sheetFields.length > 0 && (
            <div className="field-list">
              {sheetFields.map((f, i) => {
                const ft = FIELD_TYPES.find(t => t.id === f.type) || FIELD_TYPES[0];
                const Icon = ft.icon;
                return (
                  <div key={f.id} className="field-list-row">
                    <Icon size={15} className="field-list-icon" />
                    <input type="text" value={f.label} onChange={e => renameField(f.id, e.target.value)} className="field-list-label-input" />
                    <span className="field-list-type">{ft.label}</span>
                    <input
                      type="text"
                      value={f.tab || DEFAULT_TAB}
                      onChange={e => setFieldTab(f.id, e.target.value)}
                      list="sheet-tab-options"
                      className="field-list-tab-input"
                      title="Aba desta ficha"
                    />
                    <button onClick={() => moveField(i, -1)} disabled={i === 0} title="Mover para cima"><ArrowUp size={14} /></button>
                    <button onClick={() => moveField(i, 1)} disabled={i === sheetFields.length - 1} title="Mover para baixo"><ArrowDown size={14} /></button>
                    <button onClick={() => removeField(f.id)} className="field-remove-btn" title="Remover campo"><Trash2 size={14} /></button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {isMaster && (
        <div className="status-master-select-row">
          <span>Ver/editar ficha de:</span>
          <select value={masterSelectedPlayer} onChange={e => setMasterSelectedPlayer(e.target.value)}>
            <option value="">Selecione um jogador...</option>
            {playerNames.map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
      )}

      {!isMaster && !playerName && (
        <p className="status-bars-hint">Defina seu nome de jogador na seção "Barras de Status" acima para habilitar sua ficha.</p>
      )}

      {isMaster && !masterSelectedPlayer && (
        <p className="status-bars-hint">
          {playerNames.length === 0 ? 'Nenhum jogador se identificou ainda.' : 'Escolha um jogador acima para ver a ficha completa dele.'}
        </p>
      )}

      {activePlayer && (
        <div className="sheet-fields-area">
          {sheetFields.length === 0 && extraFields.length === 0 ? (
            <div className="empty-state">
              <ScrollText size={64} />
              <h2>Ficha ainda não configurada</h2>
              <p>{isMaster ? 'Clique em "Configurar modelo base" para começar.' : 'Aguarde o Mestre configurar o modelo base, ou adicione seus próprios campos abaixo.'}</p>
            </div>
          ) : (() => {
            const allCombined = [...sheetFields, ...extraFields];
            const tabNames = Array.from(new Set(allCombined.map(f => f.tab || DEFAULT_TAB)));
            if (tabNames.length === 0) tabNames.push(DEFAULT_TAB);
            const currentTab = tabNames.includes(activeSheetTab) ? activeSheetTab : tabNames[0];
            const visibleBase = sheetFields.filter(f => (f.tab || DEFAULT_TAB) === currentTab);
            const visibleExtra = extraFields.filter(f => (f.tab || DEFAULT_TAB) === currentTab);
            return (
              <>
                {tabNames.length > 1 && (
                  <div className="sheet-subtab-nav">
                    {tabNames.map(t => (
                      <button
                        key={t}
                        className={`sheet-subtab-btn ${t === currentTab ? 'active' : ''}`}
                        onClick={() => setActiveSheetTab(t)}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                )}
                <div className="sheet-fields-grid">
                  {visibleBase.map(f => renderField(f, { removable: false }))}
                  {visibleExtra.map(f => renderField(f, { removable: !isMaster }))}
                </div>
              </>
            );
          })()}

          {!isMaster && (
            <div className="extra-field-builder">
              <button className="sheet-tool-btn" onClick={() => setExtraBuilderOpen(o => !o)}>
                <Plus size={16} />
                {extraBuilderOpen ? 'Fechar' : 'Adicionar meu próprio campo'}
              </button>
              {extraBuilderOpen && (
                <div className="field-builder-panel">
                  <div className="field-type-grid">
                    {FIELD_TYPES.map(ft => {
                      const Icon = ft.icon;
                      return (
                        <button key={ft.id} className={`field-type-btn ${newExtraType === ft.id ? 'active' : ''}`} onClick={() => setNewExtraType(ft.id)}>
                          <Icon size={16} /> {ft.label}
                        </button>
                      );
                    })}
                  </div>
                  <div className="field-add-row">
                    <input
                      type="text"
                      placeholder="Nome do seu campo (ex: Talentos, Foto extra...)"
                      value={newExtraLabel}
                      onChange={e => setNewExtraLabel(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && addExtraField()}
                    />
                    {newExtraType === 'formula' && (
                      <input
                        type="text"
                        placeholder="Fórmula (ex: (Força-10)/2)"
                        value={newExtraFormula}
                        onChange={e => setNewExtraFormula(e.target.value)}
                        className="formula-input"
                      />
                    )}
                    <input
                      type="text"
                      placeholder="Aba (opcional)"
                      value={newExtraTab}
                      onChange={e => setNewExtraTab(e.target.value)}
                      list="sheet-tab-options"
                      className="field-tab-input"
                    />
                    {newExtraLabel.trim() && !newExtraTab.trim() && (
                      <span className="auto-cat-hint">→ Auto: {suggestTab(newExtraLabel)}</span>
                    )}
                    <button className="field-add-btn" onClick={addExtraField} disabled={!newExtraLabel.trim()}>
                      <Plus size={16} /> Adicionar
                    </button>
                  </div>
                  {newExtraType === 'formula' && (
                    <p className="status-bars-hint">Use os nomes de outros campos numéricos na fórmula, ex: (Força-10)/2</p>
                  )}
                  {extraFields.length > 0 && (
                    <div className="field-list">
                      {extraFields.map((f, i) => {
                        const ft = FIELD_TYPES.find(t => t.id === f.type) || FIELD_TYPES[0];
                        const Icon = ft.icon;
                        return (
                          <div key={f.id} className="field-list-row">
                            <Icon size={15} className="field-list-icon" />
                            <input type="text" value={f.label} onChange={e => renameExtraField(f.id, e.target.value)} className="field-list-label-input" />
                            <input
                              type="text"
                              value={f.tab || DEFAULT_TAB}
                              onChange={e => setExtraFieldTab(f.id, e.target.value)}
                              list="sheet-tab-options"
                              className="field-list-tab-input"
                              title="Aba desta ficha"
                            />
                            <button onClick={() => moveExtraField(i, -1)} disabled={i === 0}><ArrowUp size={14} /></button>
                            <button onClick={() => moveExtraField(i, 1)} disabled={i === extraFields.length - 1}><ArrowDown size={14} /></button>
                            <button onClick={() => removeExtraField(f.id)} className="field-remove-btn"><Trash2 size={14} /></button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Componente principal

export default CharacterSheet;
