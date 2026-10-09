import React from 'react';
import { evaluateFormula, resolveFormulas } from '../shared/sheetFormulas.js';
import { SHEET_FONTS, loadSheetFont } from '../shared/sheetFonts.js';
import { Type, ScrollText, Hash, Image as QIcon, ListPlus, Calculator, Sword, ListChecks, Heart } from 'lucide-react';


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

// As fórmulas vivem em src/shared/sheetFormulas.js (com piso, teto, min, max e referências entre fórmulas).

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

export { SHEET_FONTS, loadSheetFont, FIELD_TYPES, evaluateFormula, resolveFormulas };