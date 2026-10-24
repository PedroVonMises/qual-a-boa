/**
 * Demo seed for "Qual a boa?" (Vitória/ES). ALL DATA IS PLACEHOLDER.
 *
 * Venue names/areas follow docs/VENUES.md. Artists and event titles are fictional;
 * they are not claims that the real venues host these events. Casa Maré is a
 * fictional venue. Dates are generated relative to `now` (America/Sao_Paulo, UTC-3).
 */
import { createHash } from 'node:crypto';

import type {
  Artist,
  CoverKey,
  EventItem,
  EventStatus,
  Genre,
  SeedDataset,
  Venue,
} from '../../app/src/domain/types';
import { coverFor } from '../../app/src/domain/cover';

/** Deterministic UUID (md5, RFC 4122 v3 layout) derived from a namespaced slug. */
export function uuidFromSlug(key: string): string {
  const h = createHash('md5').update(key).digest('hex').split('');
  h[12] = '3'; // version 3 (name-based, md5)
  h[16] = ((parseInt(h[16], 16) & 0x3) | 0x8).toString(16); // RFC 4122 variant
  const s = h.join('');
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20, 32)}`;
}

export const genreId = (slug: string) => uuidFromSlug(`genre:${slug}`);
export const venueId = (slug: string) => uuidFromSlug(`venue:${slug}`);
export const artistId = (slug: string) => uuidFromSlug(`artist:${slug}`);
export const eventId = (key: string) => uuidFromSlug(`event:${key}`);

export function slugify(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' e ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// ---------------------------------------------------------------------------
// Genres (order = display order)
// ---------------------------------------------------------------------------
const GENRES: [slug: string, label: string][] = [
  ['funk', 'Funk'],
  ['pagode-samba', 'Pagode/Samba'],
  ['sertanejo', 'Sertanejo'],
  ['eletronica-house', 'Eletrônica/House'],
  ['pop-hits', 'Pop/Hits'],
  ['rock-indie', 'Rock/Indie'],
  ['metal-punk-goth', 'Metal/Punk/Goth'],
  ['forro-tecnobrega', 'Forró/Tecnobrega'],
  ['hip-hop-rnb', 'Hip-hop/R&B'],
  ['karaoke-ao-vivo', 'Karaokê/Ao vivo'],
];
const GENRE_ORDER = new Map(GENRES.map(([slug], i) => [slug, i]));
const sortGenres = (slugs: string[]) =>
  [...new Set(slugs)].sort((a, b) => (GENRE_ORDER.get(a) ?? 99) - (GENRE_ORDER.get(b) ?? 99));

// ---------------------------------------------------------------------------
// Venues
// ---------------------------------------------------------------------------
type VenueSpec = Omit<Venue, 'id' | 'placeholder'>;
const VENUES: VenueSpec[] = [
  {
    slug: 'bolt', name: 'Bolt', area: 'Jardim da Penha', city: 'Vitória',
    address: 'R. Darcy Grijó, 20 - Jardim da Penha', lat: -20.2778, lng: -40.2908,
    status: 'open', adultOnly: true,
    genreSlugs: ['rock-indie', 'pop-hits', 'funk', 'hip-hop-rnb'],
    hours: 'Sex e sáb, 23h–06h', coverKey: 'bolt',
  },
  {
    slug: 'a-selva', name: 'A Selva', area: 'Centro', city: 'Vitória',
    address: 'R. Sete de Setembro, 493 - Centro', lat: -20.3195, lng: -40.3372,
    status: 'open', adultOnly: true,
    genreSlugs: ['eletronica-house', 'funk', 'hip-hop-rnb', 'forro-tecnobrega', 'rock-indie', 'pagode-samba'],
    hours: 'Qui a sáb, 22h–05h', coverKey: 'selva',
  },
  {
    slug: 'gordinho', name: 'Gordinho', area: 'Praia do Canto', city: 'Vitória',
    address: 'R. Joaquim Lírio, 823 - Praia do Canto', lat: -20.2968, lng: -40.2949,
    status: 'open', adultOnly: true,
    genreSlugs: ['pagode-samba'],
    hours: 'Qui a sáb, a partir das 18h', coverKey: 'gordinho',
  },
  {
    slug: 'pub-426', name: 'Pub 426', area: 'Praia do Canto', city: 'Vitória',
    address: 'R. João da Cruz, 370 - Praia do Canto', lat: -20.2985, lng: -40.2966,
    status: 'open', adultOnly: true,
    genreSlugs: ['rock-indie', 'pop-hits', 'karaoke-ao-vivo'],
    hours: 'Qua a sáb, 21h–03h (karaokê às quartas)', coverKey: 'pub426',
  },
  {
    slug: 'fluente', name: 'Fluente', area: 'Jardim da Penha', city: 'Vitória',
    address: 'Av. Saturnino Rangel Mauro - Jardim da Penha', lat: -20.2803, lng: -40.2885,
    status: 'unverified', adultOnly: true,
    genreSlugs: ['funk', 'pop-hits', 'sertanejo'],
    hours: 'Sex e sáb, 22h–04h', coverKey: 'fluente',
  },
  {
    slug: 'correria-music-bar', name: 'Correria Music Bar', area: 'Vila Velha', city: 'Vila Velha',
    address: 'Av. Est. José Júlio de Souza, 740 - Praia de Itaparica', lat: -20.3625, lng: -40.2838,
    status: 'open', adultOnly: true,
    genreSlugs: ['metal-punk-goth', 'rock-indie'],
    hours: 'Sex e sáb, 22h–04h', coverKey: 'generic',
  },
  {
    slug: 'casa-caipora', name: 'Casa Caipora', area: 'Centro', city: 'Vitória',
    address: 'R. Nestor Gomes - Centro', lat: -20.3182, lng: -40.3391,
    status: 'closed', adultOnly: true,
    genreSlugs: ['pagode-samba', 'hip-hop-rnb', 'rock-indie', 'eletronica-house'],
    hours: 'Encerrou as atividades em out/2026', coverKey: 'caipora',
  },
  {
    // Pilot demonstration venue.
    slug: 'casa-mare', name: 'Casa Maré', area: 'Praia do Canto', city: 'Vitória',
    address: 'Rua das Gaivotas, 120 - Praia do Canto', lat: -20.2960, lng: -40.2935,
    status: 'open', adultOnly: true,
    genreSlugs: ['eletronica-house', 'pop-hits', 'sertanejo', 'karaoke-ao-vivo'],
    hours: 'Qui a sáb, 21h–04h', coverKey: 'mare',
  },
];

// ---------------------------------------------------------------------------
// Artists (all fictional)
// ---------------------------------------------------------------------------
const ARTISTS: [name: string, genres: string[]][] = [
  ['DJ Maresia', ['eletronica-house', 'pop-hits']],
  ['MC Lua Cheia', ['funk']],
  ['Sereno da Ilha', ['pagode-samba']],
  ['Grupo Pé na Areia', ['pagode-samba']],
  ['Duo Moqueca', ['sertanejo']],
  ['Ana Tereza & Viola', ['sertanejo', 'karaoke-ao-vivo']],
  ['Os Noctâmbulos', ['rock-indie']],
  ['Vapor 80', ['rock-indie', 'pop-hits']],
  ['Cripta Neon', ['metal-punk-goth']],
  ['Ferrugem Atômica', ['metal-punk-goth']],
  ['DJ Taí Ruiz', ['eletronica-house']],
  ['Coletivo Mangue Disco', ['eletronica-house']],
  ['Trio Xodó Capixaba', ['forro-tecnobrega']],
  ['Aparelhagem Estrela do Norte', ['forro-tecnobrega']],
  ['Rimas de Camburi', ['hip-hop-rnb']],
  ['Lia Sol', ['hip-hop-rnb', 'pop-hits']],
  ['DJ Pedra Azul', ['funk', 'pop-hits']],
  ['MC Vitória Régia', ['funk']],
  ['Banda Farol', ['pop-hits', 'karaoke-ao-vivo']],
  ['Karaokê do Zé', ['karaoke-ao-vivo']],
  ['DJ Caju', ['pop-hits', 'funk']],
  ['Maria Goiaba', ['pagode-samba']],
  ['Soul de Jucutuquara', ['hip-hop-rnb']],
  ['Ondas Curtas', ['rock-indie']],
  ['DJ Noite Alta', ['eletronica-house']],
];

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------
const WED = 3, THU = 4, FRI = 5, SAT = 6;

interface EventSpec {
  venue: string;
  title: string;
  weekday: number; // 0 = Sunday (local time)
  /** Upcoming: 0..3 = 1st..4th occurrence after today. Past: weeks ago (1 = most recent). */
  n: number;
  hour: number; // local hour (UTC-3)
  genres: string[];
  artists: string[]; // artist names, billing order
  price: [number, number] | 'free' | null; // null = price not announced
  popularity: number;
  status?: EventStatus;
}

const e = (
  venue: string, title: string, weekday: number, n: number, hour: number,
  genres: string[], artists: string[], price: EventSpec['price'], popularity: number,
  status?: EventStatus,
): EventSpec => ({ venue, title, weekday, n, hour, genres, artists, price, popularity, status });

const UPCOMING: EventSpec[] = [
  // Bolt
  e('bolt', 'Lovy Bolt', FRI, 0, 23, ['pop-hits'], ['DJ Caju', 'Lia Sol'], [30, 40], 88),
  e('bolt', 'Bolt Indie Club', SAT, 0, 23, ['rock-indie', 'pop-hits'], ['Os Noctâmbulos', 'Ondas Curtas'], [35, 45], 76),
  e('bolt', 'Funk na Penha', FRI, 1, 23, ['funk'], ['MC Lua Cheia', 'DJ Pedra Azul'], [30, 40], 82),
  e('bolt', 'Retrô Bolt', SAT, 1, 23, ['pop-hits', 'rock-indie'], ['Vapor 80'], [35, 50], 70),
  e('bolt', 'Lovy Bolt', SAT, 2, 23, ['pop-hits'], ['DJ Caju'], [30, 40], 85),
  e('bolt', 'Hip-hop na Penha', FRI, 3, 23, ['hip-hop-rnb'], ['Rimas de Camburi', 'Soul de Jucutuquara'], [25, 35], 64),
  // A Selva
  e('a-selva', 'Discotopia', FRI, 0, 23, ['eletronica-house'], ['Coletivo Mangue Disco', 'DJ Taí Ruiz'], [40, 60], 91),
  e('a-selva', 'Noite do Pagodão', SAT, 0, 22, ['pagode-samba'], ['Sereno da Ilha', 'Maria Goiaba'], [20, 30], 79),
  e('a-selva', 'Tecnobrega Selvagem', THU, 1, 22, ['forro-tecnobrega'], ['Aparelhagem Estrela do Norte'], [15, 25], 58),
  e('a-selva', 'Baile da Selva', SAT, 1, 23, ['funk', 'hip-hop-rnb'], ['MC Vitória Régia', 'DJ Pedra Azul', 'Lia Sol'], [30, 50], 87),
  e('a-selva', 'Discotopia', FRI, 2, 23, ['eletronica-house'], ['DJ Noite Alta', 'Coletivo Mangue Disco'], [40, 60], 89),
  e('a-selva', 'Forró de Rua', SAT, 2, 21, ['forro-tecnobrega'], ['Trio Xodó Capixaba'], 'free', 61),
  e('a-selva', 'Selva Indie', SAT, 3, 23, ['rock-indie'], ['Os Noctâmbulos', 'Vapor 80'], [25, 40], 66),
  e('a-selva', 'Noite do Pagodão', THU, 3, 22, ['pagode-samba'], ['Grupo Pé na Areia'], [20, 30], 72),
  // Gordinho
  e('gordinho', 'Quinta do Samba', THU, 0, 20, ['pagode-samba'], ['Maria Goiaba'], 'free', 68),
  e('gordinho', 'Pagode de Sábado', SAT, 0, 18, ['pagode-samba'], ['Grupo Pé na Areia', 'Sereno da Ilha'], [20, 30], 80),
  e('gordinho', 'Quinta do Samba', THU, 1, 20, ['pagode-samba'], ['Sereno da Ilha'], 'free', 65),
  e('gordinho', 'Pagode de Sábado', SAT, 2, 18, ['pagode-samba'], ['Grupo Pé na Areia'], [20, 30], 77),
  e('gordinho', 'Roda de Samba da Praia', FRI, 3, 21, ['pagode-samba'], ['Maria Goiaba', 'Sereno da Ilha'], [15, 15], 70),
  // Pub 426
  e('pub-426', 'Karaokê de Quarta', WED, 0, 21, ['karaoke-ao-vivo'], ['Karaokê do Zé'], 'free', 55),
  e('pub-426', 'Anos 80 & 90', FRI, 0, 22, ['rock-indie', 'pop-hits'], ['Vapor 80', 'Banda Farol'], [25, 35], 74),
  e('pub-426', 'Karaokê de Quarta', WED, 1, 21, ['karaoke-ao-vivo'], ['Karaokê do Zé'], 'free', 52),
  e('pub-426', 'Rock no Pub', SAT, 1, 22, ['rock-indie'], ['Ondas Curtas'], [20, 30], 63),
  e('pub-426', 'Karaokê de Quarta', WED, 2, 21, ['karaoke-ao-vivo'], ['Karaokê do Zé'], 'free', 50),
  e('pub-426', 'New Wave Night', FRI, 2, 22, ['rock-indie', 'pop-hits'], ['Banda Farol'], null, 48),
  e('pub-426', 'Karaokê de Quarta', WED, 3, 21, ['karaoke-ao-vivo'], ['Karaokê do Zé'], 'free', 51, 'cancelled'),
  // Fluente (unverified)
  e('fluente', 'Match', SAT, 0, 22, ['pop-hits', 'funk', 'sertanejo'], ['DJ Caju', 'MC Lua Cheia'], [30, 50], 83),
  e('fluente', 'Fluente Funk', FRI, 1, 22, ['funk'], ['MC Vitória Régia'], [25, 40], 75),
  e('fluente', 'Match', SAT, 2, 22, ['pop-hits', 'funk', 'sertanejo'], ['DJ Pedra Azul'], [30, 50], 81),
  e('fluente', 'Sofrência na Penha', FRI, 3, 22, ['sertanejo'], ['Duo Moqueca', 'Ana Tereza & Viola'], [30, 45], 69),
  // Correria Music Bar (Vila Velha)
  e('correria-music-bar', 'Noite Gótica', SAT, 0, 22, ['metal-punk-goth'], ['Cripta Neon'], [20, 30], 57),
  e('correria-music-bar', 'Hardcore na Itaparica', FRI, 1, 22, ['metal-punk-goth'], ['Ferrugem Atômica', 'Cripta Neon'], [15, 25], 54),
  e('correria-music-bar', 'Metal Capixaba Fest', SAT, 2, 22, ['metal-punk-goth', 'rock-indie'], ['Ferrugem Atômica', 'Ondas Curtas'], [40, 60], 67),
  e('correria-music-bar', 'Pós-punk 80', SAT, 3, 22, ['metal-punk-goth', 'rock-indie'], ['Cripta Neon'], [20, 20], 53),
  // Casa Maré (fictional)
  e('casa-mare', 'Maré Alta', FRI, 0, 22, ['eletronica-house', 'pop-hits'], ['DJ Maresia'], [35, 50], 78),
  e('casa-mare', 'Quinta Sertaneja', THU, 0, 21, ['sertanejo'], ['Duo Moqueca'], [25, 35], 60),
  e('casa-mare', 'Maré Alta', SAT, 1, 22, ['eletronica-house'], ['DJ Maresia', 'DJ Noite Alta'], [35, 50], 84),
  e('casa-mare', 'Voz e Violão na Maré', THU, 1, 20, ['karaoke-ao-vivo'], ['Ana Tereza & Viola'], 'free', 46),
  e('casa-mare', 'Quinta Sertaneja', THU, 2, 21, ['sertanejo'], ['Duo Moqueca', 'Ana Tereza & Viola'], [25, 35], 62),
  e('casa-mare', 'Maré de Neon', SAT, 3, 22, ['eletronica-house', 'pop-hits'], ['DJ Maresia', 'Lia Sol'], [40, 60], 86),
  e('casa-mare', 'Festa Rascunho', FRI, 3, 22, ['pop-hits'], ['DJ Caju'], [30, 30], 40, 'draft'),
];

const PAST: EventSpec[] = [
  // Casa Caipora (closed; history only)
  e('casa-caipora', 'Despedida da Caipora', FRI, 3, 21, ['pagode-samba', 'hip-hop-rnb'], ['Maria Goiaba', 'Soul de Jucutuquara', 'Rimas de Camburi'], [30, 40], 95),
  e('casa-caipora', 'Samba na Caipora', SAT, 6, 19, ['pagode-samba'], ['Sereno da Ilha'], [20, 20], 74),
  e('casa-caipora', 'Rap na Caipora', FRI, 10, 22, ['hip-hop-rnb'], ['Rimas de Camburi'], [15, 20], 66),
  e('casa-caipora', 'Caipora Eletrônica', SAT, 15, 23, ['eletronica-house'], ['DJ Taí Ruiz'], [25, 35], 70),
  e('casa-caipora', 'Samba na Caipora', SAT, 22, 19, ['pagode-samba'], ['Maria Goiaba'], 'free', 62),
  // Bolt
  e('bolt', 'Lovy Bolt', FRI, 1, 23, ['pop-hits'], ['DJ Caju', 'Lia Sol'], [30, 40], 86),
  e('bolt', 'Bolt Indie Club', SAT, 2, 23, ['rock-indie'], ['Os Noctâmbulos'], [35, 45], 72),
  e('bolt', 'Show Cancelado', SAT, 4, 23, ['metal-punk-goth'], ['Ferrugem Atômica'], [30, 30], 20, 'cancelled'),
  e('bolt', 'Lovy Bolt', FRI, 5, 23, ['pop-hits'], ['DJ Caju'], [30, 40], 84),
  e('bolt', 'Funk na Penha', SAT, 9, 23, ['funk'], ['MC Lua Cheia'], [30, 40], 80),
  e('bolt', 'Retrô Bolt', FRI, 14, 23, ['pop-hits', 'rock-indie'], ['Vapor 80'], [35, 50], 68),
  // A Selva
  e('a-selva', 'Discotopia', FRI, 1, 23, ['eletronica-house'], ['Coletivo Mangue Disco'], [40, 60], 90),
  e('a-selva', 'Noite do Pagodão', SAT, 3, 22, ['pagode-samba'], ['Sereno da Ilha'], [20, 30], 78),
  e('a-selva', 'Discotopia', FRI, 7, 23, ['eletronica-house'], ['DJ Taí Ruiz', 'Coletivo Mangue Disco'], [40, 60], 88),
  e('a-selva', 'Baile da Selva', SAT, 12, 23, ['funk', 'hip-hop-rnb'], ['MC Vitória Régia'], [30, 50], 83),
  e('a-selva', 'Discotopia', FRI, 18, 23, ['eletronica-house'], ['DJ Noite Alta'], [40, 60], 85),
  e('a-selva', 'Carnaval na Selva', SAT, 24, 20, ['pagode-samba', 'funk'], ['Maria Goiaba', 'DJ Pedra Azul'], [30, 60], 93),
  // Gordinho
  e('gordinho', 'Pagode de Sábado', SAT, 1, 18, ['pagode-samba'], ['Grupo Pé na Areia'], [20, 30], 79),
  e('gordinho', 'Quinta do Samba', THU, 4, 20, ['pagode-samba'], ['Maria Goiaba'], 'free', 66),
  e('gordinho', 'Pagode de Sábado', SAT, 11, 18, ['pagode-samba'], ['Sereno da Ilha', 'Grupo Pé na Areia'], [20, 30], 77),
  // Pub 426
  e('pub-426', 'Karaokê de Quarta', WED, 1, 21, ['karaoke-ao-vivo'], ['Karaokê do Zé'], 'free', 53),
  e('pub-426', 'Anos 80 & 90', FRI, 6, 22, ['rock-indie', 'pop-hits'], ['Vapor 80'], [25, 35], 73),
  e('pub-426', 'Rock no Pub', SAT, 16, 22, ['rock-indie'], ['Ondas Curtas'], [20, 30], 61),
  // Correria Music Bar
  e('correria-music-bar', 'Noite Gótica', SAT, 2, 22, ['metal-punk-goth'], ['Cripta Neon'], [20, 30], 58),
  e('correria-music-bar', 'Hardcore na Itaparica', FRI, 8, 22, ['metal-punk-goth'], ['Ferrugem Atômica'], [15, 25], 55),
  e('correria-music-bar', 'Metal Capixaba Fest', SAT, 20, 22, ['metal-punk-goth'], ['Ferrugem Atômica', 'Cripta Neon'], [40, 60], 69),
  // Casa Maré
  e('casa-mare', 'Maré Alta', FRI, 1, 22, ['eletronica-house', 'pop-hits'], ['DJ Maresia'], [35, 50], 77),
  e('casa-mare', 'Quinta Sertaneja', THU, 5, 21, ['sertanejo'], ['Duo Moqueca'], [25, 35], 59),
  e('casa-mare', 'Maré Alta', SAT, 13, 22, ['eletronica-house'], ['DJ Maresia', 'DJ Noite Alta'], [35, 50], 82),
  e('casa-mare', 'Maré de Verão', FRI, 25, 22, ['pop-hits'], ['Lia Sol'], [30, 40], 75),
  // Fluente
  e('fluente', 'Match', SAT, 2, 22, ['pop-hits', 'funk', 'sertanejo'], ['DJ Caju'], [30, 50], 80),
  e('fluente', 'Fluente Funk', FRI, 9, 22, ['funk'], ['MC Vitória Régia'], [25, 40], 72),
];

// ---------------------------------------------------------------------------
// Date helpers (America/Sao_Paulo has no DST since 2019: fixed UTC-3)
// ---------------------------------------------------------------------------
const TZ_OFFSET_H = 3;
const DAY = 86_400_000;

function localMidnightUtcMs(now: Date): { ms: number; dow: number } {
  const local = new Date(now.getTime() - TZ_OFFSET_H * 3_600_000);
  const ms = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate());
  return { ms, dow: local.getUTCDay() };
}

/** n-th (0-based) occurrence of `weekday` at `hour` that starts after `now` (today counts). */
function upcomingStart(now: Date, weekday: number, n: number, hour: number): Date {
  const { ms, dow } = localMidnightUtcMs(now);
  let days = (weekday - dow + 7) % 7;
  const at = (d: number) => ms + d * DAY + (hour + TZ_OFFSET_H) * 3_600_000;
  if (at(days) <= now.getTime()) days += 7;
  return new Date(at(days + 7 * n));
}

/** `weeksAgo`-th (1-based) occurrence of `weekday` strictly before today's local date. */
function pastStart(now: Date, weekday: number, weeksAgo: number, hour: number): Date {
  const { ms, dow } = localMidnightUtcMs(now);
  const days = ((dow - weekday + 7) % 7 || 7) + 7 * (weeksAgo - 1);
  return new Date(ms - days * DAY + (hour + TZ_OFFSET_H) * 3_600_000);
}

// ---------------------------------------------------------------------------
/**
 * Casa Maré demo events relative to `now`, so Ao vivo / Avaliar can always be exercised
 * (in progress, starting in ~2h, just ended). Included by default so seed.json and the fixed-now fixtures agree.
 */
const DEMO_LIVE: { key: string; title: string; startH: number; endH: number; genres: string[]; artists: string[]; price: [number, number]; popularity: number }[] = [
  { key: 'agora', title: 'Maré Cheia', startH: -1, endH: 4, genres: ['eletronica-house', 'pop-hits'], artists: ['DJ Maresia'], price: [35, 50], popularity: 90 },
  { key: 'em-breve', title: 'Maré Vazante', startH: 2, endH: 7, genres: ['pop-hits'], artists: ['Lia Sol'], price: [30, 40], popularity: 80 },
  { key: 'encerrado', title: 'Maré Baixa', startH: -8, endH: -3, genres: ['sertanejo'], artists: ['Duo Moqueca'], price: [25, 35], popularity: 70 },
];

export function buildSeed(now: Date, opts: { demoLive?: boolean } = { demoLive: true }): SeedDataset {
  const genres: Genre[] = GENRES.map(([slug, label]) => ({ id: genreId(slug), slug, label }));

  const venues: Venue[] = VENUES.map((v) => ({
    ...v,
    id: venueId(v.slug),
    genreSlugs: sortGenres(v.genreSlugs),
    placeholder: true,
  }));
  const venueBySlug = new Map(venues.map((v) => [v.slug, v]));

  const artists: Artist[] = ARTISTS.map(([name, g]) => {
    const slug = slugify(name);
    return { id: artistId(slug), slug, name, genreSlugs: sortGenres(g) };
  });
  const artistByName = new Map(artists.map((a) => [a.name, a]));

  const toEvent = (s: EventSpec, kind: 'w' | 'p'): EventItem => {
    const venue = venueBySlug.get(s.venue);
    if (!venue) throw new Error(`unknown venue ${s.venue}`);
    for (const g of s.genres) if (!GENRE_ORDER.has(g)) throw new Error(`unknown genre ${g}`);
    const key = `${s.venue}-${slugify(s.title)}-${kind}${s.n}`;
    const start = kind === 'w'
      ? upcomingStart(now, s.weekday, s.n, s.hour)
      : pastStart(now, s.weekday, s.n, s.hour);
    const end = new Date(start.getTime() + 5 * 3_600_000);
    const isFree = s.price === 'free';
    const priceMin = Array.isArray(s.price) ? s.price[0] : isFree ? 0 : null;
    const priceMax = Array.isArray(s.price) ? s.price[1] : isFree ? 0 : null;
    const artistIds = s.artists.map((name) => {
      const a = artistByName.get(name);
      if (!a) throw new Error(`unknown artist ${name}`);
      return a.id;
    });
    const ev: EventItem = {
      id: eventId(key),
      title: s.title,
      venueId: venue.id,
      startsAt: start.toISOString(),
      endsAt: end.toISOString(),
      priceMin,
      priceMax,
      isFree,
      ageMin: 18,
      genreSlugs: sortGenres(s.genres),
      artistIds,
      status: s.status ?? 'published',
      coverKey: coverFor({ genreSlugs: sortGenres(s.genres), venueSlug: venue.slug, eventId: eventId(key) }),
      popularity: s.popularity,
    };
    if (!isFree) ev.ticketUrl = `https://example.com/ingressos/${key}`;
    return ev;
  };

  const demoLive: EventItem[] = opts.demoLive
    ? DEMO_LIVE.map((d) => {
        const venue = venueBySlug.get('casa-mare');
        if (!venue) throw new Error('casa-mare missing');
        return {
          id: eventId(`casa-mare-demo-${d.key}`),
          title: d.title,
          venueId: venue.id,
          startsAt: new Date(now.getTime() + d.startH * 3_600_000).toISOString(),
          endsAt: new Date(now.getTime() + d.endH * 3_600_000).toISOString(),
          priceMin: d.price[0],
          priceMax: d.price[1],
          isFree: false,
          ageMin: 18,
          genreSlugs: sortGenres(d.genres),
          artistIds: d.artists.map((n) => {
            const a = artistByName.get(n);
            if (!a) throw new Error(`unknown artist ${n}`);
            return a.id;
          }),
          status: 'published' as const,
          coverKey: coverFor({ genreSlugs: d.genres, venueSlug: venue.slug, eventId: eventId(`casa-mare-demo-${d.key}`) }),
          popularity: d.popularity,
          ticketUrl: `https://example.com/ingressos/casa-mare-demo-${d.key}`,
        };
      })
    : [];

  const events = [
    ...UPCOMING.map((s) => toEvent(s, 'w')),
    ...PAST.map((s) => toEvent(s, 'p')),
    ...demoLive,
  ].sort((a, b) => a.startsAt.localeCompare(b.startsAt) || a.id.localeCompare(b.id));

  const ids = new Set<string>();
  for (const x of [...genres, ...venues, ...artists, ...events]) {
    if (ids.has(x.id)) throw new Error(`duplicate id ${x.id}`);
    ids.add(x.id);
  }

  return { generatedAt: now.toISOString(), genres, venues, artists, events };
}
