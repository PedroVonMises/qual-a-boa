-- 0015_venue_accounts.sql
-- Plano Casas Noturnas (R$ 299/mês, 4 festas por mês, cobrança Stripe).
--
--  * plans, venue_accounts (claim of a venue by a CNPJ), venue_members (owner|editor), subscriptions (mirror of the
--    Stripe subscription, written only by the billing-webhook Edge Function via service_role), billing_events
--    (webhook idempotency log, service_role only).
--  * events gain venue_account_id / submitted_by / review_note / poster_path and two statuses: pending_review and
--    rejected. Festas sent by a casa go through public.submit_event and wait in pending_review for review_event.
--  * Quota: 4 festas per party month (calendar month in America/Sao_Paulo of the party's NIGHT: local time before
--    06:00 belongs to the previous day, same rule as app/src/domain/filters.ts nightDayNumber). pending_review,
--    published and cancelled count; draft and rejected do not (rejected gives the slot back).
--  * Private Storage bucket event-posters, objects at `<venue_account_id>/<uuid>.<ext>`.
--
-- NOTE on the enum: ALTER TYPE ... ADD VALUE runs inside the migration's transaction (Supabase and the PGlite
-- harness both apply a file as one transaction), and a new enum value cannot be USED before that commits. So nothing
-- below may cast the literals 'pending_review'/'rejected' at creation time: only plpgsql bodies (parsed at first
-- call) mention them, and SQL contexts compare status::text.

alter type public.event_status add value if not exists 'pending_review';
alter type public.event_status add value if not exists 'rejected';

-- Plans ------------------------------------------------------------------------------------------------------------
create table public.plans (
  code              text primary key check (code ~ '^[a-z0-9_]{1,40}$'),
  name              text not null,
  price_cents       int  not null check (price_cents > 0),
  currency          text not null default 'BRL' check (currency = 'BRL'),
  events_per_month  int  not null check (events_per_month > 0),
  active            boolean not null default true
);
insert into public.plans (code, name, price_cents, events_per_month, active)
values ('casa_mensal', 'Plano Casas Noturnas', 29900, 4, true)
on conflict (code) do nothing;

-- CNPJ check digits ------------------------------------------------------------------------------------------------
create function public.is_valid_cnpj(p text) returns boolean
language plpgsql immutable set search_path = public as $$
declare
  d int[];
  w1 int[] := array[5,4,3,2,9,8,7,6,5,4,3,2];
  w2 int[] := array[6,5,4,3,2,9,8,7,6,5,4,3,2];
  s int;
  r int;
  dv1 int;
  dv2 int;
begin
  if p is null or p !~ '^[0-9]{14}$' or p ~ '^(.)\1{13}$' then return false; end if;
  select array_agg(substr(p, i, 1)::int order by i) into d from generate_series(1, 14) i;
  s := 0;
  for i in 1..12 loop s := s + d[i] * w1[i]; end loop;
  r := s % 11;
  dv1 := case when r < 2 then 0 else 11 - r end;
  if dv1 <> d[13] then return false; end if;
  s := 0;
  for i in 1..13 loop s := s + d[i] * w2[i]; end loop;
  r := s % 11;
  dv2 := case when r < 2 then 0 else 11 - r end;
  return dv2 = d[14];
end $$;

-- Party month: first day of the São Paulo calendar month of the party's night (before 06:00 = previous day).
create function public.party_month(p_starts_at timestamptz) returns date
language sql immutable set search_path = public as $$
  select date_trunc('month', (p_starts_at at time zone 'America/Sao_Paulo') - interval '6 hours')::date
$$;

-- Venue accounts -----------------------------------------------------------------------------------------------------
create table public.venue_accounts (
  id              uuid primary key default gen_random_uuid(),
  -- Null while the casa does not exist in the catalog yet (proposed_venue carries it until review creates the venue).
  venue_id        uuid references public.venues (id) on delete set null,
  proposed_venue  jsonb check (proposed_venue is null or jsonb_typeof(proposed_venue) = 'object'),
  cnpj            text not null check (public.is_valid_cnpj(cnpj)),
  legal_name      text not null check (char_length(btrim(legal_name)) between 2 and 160),
  contact_name    text not null check (char_length(btrim(contact_name)) between 2 and 120),
  whatsapp        text not null check (whatsapp ~ '^\+?[0-9]{10,15}$'),
  status          text not null default 'pending' check (status in ('pending', 'verified', 'rejected')),
  review_note     text,
  created_by      uuid default auth.uid() references auth.users (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint venue_accounts_venue_or_proposal check (venue_id is not null or proposed_venue is not null)
);
-- One live claim per venue and per CNPJ. A rejected claim does not lock the venue/CNPJ out forever.
create unique index venue_accounts_venue_key on public.venue_accounts (venue_id)
  where venue_id is not null and status <> 'rejected';
create unique index venue_accounts_cnpj_key on public.venue_accounts (cnpj) where status <> 'rejected';

create table public.venue_members (
  venue_account_id  uuid not null references public.venue_accounts (id) on delete cascade,
  user_id           uuid not null references auth.users (id) on delete cascade,
  role              text not null check (role in ('owner', 'editor')),
  created_at        timestamptz not null default now(),
  primary key (venue_account_id, user_id)
);
create index venue_members_user_idx on public.venue_members (user_id);

-- Subscriptions (mirror of Stripe) --------------------------------------------------------------------------------------
create table public.subscriptions (
  id                      uuid primary key default gen_random_uuid(),
  venue_account_id        uuid not null unique references public.venue_accounts (id) on delete cascade,
  plan_code               text not null default 'casa_mensal' references public.plans (code),
  provider                text not null default 'stripe' check (provider = 'stripe'),
  stripe_customer_id      text,
  stripe_subscription_id  text unique,
  status                  text not null default 'incomplete'
                          check (status in ('incomplete', 'active', 'past_due', 'canceled')),
  current_period_start    timestamptz,
  current_period_end      timestamptz,
  cancel_at_period_end    boolean not null default false,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);
create index subscriptions_customer_idx on public.subscriptions (stripe_customer_id);

create table public.billing_events (
  provider_event_id  text primary key,
  type               text not null,
  payload            jsonb not null,
  received_at        timestamptz not null default now(),
  processed_at       timestamptz
);

-- Events: venue-account submissions --------------------------------------------------------------------------------------
alter table public.events
  add column venue_account_id uuid references public.venue_accounts (id) on delete set null,
  add column submitted_by     uuid references auth.users (id) on delete set null,
  add column review_note      text,
  add column poster_path      text constraint events_poster_path_format
    check (poster_path is null or poster_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|webp)$');
create index events_venue_account_idx on public.events (venue_account_id, starts_at) where venue_account_id is not null;

-- Helpers ----------------------------------------------------------------------------------------------------------------
create function public.is_venue_member(p_account uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.venue_members m
                 where m.venue_account_id = p_account and m.user_id = auth.uid())
$$;

-- Same, for a Storage folder name (anything that is not a uuid is simply not a member folder).
create function public.is_venue_member_folder(p_folder text) returns boolean
language sql stable security definer set search_path = public as $$
  select p_folder ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     and public.is_venue_member(p_folder::uuid)
$$;

-- Festas of an account that count against the quota in a party month.
create function public.quota_used(p_account uuid, p_month date) returns int
language plpgsql stable security definer set search_path = public as $$
begin
  return (select count(*)::int from public.events e
          where e.venue_account_id = p_account
            and e.status in ('pending_review', 'published', 'cancelled')
            and public.party_month(e.starts_at) = date_trunc('month', p_month)::date);
end $$;

-- Subscription grants access: active, or past_due while still inside the paid period.
create function public.subscription_allows(p_status text, p_period_end timestamptz) returns boolean
language sql stable set search_path = public as $$
  select p_status = 'active' or (p_status = 'past_due' and p_period_end is not null and p_period_end > now())
$$;

create function public.venue_error(p_code text, p_detail text default null) returns void
language plpgsql volatile set search_path = public as $$
begin
  -- message = stable machine code the app translates (app/src/domain/casas.ts). hint repeats it for PostgREST clients.
  raise exception using errcode = 'P0001', message = p_code, hint = p_code, detail = coalesce(p_detail, '');
end $$;

-- claim_venue ---------------------------------------------------------------------------------------------------------------
create function public.claim_venue(
  p_venue_id     uuid,
  p_proposed     jsonb,
  p_cnpj         text,
  p_legal_name   text,
  p_contact_name text,
  p_whatsapp     text
) returns uuid
language plpgsql volatile security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_cnpj text := regexp_replace(coalesce(p_cnpj, ''), '[^0-9]', '', 'g');
  v_whats text := regexp_replace(coalesce(p_whatsapp, ''), '[^0-9+]', '', 'g');
  v_id uuid;
begin
  if v_uid is null then perform public.venue_error('not_authenticated'); end if;
  if (p_venue_id is null) = (p_proposed is null) then perform public.venue_error('invalid_payload', 'venue'); end if;
  if p_venue_id is not null and not exists (select 1 from public.venues where id = p_venue_id) then
    perform public.venue_error('venue_not_found');
  end if;
  if p_proposed is not null and (
       jsonb_typeof(p_proposed) <> 'object'
       or char_length(btrim(coalesce(p_proposed->>'name', ''))) not between 2 and 120
       or char_length(btrim(coalesce(p_proposed->>'address', ''))) not between 4 and 200
       or (p_proposed ? 'cep' and coalesce(p_proposed->>'cep', '') !~ '^[0-9]{5}-?[0-9]{3}$')
       or (p_proposed ? 'lat' and jsonb_typeof(p_proposed->'lat') <> 'number')
       or (p_proposed ? 'lng' and jsonb_typeof(p_proposed->'lng') <> 'number')) then
    perform public.venue_error('invalid_payload', 'proposed_venue');
  end if;
  if not public.is_valid_cnpj(v_cnpj) then perform public.venue_error('invalid_cnpj'); end if;
  if char_length(btrim(coalesce(p_legal_name, ''))) not between 2 and 160 then
    perform public.venue_error('invalid_payload', 'legal_name');
  end if;
  if char_length(btrim(coalesce(p_contact_name, ''))) not between 2 and 120 then
    perform public.venue_error('invalid_payload', 'contact_name');
  end if;
  if v_whats !~ '^\+?[0-9]{10,15}$' then perform public.venue_error('invalid_payload', 'whatsapp'); end if;
  if exists (select 1 from public.venue_accounts where cnpj = v_cnpj and status <> 'rejected') then
    perform public.venue_error('cnpj_taken');
  end if;
  if p_venue_id is not null and exists (select 1 from public.venue_accounts
                                        where venue_id = p_venue_id and status <> 'rejected') then
    perform public.venue_error('venue_taken');
  end if;

  insert into public.venue_accounts (venue_id, proposed_venue, cnpj, legal_name, contact_name, whatsapp, created_by)
  values (p_venue_id, p_proposed, v_cnpj, btrim(p_legal_name), btrim(p_contact_name), v_whats, v_uid)
  returning id into v_id;
  insert into public.venue_members (venue_account_id, user_id, role) values (v_id, v_uid, 'owner');
  return v_id;
exception when unique_violation then
  -- Lost a race with another claim of the same venue/CNPJ.
  perform public.venue_error(case when p_venue_id is not null then 'venue_taken' else 'cnpj_taken' end);
end $$;

-- venue_quota ----------------------------------------------------------------------------------------------------------------
create function public.venue_quota(p_account uuid, p_month date)
returns table (used int, "limit" int)
language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null then perform public.venue_error('not_authenticated'); end if;
  if not public.is_venue_member(p_account) then perform public.venue_error('not_member'); end if;
  return query
    select public.quota_used(p_account, p_month),
           coalesce((select p.events_per_month from public.subscriptions s join public.plans p on p.code = s.plan_code
                     where s.venue_account_id = p_account),
                    (select events_per_month from public.plans where code = 'casa_mensal'));
end $$;

-- submit_event -----------------------------------------------------------------------------------------------------------------
create function public.submit_event(p_account uuid, p_payload jsonb) returns uuid
language plpgsql volatile security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  acc public.venue_accounts%rowtype;
  sub public.subscriptions%rowtype;
  v_limit int;
  v_title text;
  v_starts timestamptz;
  v_ends timestamptz;
  v_free boolean;
  v_pmin numeric;
  v_pmax numeric;
  v_ticket text;
  v_age int;
  v_genres text[];
  v_poster text;
  v_cover text;
  v_month date;
  v_id uuid;
begin
  if v_uid is null then perform public.venue_error('not_authenticated'); end if;
  -- Row lock: concurrent submissions of the same casa run one after the other, so the quota count is exact.
  select * into acc from public.venue_accounts where id = p_account for update;
  if not found or not exists (select 1 from public.venue_members m
                              where m.venue_account_id = p_account and m.user_id = v_uid
                                and m.role in ('owner', 'editor')) then
    perform public.venue_error('not_member');
  end if;
  if acc.status <> 'verified' then perform public.venue_error('account_not_verified'); end if;
  if acc.venue_id is null then perform public.venue_error('venue_missing'); end if;

  select * into sub from public.subscriptions where venue_account_id = p_account;
  if not found or not public.subscription_allows(sub.status, sub.current_period_end) then
    perform public.venue_error('subscription_inactive');
  end if;

  -- Payload ------------------------------------------------------------------------------------------------------
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then perform public.venue_error('invalid_payload'); end if;
  v_title := btrim(coalesce(p_payload->>'title', ''));
  if char_length(v_title) not between 3 and 120 then perform public.venue_error('invalid_payload', 'title'); end if;
  begin
    v_starts := (p_payload->>'starts_at')::timestamptz;
    v_ends := nullif(p_payload->>'ends_at', '')::timestamptz;
  exception when others then
    perform public.venue_error('invalid_payload', 'starts_at');
  end;
  if v_starts is null then perform public.venue_error('invalid_payload', 'starts_at'); end if;
  if v_starts <= now() then perform public.venue_error('starts_in_past'); end if;
  if v_ends is not null and (v_ends <= v_starts or v_ends > v_starts + interval '24 hours') then
    perform public.venue_error('invalid_payload', 'ends_at');
  end if;
  if p_payload ? 'is_free' and jsonb_typeof(p_payload->'is_free') <> 'boolean' then
    perform public.venue_error('invalid_payload', 'is_free');
  end if;
  v_free := coalesce((p_payload->>'is_free')::boolean, false);
  begin
    v_pmin := nullif(p_payload->>'price_min', '')::numeric;
    v_pmax := nullif(p_payload->>'price_max', '')::numeric;
  exception when others then
    perform public.venue_error('invalid_price');
  end;
  if v_free then
    if coalesce(v_pmin, 0) <> 0 or coalesce(v_pmax, 0) <> 0 then perform public.venue_error('invalid_price'); end if;
    v_pmin := null; v_pmax := null;
  else
    if v_pmin is null and v_pmax is not null then v_pmin := v_pmax; end if;
    if v_pmin is null or v_pmin < 0 or v_pmin > 100000 or (v_pmax is not null and (v_pmax < v_pmin or v_pmax > 100000)) then
      perform public.venue_error('invalid_price');
    end if;
  end if;
  v_ticket := nullif(btrim(coalesce(p_payload->>'ticket_url', '')), '');
  if v_ticket is not null and (v_ticket !~* '^https://[^@/\s]+(/\S*)?$' or char_length(v_ticket) > 500) then
    perform public.venue_error('invalid_ticket_url');
  end if;
  begin
    v_age := coalesce((p_payload->>'age_min')::int, 18);
  exception when others then
    perform public.venue_error('invalid_age');
  end;
  if v_age < 18 or v_age > 21 then perform public.venue_error('invalid_age'); end if;
  if p_payload ? 'genre_slugs' and jsonb_typeof(p_payload->'genre_slugs') <> 'array' then
    perform public.venue_error('invalid_genre');
  end if;
  select coalesce(array_agg(distinct g), '{}') into v_genres
  from jsonb_array_elements_text(coalesce(p_payload->'genre_slugs', '[]'::jsonb)) g;
  if cardinality(v_genres) > 3
     or exists (select 1 from unnest(v_genres) g where not exists (select 1 from public.genres x where x.slug = g)) then
    perform public.venue_error('invalid_genre');
  end if;
  v_poster := nullif(p_payload->>'poster_path', '');
  if v_poster is not null and (v_poster !~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|webp)$'
                               or split_part(v_poster, '/', 1) <> p_account::text) then
    perform public.venue_error('invalid_poster');
  end if;

  -- Paid period + quota --------------------------------------------------------------------------------------------
  v_month := public.party_month(v_starts);
  if sub.cancel_at_period_end then
    if sub.current_period_end is null or v_starts > sub.current_period_end then
      perform public.venue_error('beyond_paid_period');
    end if;
  elsif sub.current_period_end is null
        or v_month > date_trunc('month', sub.current_period_end at time zone 'America/Sao_Paulo')::date then
    perform public.venue_error('beyond_paid_period');
  end if;
  select p.events_per_month into v_limit from public.plans p where p.code = sub.plan_code;
  if public.quota_used(p_account, v_month) >= coalesce(v_limit, 0) then
    perform public.venue_error('quota_exceeded', to_char(v_month, 'YYYY-MM'));
  end if;

  select cover_key into v_cover from public.venues where id = acc.venue_id;
  insert into public.events (venue_id, title, starts_at, ends_at, price_min, price_max, is_free, ticket_url, age_min,
                             status, cover_key, venue_account_id, submitted_by, poster_path)
  values (acc.venue_id, v_title, v_starts, v_ends, v_pmin, v_pmax, v_free, v_ticket, v_age,
          'pending_review', coalesce(v_cover, 'generic'), p_account, v_uid, v_poster)
  returning id into v_id;
  insert into public.event_genres (event_id, genre_slug) select v_id, g from unnest(v_genres) g;
  return v_id;
end $$;

-- cancel_event_submission ----------------------------------------------------------------------------------------------------------
-- pending_review/draft -> rejected ('Retirada pela casa'): gives the slot back. published -> cancelled: still counts.
create function public.cancel_event_submission(p_event_id uuid) returns text
language plpgsql volatile security definer set search_path = public as $$
declare
  ev public.events%rowtype;
begin
  if auth.uid() is null then perform public.venue_error('not_authenticated'); end if;
  select * into ev from public.events where id = p_event_id for update;
  if not found or ev.venue_account_id is null or not public.is_venue_member(ev.venue_account_id) then
    perform public.venue_error('event_not_found');
  end if;
  if ev.status in ('draft', 'pending_review') then
    update public.events set status = 'rejected', review_note = 'Retirada pela casa', updated_at = now()
    where id = p_event_id;
    return 'rejected';
  elsif ev.status = 'published' then
    update public.events set status = 'cancelled', updated_at = now() where id = p_event_id;
    return 'cancelled';
  end if;
  perform public.venue_error('not_cancellable');
  return null;
end $$;

-- review_event (admin, service_role only) ------------------------------------------------------------------------------------------
create function public.review_event(p_event_id uuid, p_approve boolean, p_note text default null) returns text
language plpgsql volatile security definer set search_path = public as $$
declare
  v_status text;
begin
  select status::text into v_status from public.events where id = p_event_id for update;
  if v_status is null then perform public.venue_error('event_not_found'); end if;
  if v_status <> 'pending_review' then perform public.venue_error('not_pending'); end if;
  update public.events
  set status = case when p_approve then 'published' else 'rejected' end::public.event_status,
      review_note = nullif(btrim(coalesce(p_note, '')), ''), updated_at = now()
  where id = p_event_id;
  return case when p_approve then 'published' else 'rejected' end;
end $$;

-- my_venue_accounts (painel) -------------------------------------------------------------------------------------------------------
create function public.my_venue_accounts()
returns table (
  account_id            uuid,
  role                  text,
  status                text,
  cnpj                  text,
  legal_name            text,
  contact_name          text,
  whatsapp              text,
  review_note           text,
  created_at            timestamptz,
  venue_id              uuid,
  venue_slug            text,
  venue_name            text,
  venue_area            text,
  proposed_venue        jsonb,
  plan_code             text,
  price_cents           int,
  events_per_month      int,
  subscription_status   text,
  current_period_start  timestamptz,
  current_period_end    timestamptz,
  cancel_at_period_end  boolean,
  current_month         date,
  used_current_month    int,
  next_month            date,
  used_next_month       int,
  can_submit            boolean
)
language plpgsql stable security definer set search_path = public as $$
declare
  v_cur date := public.party_month(now());
  v_next date := (public.party_month(now()) + interval '1 month')::date;
begin
  return query
    select a.id, m.role, a.status, a.cnpj, a.legal_name, a.contact_name, a.whatsapp, a.review_note, a.created_at,
           a.venue_id, v.slug, v.name, v.area, a.proposed_venue,
           coalesce(s.plan_code, 'casa_mensal'), p.price_cents, p.events_per_month,
           s.status, s.current_period_start, s.current_period_end, coalesce(s.cancel_at_period_end, false),
           v_cur, public.quota_used(a.id, v_cur), v_next, public.quota_used(a.id, v_next),
           (a.status = 'verified' and a.venue_id is not null and s.id is not null
            and public.subscription_allows(s.status, s.current_period_end))
    from public.venue_members m
    join public.venue_accounts a on a.id = m.venue_account_id
    left join public.venues v on v.id = a.venue_id
    left join public.subscriptions s on s.venue_account_id = a.id
    join public.plans p on p.code = coalesce(s.plan_code, 'casa_mensal')
    where m.user_id = auth.uid()
    order by a.created_at;
end $$;

-- delete-account guard (service_role): user is the ONLY owner of an account with a live subscription.
create function public.blocks_account_deletion(p_user uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.venue_members m
    join public.subscriptions s on s.venue_account_id = m.venue_account_id
    where m.user_id = p_user and m.role = 'owner' and s.status in ('active', 'past_due')
      and not exists (select 1 from public.venue_members o
                      where o.venue_account_id = m.venue_account_id and o.role = 'owner' and o.user_id <> p_user))
$$;

-- RLS + privileges ---------------------------------------------------------------------------------------------------------------------
alter table public.plans           enable row level security;
alter table public.venue_accounts  enable row level security;
alter table public.venue_members   enable row level security;
alter table public.subscriptions   enable row level security;
alter table public.billing_events  enable row level security;

revoke all on public.plans, public.venue_accounts, public.venue_members, public.subscriptions, public.billing_events
  from anon, authenticated;
grant select on public.plans to anon, authenticated;
-- Every write goes through the definer RPCs above (or service_role).
grant select on public.venue_accounts, public.venue_members, public.subscriptions to authenticated;
grant all on public.plans, public.venue_accounts, public.venue_members, public.subscriptions, public.billing_events
  to service_role;

create policy plans_public_read on public.plans for select to anon, authenticated using (active);
create policy venue_accounts_member_read on public.venue_accounts
  for select to authenticated using (public.is_venue_member(id));
create policy venue_members_member_read on public.venue_members
  for select to authenticated using (public.is_venue_member(venue_account_id));
create policy subscriptions_member_read on public.subscriptions
  for select to authenticated using (public.is_venue_member(venue_account_id));
-- billing_events: RLS on, no policy, no grant: service_role only.

-- Members also see every festa of their own account (any status). Public read (published/cancelled) stays in 0003.
create policy events_member_read on public.events
  for select to authenticated
  using (venue_account_id is not null and public.is_venue_member(venue_account_id));
create policy event_genres_member_read on public.event_genres
  for select to authenticated
  using (exists (select 1 from public.events e
                 where e.id = event_genres.event_id and e.venue_account_id is not null
                   and public.is_venue_member(e.venue_account_id)));

-- Functions: closed by default, then opened per role.
revoke execute on function
  public.is_valid_cnpj(text), public.party_month(timestamptz), public.is_venue_member(uuid),
  public.is_venue_member_folder(text), public.quota_used(uuid, date), public.subscription_allows(text, timestamptz),
  public.venue_error(text, text), public.claim_venue(uuid, jsonb, text, text, text, text),
  public.venue_quota(uuid, date), public.submit_event(uuid, jsonb), public.cancel_event_submission(uuid),
  public.review_event(uuid, boolean, text), public.my_venue_accounts(), public.blocks_account_deletion(uuid)
  from public, anon, authenticated;
grant execute on function public.is_valid_cnpj(text), public.party_month(timestamptz)
  to anon, authenticated, service_role;
-- anon needs the membership helpers only because Storage/RLS policies call them (they return false without a user).
grant execute on function public.is_venue_member(uuid), public.is_venue_member_folder(text) to anon;
grant execute on function public.is_venue_member(uuid), public.is_venue_member_folder(text),
  public.claim_venue(uuid, jsonb, text, text, text, text), public.venue_quota(uuid, date),
  public.submit_event(uuid, jsonb), public.cancel_event_submission(uuid), public.my_venue_accounts()
  to authenticated, service_role;
grant execute on function public.quota_used(uuid, date), public.subscription_allows(text, timestamptz),
  public.venue_error(text, text), public.review_event(uuid, boolean, text), public.blocks_account_deletion(uuid)
  to service_role;

-- Storage: event posters ------------------------------------------------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('event-posters', 'event-posters', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy event_posters_upload on storage.objects
  for insert to authenticated
  with check (bucket_id = 'event-posters' and public.is_venue_member_folder((storage.foldername(name))[1]));
create policy event_posters_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'event-posters' and public.is_venue_member_folder((storage.foldername(name))[1]));
-- Members read their folder; anyone reads a poster linked to a public (published/cancelled) festa.
create policy event_posters_download on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'event-posters'
         and (public.is_venue_member_folder((storage.foldername(name))[1])
              or exists (select 1 from public.events e
                         where e.poster_path = objects.name and e.status::text in ('published', 'cancelled'))));
