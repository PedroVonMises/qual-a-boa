import type { TicketTopic } from '@/domain/engage';

export interface FaqItem {
  id: string;
  topic: TicketTopic;
  question: string;
  answer: string;
  /** Extra words people type that are not in the question. */
  keywords?: string[];
}

/** Static pt-BR help content. No backend. */
export const FAQ: FaqItem[] = [
  {
    id: 'ingresso-nao-abre',
    topic: 'ingresso',
    question: 'Meu ingresso não abre',
    answer:
      'O Qual a boa? não vende ingressos: o link abre o site da casa ou do vendedor. Tente de novo com outra conexão e confira o e-mail da compra. Se o problema continuar, abra um chamado com o nome do evento.',
    keywords: ['ticket', 'link', 'comprei', 'tela branca', 'qr'],
  },
  {
    id: 'evento-mudou',
    topic: 'evento',
    question: 'O evento mudou ou foi cancelado',
    answer:
      'Quando uma casa avisa mudança de data, horário ou cancelamento, o evento aparece com o aviso na página dele. Acompanhe o evento para ser avisado das mudanças. Reembolso é tratado com quem vendeu o ingresso.',
    keywords: ['cancelado', 'data', 'horário', 'reembolso', 'adiado'],
  },
  {
    id: 'info-errada',
    topic: 'casa',
    question: 'Informação errada de uma casa',
    answer:
      'Endereço, horário ou preço errado? Abra um chamado escolhendo "Informação errada" e diga o que está diferente. Uma foto da fachada ou do cardápio ajuda.',
    keywords: ['endereço', 'telefone', 'horário', 'preço', 'fechou'],
  },
  {
    id: 'apagar-dados',
    topic: 'conta',
    question: 'Apagar meus dados (LGPD)',
    answer:
      'Você pode pedir a exclusão ou uma cópia dos seus dados a qualquer momento. Abra um chamado em "Conta, dados ou outro" com o pedido. Por segurança, nunca enviamos nem pedimos senha ou dados de cartão.',
    keywords: ['lgpd', 'privacidade', 'excluir', 'conta', 'cópia'],
  },
  {
    id: 'denunciar-avaliacao',
    topic: 'seguranca',
    question: 'Denunciar uma avaliação',
    answer:
      'Avaliações com ofensa, dados pessoais ou que não parecem de quem foi ao evento podem ser denunciadas. Abra um chamado com o assunto "Segurança ou denúncia" e conte qual avaliação é.',
    keywords: ['review', 'ofensa', 'falsa', 'abuso', 'denúncia'],
  },
  {
    id: 'seguranca-local',
    topic: 'seguranca',
    question: 'Me senti inseguro(a) em um evento',
    answer:
      'Em caso de emergência, ligue 190. Depois, conte o que aconteceu em um chamado com o assunto "Segurança ou denúncia": usamos os relatos para revisar a casa na plataforma.',
    keywords: ['assédio', 'briga', 'perigo', 'emergência'],
  },
  {
    id: 'check-in',
    topic: 'evento',
    question: 'Por que não consigo avaliar ou reportar a fila?',
    answer:
      'Avaliações "Foi ao evento" e relatos ao vivo exigem check-in no evento, para manter o conteúdo confiável. Faça o check-in na página do evento quando estiver no local.',
    keywords: ['check-in', 'fila', 'ao vivo', 'avaliar'],
  },
];

export const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim();

/** Every query word must match the question, answer or a keyword (accent-insensitive). */
export function searchFaq(query: string, items: FaqItem[] = FAQ): FaqItem[] {
  const words = normalize(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return items;
  return items.filter((it) => {
    const hay = normalize([it.question, it.answer, ...(it.keywords ?? [])].join(' '));
    return words.every((w) => hay.includes(w));
  });
}

/** The topics shown before the user types anything. */
export const COMMON_FAQ_IDS = ['ingresso-nao-abre', 'evento-mudou', 'info-errada', 'apagar-dados', 'denunciar-avaliacao'];
export const commonFaq = (): FaqItem[] => COMMON_FAQ_IDS.map((id) => FAQ.find((f) => f.id === id)!).filter(Boolean);
