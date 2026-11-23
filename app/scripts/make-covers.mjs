#!/usr/bin/env node
/**
 * Generates deterministic local static SVG cover fallback assets in `app/public/covers/`.
 * Zero external dependencies; guarantees zero broken images for any genre or fallback card.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, '..', 'public', 'covers');

const COVERS = [
  { slug: 'funk', label: 'FUNK', bg1: '#1A0B1E', bg2: '#3D0F38', accent: '#FF3E7F', secondary: '#FFB800', motif: 'wave' },
  { slug: 'pagode-samba', label: 'PAGODE & SAMBA', bg1: '#1C140A', bg2: '#3A230D', accent: '#FF9F1C', secondary: '#2EC4B6', motif: 'sun' },
  { slug: 'sertanejo', label: 'SERTANEJO', bg1: '#1D120C', bg2: '#3C2214', accent: '#F4A261', secondary: '#E76F51', motif: 'rings' },
  { slug: 'eletronica-house', label: 'ELETRONICA', bg1: '#08121E', bg2: '#132744', accent: '#00F5D4', secondary: '#9B5DE5', motif: 'grid' },
  { slug: 'pop-hits', label: 'POP & HITS', bg1: '#1B0E24', bg2: '#3B1954', accent: '#F15BB5', secondary: '#00BBF9', motif: 'disco' },
  { slug: 'rock-indie', label: 'ROCK & INDIE', bg1: '#141118', bg2: '#2B1F33', accent: '#FF595E', secondary: '#FFCA3A', motif: 'bolt' },
  { slug: 'metal-punk-goth', label: 'METAL & PUNK', bg1: '#0E0D11', bg2: '#221C29', accent: '#E63946', secondary: '#A8DADC', motif: 'shards' },
  { slug: 'forro-tecnobrega', label: 'FORRO & BREGA', bg1: '#0E1B16', bg2: '#1C3B2F', accent: '#06D6A0', secondary: '#FFD166', motif: 'arches' },
  { slug: 'hip-hop-rnb', label: 'HIP-HOP & R&B', bg1: '#11101C', bg2: '#252142', accent: '#8338EC', secondary: '#FFBE0B', motif: 'vinyl' },
  { slug: 'karaoke-ao-vivo', label: 'AO VIVO', bg1: '#1C0F14', bg2: '#3B1A26', accent: '#FF4D6D', secondary: '#72EFDD', motif: 'bars' },
  { slug: 'generic', label: 'QUAL A BOA', bg1: '#121110', bg2: '#262321', accent: '#FF3E7F', secondary: '#F4F1EC', motif: 'rings' },
];

function motifSvg(motif, accent, secondary) {
  switch (motif) {
    case 'wave':
      return `<path d="M0 310 Q100 240 200 310 T400 310 L400 500 L0 500 Z" fill="${accent}" opacity="0.28"/>
      <path d="M0 360 Q100 300 200 360 T400 360 L400 500 L0 500 Z" fill="${secondary}" opacity="0.24"/>
      <circle cx="300" cy="140" r="76" fill="${accent}" opacity="0.85"/>`;
    case 'sun':
      return `<circle cx="200" cy="210" r="108" fill="${accent}" opacity="0.88"/>
      <circle cx="200" cy="210" r="142" fill="none" stroke="${secondary}" stroke-width="6" stroke-dasharray="14 12" opacity="0.65"/>`;
    case 'grid':
      return `<g stroke="${accent}" stroke-width="2" opacity="0.35">
        <line x1="0" y1="120" x2="400" y2="120"/><line x1="0" y1="200" x2="400" y2="200"/><line x1="0" y1="280" x2="400" y2="280"/>
        <line x1="100" y1="0" x2="100" y2="500"/><line x1="200" y1="0" x2="200" y2="500"/><line x1="300" y1="0" x2="300" y2="500"/>
      </g>
      <polygon points="200,90 320,250 200,410 80,250" fill="${secondary}" opacity="0.35" stroke="${accent}" stroke-width="5"/>`;
    case 'disco':
      return `<circle cx="200" cy="195" r="96" fill="${accent}" opacity="0.85"/>
      <circle cx="200" cy="195" r="64" fill="none" stroke="#FFFFFF" stroke-width="3" opacity="0.5"/>
      <circle cx="200" cy="195" r="32" fill="${secondary}" opacity="0.85"/>`;
    case 'bolt':
      return `<polygon points="230,60 115,255 205,255 165,420 295,210 205,210" fill="${accent}" opacity="0.9"/>
      <circle cx="315" cy="115" r="38" fill="${secondary}" opacity="0.7"/>`;
    case 'shards':
      return `<polygon points="40,420 175,90 250,420" fill="${accent}" opacity="0.75"/>
      <polygon points="180,440 285,130 370,440" fill="${secondary}" opacity="0.35"/>`;
    case 'arches':
      return `<path d="M55 430 A145 145 0 0 1 345 430" fill="none" stroke="${accent}" stroke-width="24" opacity="0.8"/>
      <path d="M105 430 A95 95 0 0 1 295 430" fill="none" stroke="${secondary}" stroke-width="18" opacity="0.7"/>`;
    case 'vinyl':
      return `<circle cx="200" cy="215" r="128" fill="#0B0A0F" stroke="${accent}" stroke-width="6"/>
      <circle cx="200" cy="215" r="88" fill="none" stroke="${secondary}" stroke-width="2" opacity="0.5"/>
      <circle cx="200" cy="215" r="42" fill="${accent}"/>
      <circle cx="200" cy="215" r="10" fill="#0B0A0F"/>`;
    case 'bars':
      return `<g fill="${accent}" opacity="0.85">
        <rect x="64" y="210" width="36" height="170" rx="18"/>
        <rect x="122" y="130" width="36" height="250" rx="18" fill="${secondary}"/>
        <rect x="180" y="90" width="36" height="290" rx="18"/>
        <rect x="238" y="160" width="36" height="220" rx="18" fill="${secondary}"/>
        <rect x="296" y="230" width="36" height="150" rx="18"/>
      </g>`;
    default:
      return `<circle cx="200" cy="210" r="118" fill="none" stroke="${accent}" stroke-width="14" opacity="0.8"/>
      <circle cx="200" cy="210" r="70" fill="${secondary}" opacity="0.28"/>`;
  }
}

mkdirSync(OUT_DIR, { recursive: true });
for (const c of COVERS) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 500" width="400" height="500" role="img" aria-label="${c.label}">
  <defs>
    <linearGradient id="bg-${c.slug}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${c.bg1}"/>
      <stop offset="100%" stop-color="${c.bg2}"/>
    </linearGradient>
  </defs>
  <rect width="400" height="500" fill="url(#bg-${c.slug})"/>
  ${motifSvg(c.motif, c.accent, c.secondary)}
  <rect x="28" y="428" width="180" height="36" rx="18" fill="#121110" fill-opacity="0.72"/>
  <text x="46" y="451" fill="#F4F1EC" font-family="system-ui, -apple-system, sans-serif" font-size="14" font-weight="700" letter-spacing="1.4">${c.label}</text>
</svg>\n`;
  writeFileSync(path.join(OUT_DIR, `${c.slug}.svg`), svg, 'utf8');
}
console.log(`generated ${COVERS.length} deterministic local SVG fallback covers in ${OUT_DIR}`);
