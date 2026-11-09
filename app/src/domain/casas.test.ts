import {
  addMonthKey,
  CASAS_ERROR_MESSAGES,
  casasErrorMessage,
  countsForQuota,
  formatCnpj,
  formatPlanPrice,
  isValidCnpj,
  PLAN,
  partyMonthKey,
  partyMonthLabel,
  submissionBlocker,
  subscriptionAllows,
  SUBMISSION_STATUS_LABEL,
  type VenueAccount,
} from './casas';

const NOW = Date.parse('2026-11-09T15:00:00Z');

describe('plan', () => {
  it('is R$ 299 for 4 festas', () => {
    expect(PLAN).toEqual({ code: 'casa_mensal', name: 'Plano Casas Noturnas', priceCents: 29900, eventsPerMonth: 4 });
    expect(formatPlanPrice()).toBe('R$ 299');
    expect(formatPlanPrice(29990)).toBe('R$ 299,90');
    expect(formatPlanPrice(129900)).toBe('R$ 1.299');
  });
});

describe('partyMonthKey (night rule, São Paulo)', () => {
  it('03:00 on day 1 belongs to the previous month', () => {
    expect(partyMonthKey('2026-12-01T03:00:00-03:00')).toBe('2026-11');
    expect(partyMonthKey('2026-12-01T05:59:00-03:00')).toBe('2026-11');
    expect(partyMonthKey('2026-12-01T06:00:00-03:00')).toBe('2026-12');
    expect(partyMonthKey('2027-01-01T02:00:00-03:00')).toBe('2026-12');
  });
  it('uses SP time, not UTC', () => {
    // 01:00 UTC on Dec 1 is 22:00 Nov 30 in SP.
    expect(partyMonthKey('2026-12-01T01:00:00Z')).toBe('2026-11');
    expect(partyMonthKey('2026-11-30T23:00:00-03:00')).toBe('2026-11');
  });
  it('month helpers', () => {
    expect(addMonthKey('2026-12', 1)).toBe('2027-01');
    expect(addMonthKey('2026-01', -1)).toBe('2025-12');
    expect(partyMonthLabel('2026-11')).toBe('Novembro 2026');
  });
});

describe('quota statuses', () => {
  it('pending, published and cancelled count; draft and rejected do not', () => {
    expect(countsForQuota('pending_review')).toBe(true);
    expect(countsForQuota('published')).toBe(true);
    expect(countsForQuota('cancelled')).toBe(true);
    expect(countsForQuota('draft')).toBe(false);
    expect(countsForQuota('rejected')).toBe(false);
    expect(Object.keys(SUBMISSION_STATUS_LABEL).sort()).toEqual(['cancelled', 'draft', 'pending_review', 'published', 'rejected']);
  });
});

describe('subscription and submission checks', () => {
  const sub = (over: Partial<NonNullable<VenueAccount['subscription']>> = {}) => ({
    status: 'active' as const, currentPeriodStart: '2026-11-01T00:00:00Z', currentPeriodEnd: '2026-12-01T15:00:00Z', cancelAtPeriodEnd: false, ...over,
  });
  const account = (over: Partial<VenueAccount> = {}) => ({
    status: 'verified' as const,
    venue: { id: 'v', slug: 'casa-mare', name: 'Casa Maré', area: 'Praia do Canto' },
    subscription: sub(),
    plan: { code: 'casa_mensal', priceCents: 29900, eventsPerMonth: 4 },
    ...over,
  });

  it('past_due grants access only inside the period', () => {
    expect(subscriptionAllows(sub({ status: 'past_due' }), NOW)).toBe(true);
    expect(subscriptionAllows(sub({ status: 'past_due', currentPeriodEnd: '2026-11-01T00:00:00Z' }), NOW)).toBe(false);
    expect(subscriptionAllows(sub({ status: 'canceled' }), NOW)).toBe(false);
    expect(subscriptionAllows(null, NOW)).toBe(false);
  });

  it('mirrors the server codes', () => {
    const at = '2026-11-20T23:00:00-03:00';
    expect(submissionBlocker(account(), at, 0, NOW)).toBeNull();
    expect(submissionBlocker(account({ status: 'pending' }), at, 0, NOW)).toBe('account_not_verified');
    expect(submissionBlocker(account({ venue: null }), at, 0, NOW)).toBe('venue_missing');
    expect(submissionBlocker(account({ subscription: sub({ status: 'incomplete' }) }), at, 0, NOW)).toBe('subscription_inactive');
    expect(submissionBlocker(account(), '2026-11-01T23:00:00-03:00', 0, NOW)).toBe('starts_in_past');
    expect(submissionBlocker(account(), at, 4, NOW)).toBe('quota_exceeded');
    // Period ends in December: December festas are fine, January is not.
    expect(submissionBlocker(account(), '2026-12-20T23:00:00-03:00', 0, NOW)).toBeNull();
    expect(submissionBlocker(account(), '2027-01-08T23:00:00-03:00', 0, NOW)).toBe('beyond_paid_period');
    // Cancelling at period end: nothing after the end instant.
    expect(submissionBlocker(account({ subscription: sub({ cancelAtPeriodEnd: true }) }), '2026-12-05T23:00:00-03:00', 0, NOW)).toBe('beyond_paid_period');
  });
});

describe('CNPJ', () => {
  it('validates check digits like the SQL function', () => {
    expect(isValidCnpj('11.222.333/0001-81')).toBe(true);
    expect(isValidCnpj('11222333000181')).toBe(true);
    expect(isValidCnpj('11222333000182')).toBe(false);
    expect(isValidCnpj('11111111111111')).toBe(false);
    expect(isValidCnpj('1122233300018')).toBe(false);
  });
  it('masks progressively', () => {
    expect(formatCnpj('11222333000181')).toBe('11.222.333/0001-81');
    expect(formatCnpj('11222')).toBe('11.222');
    expect(formatCnpj('112223330')).toBe('11.222.333/0');
  });
});

describe('error copy', () => {
  it('has a pt-BR message for every code and a generic fallback', () => {
    for (const msg of Object.values(CASAS_ERROR_MESSAGES)) expect(msg.length).toBeGreaterThan(5);
    expect(casasErrorMessage('quota_exceeded')).toBe('Você já usou as 4 festas deste mês.');
    expect(casasErrorMessage('whatever')).toBe(CASAS_ERROR_MESSAGES.network);
    expect(casasErrorMessage(undefined)).toBe(CASAS_ERROR_MESSAGES.network);
  });
});
