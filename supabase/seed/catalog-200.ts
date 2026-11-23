/**
 * Deterministic 212-venue expansion catalog for Grande Vitória / ES.
 * Combined with the 8 pilot venues in seed-data.ts => 220 unique, validated, realistic venues.
 * Every coordinate stays inside Grande Vitória PILOT_BOUNDS [-40.45, -20.45, -40.15, -20.15].
 * ALL DATA IS PLACEHOLDER / CURATED DEMO CATALOG.
 */
import type { AccessTag } from '../../app/src/domain/accessTags';
import { hashString, venueCoverFor } from '../../app/src/domain/cover';
import type { PriceRange, Venue, VenueStatus } from '../../app/src/domain/types';

export type CatalogVenueSpec = Omit<Venue, 'id' | 'placeholder' | 'updatedAt'>;

interface ZoneDef {
  area: string;
  city: string;
  lat: number;
  lng: number;
  spreadLat: number;
  spreadLng: number;
  streets: readonly string[];
}

const ZONES: readonly ZoneDef[] = [
  {
    area: 'Praia do Canto', city: 'Vitória', lat: -20.2965, lng: -40.2945, spreadLat: 0.0065, spreadLng: 0.0065,
    streets: ['R. Joaquim Lírio', 'R. João da Cruz', 'R. Aleixo Netto', 'Av. Saturnino de Brito', 'R. Celso Calmon', 'R. Moacyr Avidos'],
  },
  {
    area: 'Jardim da Penha', city: 'Vitória', lat: -20.2795, lng: -40.2935, spreadLat: 0.0075, spreadLng: 0.0075,
    streets: ['R. Darcy Grijó', 'Av. Anísio Fernandes Coelho', 'R. Francisco Generoso da Fonseca', 'Av. Hugo Viola', 'R. Arthur Czartoryski'],
  },
  {
    area: 'Centro', city: 'Vitória', lat: -20.3195, lng: -40.3375, spreadLat: 0.0065, spreadLng: 0.0075,
    streets: ['R. Sete de Setembro', 'Av. Jerônimo Monteiro', 'R. Gama Rosa', 'R. Graciano Neves', 'R. do Rosário', 'Av. República'],
  },
  {
    area: 'Jardim Camburi', city: 'Vitória', lat: -20.2565, lng: -40.2685, spreadLat: 0.0085, spreadLng: 0.0085,
    streets: ['Av. Dante Michelini', 'R. Carlos Martins', 'R. Gelu Vervloet dos Santos', 'R. Filogônio Motta', 'Av. Munir Hilal'],
  },
  {
    area: 'Camburi', city: 'Vitória', lat: -20.2735, lng: -40.2815, spreadLat: 0.006, spreadLng: 0.0065,
    streets: ['Av. Dante Michelini', 'Av. Adalberto Simão Nader', 'R. Eugênio Netto', 'Av. Fernando Ferrari'],
  },
  {
    area: 'Mata da Praia', city: 'Vitória', lat: -20.2675, lng: -40.2895, spreadLat: 0.0055, spreadLng: 0.006,
    streets: ['Av. Desembargador Dermeval Lyrio', 'R. Aristóbulo Barbosa Leão', 'R. Carlos Eduardo Monteiro de Lemos'],
  },
  {
    area: 'Santa Lúcia', city: 'Vitória', lat: -20.3035, lng: -40.3035, spreadLat: 0.005, spreadLng: 0.0055,
    streets: ['Av. Rio Branco', 'Av. Leitão da Silva', 'R. Constante Sodré', 'R. José Teixeira'],
  },
  {
    area: 'Bento Ferreira', city: 'Vitória', lat: -20.3155, lng: -40.3015, spreadLat: 0.005, spreadLng: 0.0055,
    streets: ['Av. Cezar Hilal', 'Av. Marechal Mascarenhas de Moraes', 'R. Chafic Murad', 'R. Amélia da Cunha Ornelas'],
  },
  {
    area: 'Enseada do Suá', city: 'Vitória', lat: -20.3125, lng: -40.2895, spreadLat: 0.005, spreadLng: 0.0055,
    streets: ['Av. Nossa Senhora dos Navegantes', 'R. Clóvis Machado', 'R. Duckla de Aguiar', 'R. José Alexandre Buaiz'],
  },
  {
    area: 'Praia da Costa', city: 'Vila Velha', lat: -20.3345, lng: -40.2815, spreadLat: 0.0075, spreadLng: 0.007,
    streets: ['Av. Antônio Gil Veloso', 'Av. Champagnat', 'R. Henrique Moscoso', 'R. Pernambuco', 'R. Diógenes Malacarne'],
  },
  {
    area: 'Itapuã', city: 'Vila Velha', lat: -20.3485, lng: -40.2855, spreadLat: 0.0065, spreadLng: 0.0065,
    streets: ['Av. São Paulo', 'Av. Jair de Andrade', 'R. Belo Horizonte', 'R. Goiânia', 'Av. Hugo Musso'],
  },
  {
    area: 'Vila Velha', city: 'Vila Velha', lat: -20.3625, lng: -40.2895, spreadLat: 0.0085, spreadLng: 0.008,
    streets: ['Av. Est. José Júlio de Souza', 'Rod. do Sol', 'R. Humberto Serrano', 'Av. Santa Leopoldina', 'R. Itaoca'],
  },
  {
    area: 'Glória', city: 'Vila Velha', lat: -20.3415, lng: -40.3085, spreadLat: 0.0055, spreadLng: 0.006,
    streets: ['Av. Jerônimo Monteiro', 'R. Aurora', 'R. Santa Rosa', 'Av. Carlos Lindemberg'],
  },
  {
    area: 'Prainha', city: 'Vila Velha', lat: -20.3295, lng: -40.2925, spreadLat: 0.0045, spreadLng: 0.0045,
    streets: ['R. Antônio Ataíde', 'R. Luciano das Neves', 'Praça Almirante Tamandaré', 'R. Vasco Coutinho'],
  },
  {
    area: 'Laranjeiras', city: 'Serra', lat: -20.1975, lng: -40.2525, spreadLat: 0.0075, spreadLng: 0.008,
    streets: ['Av. Central', 'Av. Civit', 'R. Castro Alves', 'Av. Eudes Scherrer de Souza', 'R. Coelho Neto'],
  },
  {
    area: 'Colina de Laranjeiras', city: 'Serra', lat: -20.2055, lng: -40.2445, spreadLat: 0.006, spreadLng: 0.0065,
    streets: ['Av. Braúna', 'R. das Acácias', 'Av. Eldes Scherrer Souza', 'R. Jatobá'],
  },
  {
    area: 'Manguinhos', city: 'Serra', lat: -20.1925, lng: -40.2015, spreadLat: 0.0055, spreadLng: 0.006,
    streets: ['Av. Atapoã', 'R. dos Pescadores', 'Av. Beira Mar', 'R. Ocidente'],
  },
  {
    area: 'Jacaraípe', city: 'Serra', lat: -20.1685, lng: -40.1895, spreadLat: 0.007, spreadLng: 0.007,
    streets: ['Av. Abido Saadi', 'Av. Nossa Senhora dos Navegantes', 'R. São Pedro', 'Av. Minas Gerais'],
  },
  {
    area: 'Campo Grande', city: 'Cariacica', lat: -20.3435, lng: -40.3885, spreadLat: 0.0075, spreadLng: 0.008,
    streets: ['Av. Expedito Garcia', 'R. Santa Marta', 'Av. Campo Grande', 'R. Bolívia', 'R. Leopoldina'],
  },
  {
    area: 'Itacibá', city: 'Cariacica', lat: -20.3275, lng: -40.3715, spreadLat: 0.006, spreadLng: 0.0065,
    streets: ['Av. Mário Gurgel', 'R. Manoel Joaquim dos Santos', 'Av. Getúlio Vargas', 'R. São João'],
  },
];

interface Archetype {
  prefix: string;
  genres: readonly string[];
  priceRange: PriceRange;
  hours: string;
  adultOnly: boolean;
  tags: readonly AccessTag[];
}

const ARCHETYPES: readonly Archetype[] = [
  { prefix: 'Club', genres: ['eletronica-house', 'pop-hits'], priceRange: '$$$', hours: 'Sex e sáb, 23h–06h', adultOnly: true, tags: ['lgbtqia', 'acessivel'] },
  { prefix: 'Lounge', genres: ['eletronica-house', 'hip-hop-rnb', 'pop-hits'], priceRange: '$$$', hours: 'Qui a sáb, 21h–04h', adultOnly: true, tags: ['acessivel'] },
  { prefix: 'Quintal', genres: ['pagode-samba', 'forro-tecnobrega'], priceRange: '$$', hours: 'Qui a dom, 18h–02h', adultOnly: false, tags: ['pet-friendly'] },
  { prefix: 'Boteco', genres: ['pagode-samba', 'sertanejo'], priceRange: '$', hours: 'Qua a dom, 17h–01h', adultOnly: false, tags: ['pet-friendly', 'acessivel'] },
  { prefix: 'Pub', genres: ['rock-indie', 'karaoke-ao-vivo'], priceRange: '$$', hours: 'Qua a sáb, 20h–03h', adultOnly: true, tags: ['vegano'] },
  { prefix: 'Arena', genres: ['sertanejo', 'funk', 'pagode-samba'], priceRange: '$$$', hours: 'Sex e sáb, 22h–05h', adultOnly: true, tags: ['acessivel'] },
  { prefix: 'Porão', genres: ['metal-punk-goth', 'rock-indie'], priceRange: '$', hours: 'Sex e sáb, 22h–04h', adultOnly: true, tags: ['vegano', 'lgbtqia'] },
  { prefix: 'Casa', genres: ['forro-tecnobrega', 'pagode-samba', 'pop-hits'], priceRange: '$$', hours: 'Qui a sáb, 21h–04h', adultOnly: true, tags: ['lgbtqia', 'vegano'] },
  { prefix: 'Terraço', genres: ['eletronica-house', 'pop-hits', 'funk'], priceRange: '$$$$', hours: 'Sex a dom, 19h–04h', adultOnly: true, tags: ['acessivel', 'vegano'] },
  { prefix: 'Baile', genres: ['funk', 'hip-hop-rnb'], priceRange: '$$', hours: 'Sex e sáb, 23h–06h', adultOnly: true, tags: ['lgbtqia'] },
  { prefix: 'Espaço', genres: ['karaoke-ao-vivo', 'pop-hits', 'rock-indie'], priceRange: '$$', hours: 'Qua a sáb, 20h–03h', adultOnly: false, tags: ['acessivel', 'pet-friendly'] },
  { prefix: 'Galpão', genres: ['eletronica-house', 'funk', 'rock-indie'], priceRange: '$$', hours: 'Sex e sáb, 22h–05h', adultOnly: true, tags: ['lgbtqia', 'acessivel'] },
  { prefix: 'Estação', genres: ['forro-tecnobrega', 'sertanejo'], priceRange: '$', hours: 'Qui a sáb, 20h–03h', adultOnly: false, tags: ['acessivel'] },
  { prefix: 'Bunker', genres: ['metal-punk-goth', 'eletronica-house'], priceRange: '$$', hours: 'Sex e sáb, 23h–06h', adultOnly: true, tags: ['lgbtqia'] },
  { prefix: 'Mirante', genres: ['pagode-samba', 'pop-hits', 'eletronica-house'], priceRange: '$$$', hours: 'Sex a dom, 17h–02h', adultOnly: false, tags: ['pet-friendly', 'vegano'] },
  { prefix: 'Garagem', genres: ['rock-indie', 'hip-hop-rnb', 'metal-punk-goth'], priceRange: '$', hours: 'Qui a sáb, 21h–03h', adultOnly: true, tags: ['vegano'] },
];

// 212 distinct, evocative Brazilian/Capixaba venue proper names (no repeats, no "Sinner", none colliding with the 8 pilot venues).
const VENUE_THEMES: readonly string[] = [
  'Convento', 'Maresia', 'Atlântico', 'Vitória Régia', 'Pedra Azul', 'Terceira Ponte', 'Brisa do Mar', 'Capixaba',
  'Moqueca Beats', 'Pôr do Sol', 'Ilha do Boi', 'Ilha do Frade', 'Farol Santa Luzia', 'Manguezal', 'Costa Dourada',
  'Onda Sonora', 'Marola', 'Tropicália', 'Litoral Sul', 'Vento Leste', 'Baía Azul', 'Cais das Artes', 'Porto Novo',
  'Canoa Quebrada', 'Lua Nova', 'Estrela Dalva', 'Horizonte', 'Sereia', 'Coral Vivo', 'Pontal', 'Barra do Jucu',
  'Curva da Jurema', 'Praia Secreta', 'Rota do Sol', 'Avenida 27', 'Noite Clara', 'Som da Ilha', 'Pista 027',
  'Frequência', 'Subsolo', 'Vibe Tropical', 'Cajuína', 'Pitanga', 'Goiabeira', 'Aroeira', 'Castanheira',
  'Jacarandá', 'Ipê Amarelo', 'Orquídea', 'Bromélia', 'Coqueiral', 'Palmeira Real', 'Bambuí', 'Jequitibá',
  'Mangabeira', 'Cajueiro', 'Tabuleiro', 'Lagoa Mansa', 'Rio Marinho', 'Vale Encantado', 'Morro Moreno',
  'Alto da Penha', 'Fonte Grande', 'Pedra da Cebola', 'Parque Moscoso', 'Escadaria', 'Beco do Carmo',
  'Largo da Lapa', 'Praça Oito', 'Cais do Porto', 'Doca 14', 'Armazém 09', 'Estaleiro', 'Marina Sul',
  'Ancoradouro', 'Maré Viva', 'Quebra-Mar', 'Recife', 'Areia Branca', 'Dunas', 'Foz do Rio', 'Cachoeira',
  'Serra Alta', 'Mestre Álvaro', 'Cume', 'Nevoeiro', 'Alvorada', 'Crepúsculo', 'Meia-Noite', 'Madrugada',
  'Aurora Boreal', 'Eclipse', 'Cometa', 'Órbita', 'Constelação', 'Satélite', 'Galáxia', 'Nebulosa',
  'Pulsar', 'Sintonia', 'Vinil 78', 'Fita K7', 'Toca-Discos', 'Amplificador', 'Subwoofer', 'Batida Forte',
  'Grave Pesado', 'Ritmo Livre', 'Compassos', 'Sinfonia Urbana', 'Acústico 27', 'Palco Aberto', 'Backstage',
  'Camarote Real', 'Pista Central', 'Mezanino', 'Varanda Alta', 'Cobertura', 'Rooftop 360', 'Deck do Mar',
  'Quiosque 12', 'Choperia Imperial', 'Alambique', 'Cachaçaria Fina', 'Destilaria', 'Tonel 44', 'Barril Novo',
  'Malte Forte', 'Lúpulo', 'Cervejaria da Ilha', 'Taça Cheia', 'Coquetelaria', 'Negroni', 'Mojito',
  'Caipirinha Club', 'Gengibre', 'Cardamomo', 'Canela', 'Pimenta Rosa', 'Alecrim', 'Hortelã', 'Cítrico',
  'Âmbar', 'Rubi', 'Safira', 'Esmeralda', 'Ônix', 'Quartzo', 'Ametista', 'Obsidiana', 'Veludo', 'Cetim',
  'Cobre', 'Bronze', 'Prata Viva', 'Ouro Negro', 'Neon Pulse', 'Laser', 'Estrobo', 'Fumaça', 'Espelho',
  'Caleidoscópio', 'Prisma', 'Mosaico', 'Vitral', 'Grafite', 'Mural', 'Ateliê', 'Oficina', 'Fábrica',
  'Usina', 'Caldeira', 'Forja', 'Serralheria', 'Fundição', 'Hangar 27', 'Terminal', 'Plataforma',
  'Vagão', 'Trilho', 'Viaduto', 'Arco-Íris', 'Ponte Seca', 'Passarela', 'Rotatória', 'Esquina',
  'Calçadão', 'Boulevard', 'Alameda', 'Travessa', 'Viela', 'Pátio', 'Claustro', 'Jardim Secreto',
  'Estufa', 'Orquidário', 'Pomar', 'Quinta Real', 'Solar', 'Casarão', 'Sobrado', 'Palacete',
  'Vila Antiga', 'Chácara', 'Rancho Fundo', 'Fazendinha', 'Sertão Vivo', 'Sanfona', 'Zabumba', 'Triângulo',
  'Pandeiro', 'Cavaquinho', 'Tamborim', 'Cuíca', 'Atabaque', 'Berimbau', 'Guitarra Sul', 'Baixo Elétrico',
];

function slugifyLocal(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' e ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Deterministic pseudo-random float in [-1, 1] from string key. */
function signedUnit(key: string): number {
  return (hashString(key) / 0xffffffff) * 2 - 1;
}

/**
 * Generates 212 unique, deterministic, realistic venues across Grande Vitória / ES.
 * Together with the 8 pilot venues => 220 total venues.
 */
export function buildExpandedVenues(): CatalogVenueSpec[] {
  const out: CatalogVenueSpec[] = [];
  const usedSlugs = new Set<string>([
    'bolt', 'a-selva', 'gordinho', 'pub-426', 'fluente', 'correria-music-bar', 'casa-caipora', 'casa-mare',
  ]);

  for (let i = 0; i < VENUE_THEMES.length; i++) {
    const theme = VENUE_THEMES[i];
    const zone = ZONES[i % ZONES.length];
    const arch = ARCHETYPES[(i * 5 + Math.floor(i / ZONES.length)) % ARCHETYPES.length];
    const name = `${arch.prefix} ${theme}`;
    const slug = slugifyLocal(name);
    if (usedSlugs.has(slug)) {
      throw new Error(`Expanded catalog slug collision: ${slug}`);
    }
    usedSlugs.add(slug);

    const h = hashString(`venue-spec:${slug}`);
    const street = zone.streets[h % zone.streets.length];
    const number = 40 + (h % 1480);
    const lat = Math.round((zone.lat + signedUnit(`${slug}|lat`) * zone.spreadLat) * 10_000) / 10_000;
    const lng = Math.round((zone.lng + signedUnit(`${slug}|lng`) * zone.spreadLng) * 10_000) / 10_000;

    // ~89% open, ~9% unverified, ~2% closed (3 closed extra + casa-caipora = 4 closed total)
    let status: VenueStatus = 'open';
    if (i === 55 || i === 123 || i === 189) status = 'closed';
    else if (i % 11 === 4) status = 'unverified';

    const genreSlugs = [...arch.genres];
    // Add occasional secondary flavor genre for variety
    const bonusGenres = ['funk', 'pagode-samba', 'eletronica-house', 'pop-hits', 'rock-indie', 'sertanejo', 'hip-hop-rnb', 'forro-tecnobrega'];
    const bonus = bonusGenres[(h >>> 4) % bonusGenres.length];
    if (genreSlugs.length < 3 && !genreSlugs.includes(bonus) && (h & 1) === 0) {
      genreSlugs.push(bonus);
    }

    const accessTags: AccessTag[] = [...arch.tags];
    if ((h % 5) === 0 && !accessTags.includes('acessivel')) accessTags.push('acessivel');
    if ((h % 7) === 0 && !accessTags.includes('pet-friendly')) accessTags.push('pet-friendly');

    out.push({
      slug,
      name,
      area: zone.area,
      city: zone.city,
      uf: 'ES',
      address: `${street}, ${number} - ${zone.area}`,
      lat,
      lng,
      status,
      adultOnly: arch.adultOnly,
      genreSlugs,
      accessTags,
      priceRange: arch.priceRange,
      hours: status === 'closed' ? 'Atividades encerradas' : arch.hours,
      coverKey: venueCoverFor({ genreSlugs, venueSlug: slug }),
    });
  }

  return out;
}

export const EXTRA_ARTISTS: readonly [name: string, genres: string[]][] = [
  ['DJ Capixaba', ['funk', 'eletronica-house']],
  ['Banda Ilha Sonora', ['rock-indie', 'pop-hits']],
  ['Samba do Convento', ['pagode-samba']],
  ['MC Praia Grande', ['funk']],
  ['Dupla Vitória & Bento', ['sertanejo']],
  ['Coletivo Baía Bass', ['eletronica-house', 'hip-hop-rnb']],
  ['Forró Pé na Areia', ['forro-tecnobrega']],
  ['Vozes da Penha', ['karaoke-ao-vivo', 'pop-hits']],
  ['Sombra Metálica', ['metal-punk-goth']],
  ['DJ Costa Leste', ['eletronica-house']],
  ['Pagode da Curva', ['pagode-samba']],
  ['MC Brisa Norte', ['funk', 'hip-hop-rnb']],
  ['Banda Terceira Ponte', ['rock-indie']],
  ['Nando & Gabriela', ['sertanejo']],
  ['DJ Aurora Vix', ['pop-hits', 'eletronica-house']],
  ['Trio Manguezal', ['forro-tecnobrega', 'pagode-samba']],
  ['Roda de Samba do Cais', ['pagode-samba']],
  ['Grito Urbano', ['metal-punk-goth', 'rock-indie']],
  ['DJ Subsolo 027', ['eletronica-house']],
  ['Banda Marola', ['pop-hits', 'rock-indie']],
  ['MC Litoral', ['funk']],
  ['Cais do Hip-Hop', ['hip-hop-rnb']],
  ['Karaokê da Ilha', ['karaoke-ao-vivo']],
  ['Lucas & Matheus ES', ['sertanejo']],
  ['DJ Neon Pulse', ['eletronica-house', 'pop-hits']],
  ['Samba de Raiz VV', ['pagode-samba']],
  ['Os Caçadores de Vinil', ['rock-indie', 'hip-hop-rnb']],
  ['Brega Eletrizante', ['forro-tecnobrega']],
  ['MC Guarapari', ['funk']],
  ['Projeto Acústico Sul', ['karaoke-ao-vivo', 'sertanejo']],
  ['DJ Horizonte', ['eletronica-house']],
  ['Quinteto da Prainha', ['pagode-samba']],
  ['Fúria Atlântica', ['metal-punk-goth']],
  ['DJ Prisma', ['pop-hits', 'funk']],
  ['Banda Areia Branca', ['rock-indie', 'pop-hits']],
  ['Forró da Serra', ['forro-tecnobrega']],
  ['Rimas da Baía', ['hip-hop-rnb']],
  ['Carol & Tiago', ['sertanejo', 'karaoke-ao-vivo']],
  ['DJ Estrobo', ['eletronica-house', 'funk']],
  ['Grupo Alvorada', ['pagode-samba']],
];

export const EVENT_TITLE_TEMPLATES: Record<string, readonly string[]> = {
  funk: ['Baile da Ilha', 'Funk 027', 'Noite do Grave', 'Bailão Capixaba', 'Batida da Madrugada'],
  'pagode-samba': ['Roda de Samba', 'Pagode do Pôr do Sol', 'Samba na Varanda', 'Tardezinha do Pagode', 'Resenha do Samba'],
  sertanejo: ['Noite Sertaneja', 'Modão & Viola', 'Sertanejo Premium', 'Quinta do Modão', 'Farra Sertaneja'],
  'eletronica-house': ['Sunset House', 'Deep Vitória', 'Noite Eletrônica', 'Techno Underground', 'Groove na Pista'],
  'pop-hits': ['Pop Night 027', 'Hits da Pista', 'Festa Flashback', 'Noite Pop BR', 'Pista Quente'],
  'rock-indie': ['Indie Session', 'Rock na Ilha', 'Noite Alternativa', 'Guitarras ao Vivo', 'Garage Rock'],
  'metal-punk-goth': ['Noite Heavy', 'Underground Punk', 'Sombras & Metal', 'Hardcore Vix', 'Post-Punk Session'],
  'forro-tecnobrega': ['Forró Pé de Serra', 'Noite do Xote', 'Tecnobrega Party', 'Arrasta-Pé', 'Forró da Brisa'],
  'hip-hop-rnb': ['Sessão Hip-Hop', 'R&B & Groove', 'Batalha de Beats', 'Black Music Night', 'Trap & Boom Bap'],
  'karaoke-ao-vivo': ['Karaokê Aberto', 'Palco Livre', 'Voz & Violão', 'Noite Acústica', 'Canta Vitória'],
};
