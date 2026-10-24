export function fold(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

const TITLE_STOP = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'a', 'o', 'as', 'os', 'com', 'no', 'na', 'em', 'the', 'and', 'ao', 'vivo', 'noite', 'night', 'festa']);

/** Significant tokens of a title for similarity (folded, no punctuation, no filler words). */
export function titleTokens(s: string): string[] {
  const t = fold(s).split(/[^a-z0-9]+/).filter((w) => w.length > 0 && !TITLE_STOP.has(w));
  return [...new Set(t)];
}

export function jaccard(a: string[], b: string[]): number {
  if (a.length === 0 && b.length === 0) return 1;
  const sa = new Set(a);
  const sb = new Set(b);
  let inter = 0;
  for (const x of sa) if (sb.has(x)) inter++;
  const union = sa.size + sb.size - inter;
  return union === 0 ? 0 : inter / union;
}

export const titleSimilarity = (a: string, b: string) => jaccard(titleTokens(a), titleTokens(b));

export function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)));
}

export const clean = (s: string) => decodeEntities(s).replace(/\s+/g, ' ').trim();
