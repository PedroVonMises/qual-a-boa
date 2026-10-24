import type { CoverTemplateId } from '@/domain/cover';
import { Disco, Drink, Equalizador, Galera, Guitarra, Lua, Neon, Raio, Vinil } from './objects';
import { Arcos, Ondas, Palmas, Penha, Ponte, SolMare, Skyline } from './scenes';
import type { Template } from './kit';

export type { Template, TemplateProps } from './kit';

export const TEMPLATES: Record<CoverTemplateId, Template> = {
  'sol-mare': SolMare,
  disco: Disco,
  raio: Raio,
  lua: Lua,
  vinil: Vinil,
  guitarra: Guitarra,
  equalizador: Equalizador,
  galera: Galera,
  neon: Neon,
  drink: Drink,
  palmas: Palmas,
  arcos: Arcos,
  ondas: Ondas,
  ponte: Ponte,
  penha: Penha,
  skyline: Skyline,
};
