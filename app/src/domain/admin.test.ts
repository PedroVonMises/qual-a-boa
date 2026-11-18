import {
  accountPlace,
  actionLabel,
  adminErrorMessage,
  ageLabel,
  formatCnpj,
  flagLabel,
  mapHiddenPost,
  mapIngestCandidate,
  mapOverview,
  mapPendingAccount,
  mapPendingEvent,
  mapSafetyReport,
  noteError,
  slaState,
} from './admin';

const NOW = new Date('2026-11-18T12:00:00Z');
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3_600_000).toISOString();

describe('admin domain', () => {
  it('maps server codes to pt-BR and unknown ones to the retry message', () => {
    expect(adminErrorMessage('not_staff')).toMatch(/só da equipe/);
    expect(adminErrorMessage('note_required')).toMatch(/motivo/);
    expect(adminErrorMessage('whatever')).toBe(adminErrorMessage('network'));
  });

  it('requires a reason of 3 to 500 characters', () => {
    expect(noteError('  ')).toMatch(/motivo/);
    expect(noteError('ok')).toMatch(/motivo/);
    expect(noteError('Data errada')).toBeNull();
    expect(noteError('x'.repeat(501))).toMatch(/500/);
  });

  it('formats the CNPJ and labels actions', () => {
    expect(formatCnpj('11222333000181')).toBe('11.222.333/0001-81');
    expect(formatCnpj('123')).toBe('123');
    expect(actionLabel('event_approve')).toBe('aprovou a festa');
    expect(actionLabel('something_new')).toBe('something new');
  });

  it('counts age and the 12 h SLA of safety reports', () => {
    expect(ageLabel(hoursAgo(0.1), NOW)).toBe('há 6 min');
    expect(ageLabel(hoursAgo(5.5), NOW)).toBe('há 5 h');
    expect(ageLabel(hoursAgo(72), NOW)).toBe('há 3 dias');
    expect(slaState(hoursAgo(2), NOW)).toEqual({ late: false, label: '10 h para responder' });
    expect(slaState(hoursAgo(11.5), NOW)).toEqual({ late: false, label: 'Menos de 1 h para responder' });
    expect(slaState(hoursAgo(13), NOW)).toEqual({ late: true, label: 'Prazo de 12 h vencido' });
  });

  it('describes where a pending casa is, flagging proposals without a map location', () => {
    const base = mapPendingAccount({
      id: 'a', venue_id: null, venue_name: null, cnpj: '1', legal_name: 'L', contact_name: 'C', whatsapp: 'W', created_at: hoursAgo(1),
      proposed_venue: { name: 'Bar Novo', address: 'Rua X, 1', city: 'Serra' },
    });
    expect(accountPlace(base)).toEqual({ title: 'Bar Novo', detail: 'Rua X, 1, Serra · sem localização no mapa', needsLocation: true });
    expect(accountPlace({ ...base, proposedVenue: { name: 'Bar Novo', lat: -20, lng: -40 } }))
      .toEqual({ title: 'Bar Novo', detail: null, needsLocation: false });
    expect(accountPlace({ ...base, venueId: 'v', venueName: 'Casa Maré' }).title).toBe('Casa Maré');
  });

  it('maps rows defensively', () => {
    expect(mapOverview(undefined)).toEqual({
      pendingEvents: 0, pendingAccounts: 0, safetySeals: 0, hiddenPosts: 0, openSafetyReports: 0, oldestSafetyReportAt: null, ingestPending: 0,
    });
    const e = mapPendingEvent({
      id: 'e', title: 'Noite', starts_at: 's', ends_at: null, venue_name: 'V', venue_slug: 'v', account_name: null, is_free: false,
      price_min: '30.00', price_max: null, ticket_url: null, age_min: 18, dress_code: '', poster_path: null, genre_slugs: null, submitted_at: 's',
    });
    expect(e.priceMin).toBe(30);
    expect(e.dressCode).toBeNull();
    expect(e.genreSlugs).toEqual([]);
    expect(mapHiddenPost({ kind: 'comment', id: 'c', thread_id: 't', title: null, body: 'b', anonymous: true, created_at: 'x', report_count: 2, reasons: ['a'] }).kind)
      .toBe('comment');
    const r = mapSafetyReport({
      ticket_id: 't', venue_id: 'v', venue_name: 'V', event_title: null, kind: 'weird', checked_in: true, description: 'd',
      ticket_status: 'answered', created_at: 'x', messages: [{ sender: 'support', text: 'oi', at: 'y' }],
    });
    expect(r.kind).toBe('outro');
    expect(r.status).toBe('answered');
    expect(r.messages).toEqual([{ sender: 'support', text: 'oi', at: 'y' }]);
  });

  it('maps ingest candidates and labels review flags', () => {
    const c = mapIngestCandidate({
      id: 'i', key: 'link:abc', tier: 2, title: 'Rock no Quintal', starts_at: 's', venue_name: 'Quintal', venue_matched: false,
      source_url: 'https://x.com/e', flags: ['venue-unverified', 'novo'], first_seen_at: 'f',
      details: { price: 'R$ 30', artists: ['A', 3], genres: ['rock'], address: 'Rua X' },
    });
    expect(c).toMatchObject({ key: 'link:abc', price: 'R$ 30', artists: ['A'], genres: ['rock'], address: 'Rua X', venueMatched: false });
    expect(mapIngestCandidate({ id: 'i', key: 'k', title: 't', starts_at: 's', venue_name: 'v', first_seen_at: 'f', details: null }).price).toBeNull();
    expect(flagLabel('venue-unverified')).toBe('Casa fora do catálogo');
    expect(flagLabel('novo')).toBe('novo');
    expect(mapOverview({ ingest_pending: 4 }).ingestPending).toBe(4);
  });
});
