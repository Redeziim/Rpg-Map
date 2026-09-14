import React from 'react';
import { Type, ScrollText, Hash, Image as QIcon, ListPlus, Calculator, Sword, ListChecks, Heart } from 'lucide-react';

const SHEET_FONTS = [
  { id: 'cinzel', label: 'Cinzel', family: "'Cinzel', serif" },
  { id: 'medieval', label: 'MedievalSharp', family: "'MedievalSharp', cursive" },
  { id: 'uncial', label: 'Uncial Antiqua', family: "'Uncial Antiqua', cursive" },
  { id: 'fell', label: 'IM Fell English', family: "'IM Fell English', serif" },
  { id: 'metamorphous', label: 'Metamorphous', family: "'Metamorphous', cursive" },
  { id: 'grenze', label: 'Grenze', family: "'Grenze', serif" },
];

// Tipos de campo que o Mestre (ou o jogador, nos seus campos extras) pode adicionar à ficha
const FIELD_TYPES = [
  { id: 'status', label: 'Recurso / barra', icon: Heart },
  { id: 'text', label: 'Texto curto', icon: Type },
  { id: 'textarea', label: 'Texto longo', icon: ScrollText },
  { id: 'number', label: 'Número', icon: Hash },
  { id: 'image', label: 'Imagem', icon: QIcon },
  { id: 'list', label: 'Lista', icon: ListPlus },
  { id: 'formula', label: 'Fórmula', icon: Calculator },
  { id: 'attack', label: 'Ataque/Habilidade', icon: Sword },
  { id: 'checklist', label: 'Lista de marcação', icon: ListChecks, Heart },
];

// Avalia uma fórmula simples com referências a outros campos pelo nome (ex: "(Força-10)/2).
// Após substituir os nomes pelos valores, só sobra aritmética básica — nunca código arbitrário.
const evaluateFormula = (formula, labelValueMap) => {
  if (!formula) return null;
  let expr = formula;
  const labels = Object.keys(labelValueMap).sort((a, b) => b.length - a.length);
  for (const label of labels) {
    const safeLabel = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(safeLabel, 'gi');
    expr = expr.replace(re, `(${labelValueMap[label]})`);
  }
  if (!/^[0-9+\-*/().\s]*$/.test(expr)) return 'erro';
  try {
    // eslint-disable-next-line no-new-func
    const result = Function(`"use strict"; return (${expr || '0'});`)();
    if (typeof result !== 'number' || !isFinite(result)) return 'erro';
    return Math.round(result * 100) / 100;
  } catch {
    return 'erro';
  }
};

// --- Auto-categorização de campos por nome ---
// O Mestre (ou jogador) digita um nome e o sistema escolhe a aba correta,
// mas qualquer um pode sobrescrever manualmente.
const CATEGORY_RULES = [
  { tab: 'Atributos', keywords: ['força', 'forca', 'agilidade', 'agi', 'inteligência', 'inteligencia', 'int', 'vigor', 'vig', 'sanidade', 'san', 'resistencia', 'res', 'presenca', 'pres', 'carisma', 'car', 'força', 'destreza', 'des'] },
  { tab: 'Status', keywords: ['vida', 'hp', 'sanidade', 'esforço', 'esforco', 'corpo', 'mente', 'alma', 'energia', 'fadiga', 'mp', 'sp', 'fp'] },
  { tab: 'Habilidades', keywords: ['habilidade', 'magia', 'pericia', 'especialidade', 'talento', 'artefato', 'mag', 'skill'] },
  { tab: 'Equipamento', keywords: ['arma', 'armadura', 'escudo', 'peça', 'peca', 'inventario', 'inventário', 'bolso', 'mochila', 'item'] },
  { tab: 'Aparência', keywords: ['foto', 'retrato', 'descrição', 'desconto', 'personagem', 'imagem', 'avatar', 'rosto'] },
  { tab: 'Notas', keywords: ['nota', 'observacao', 'observações', 'diario', 'comentario', 'anotacao'] },
];

// Determina a aba sugerida a partir do nome do campo
export function suggestTab(label) {
  if (!label) return 'Geral';
  const lower = label.toLowerCase();
  for (const rule of CATEGORY_RULES) {
    for (const kw of rule.keywords) {
      if (lower.includes(kw)) return rule.tab;
    }
  }
  return 'Geral';
}

// Lista de abas padrão em ordem
export const DEFAULT_TABS = ['Atributos', 'Status', 'Habilidades', 'Equipamento', 'Aparência', 'Notas', 'Geral'];

export { SHEET_FONTS, FIELD_TYPES, evaluateFormula };