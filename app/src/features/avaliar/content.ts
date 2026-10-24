import type { ReviewTopic } from '@/domain/engage';

export const TOPICS: { key: ReviewTopic; label: string }[] = [
  { key: 'musica', label: 'Som' },
  { key: 'ambiente', label: 'Ambiente' },
  { key: 'atendimento', label: 'Atendimento' },
  { key: 'seguranca', label: 'Segurança' },
  { key: 'preco', label: 'Preço' },
  { key: 'fila', label: 'Fila' },
];

export const TOPIC_LABEL = Object.fromEntries(TOPICS.map((t) => [t.key, t.label])) as Record<ReviewTopic, string>;

export const TAGS = ['Música boa', 'Fila grande', 'Bebida cara', 'Ambiente lotado', 'Atendimento bom', 'Me senti seguro', 'Preço justo'];

export const RATING_WORDS = ['', 'Ruim', 'Fraco', 'Ok', 'Muito bom', 'Excelente'] as const;
