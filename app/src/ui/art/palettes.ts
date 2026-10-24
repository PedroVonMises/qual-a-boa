/**
 * Cover art palettes (brand-art literals, see docs/DESIGN.md §2 "Cover art palettes").
 * bg1 (top) and bg2 (bottom) form the two-stop background; motif is the bright hero shape,
 * accent the secondary shape, ink the dark flat shadow shapes (never pure black).
 */
export interface ArtPalette {
  id: string;
  bg1: string;
  bg2: string;
  motif: string;
  accent: string;
  ink: string;
}

export const ART_PALETTES: readonly ArtPalette[] = [
  { id: 'rosa-ambar', bg1: '#FF3D7F', bg2: '#7A1C5C', motif: '#FFC247', accent: '#FF8A4C', ink: '#2A0F2E' },
  { id: 'turquesa-coral', bg1: '#0F8B8D', bg2: '#0A4A5C', motif: '#FF7A66', accent: '#FFD6A5', ink: '#082A33' },
  { id: 'tangerina-petroleo', bg1: '#FF8A1F', bg2: '#D9480F', motif: '#0E5E6F', accent: '#FFE08A', ink: '#3B1308' },
  { id: 'lima-ameixa', bg1: '#5B1E6B', bg2: '#2E0F45', motif: '#B7F03C', accent: '#FF6FB1', ink: '#1A0828' },
  { id: 'ceu-poente', bg1: '#4CB5F5', bg2: '#FF8F6B', motif: '#FFE27A', accent: '#FF5E8A', ink: '#1D2B5C' },
  { id: 'menta-amora', bg1: '#7FE3C4', bg2: '#2FB59A', motif: '#C2185B', accent: '#FFF0A8', ink: '#3A0A2A' },
  { id: 'anil-ouro', bg1: '#3B2FB5', bg2: '#1B1466', motif: '#FFC93C', accent: '#FF6F91', ink: '#0E0A3A' },
  { id: 'coral-marinho', bg1: '#FF6B5B', bg2: '#E8384F', motif: '#FFE3B0', accent: '#1F3A7A', ink: '#2B0B24' },
  { id: 'esmeralda-pessego', bg1: '#0B7A55', bg2: '#064E3B', motif: '#FFB38A', accent: '#F9E07A', ink: '#032A1F' },
  { id: 'violeta-ciano', bg1: '#7C3AED', bg2: '#4C1D95', motif: '#22D3EE', accent: '#F472B6', ink: '#1E0B45' },
  { id: 'sol-vinho', bg1: '#FFB627', bg2: '#F2542D', motif: '#FFF1C9', accent: '#7B2D8E', ink: '#3D0F1A' },
  { id: 'rosa-oceano', bg1: '#F9A8C9', bg2: '#E0568F', motif: '#0F6E8C', accent: '#FFE9A8', ink: '#3A0F2B' },
] as const;

export const PALETTE_IDS: readonly string[] = ART_PALETTES.map((p) => p.id);

export function paletteById(id: string): ArtPalette | undefined {
  return ART_PALETTES.find((p) => p.id === id);
}
