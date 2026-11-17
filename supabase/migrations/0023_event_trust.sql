-- 0023_event_trust.sql
-- Event trust fields (item 14 of docs/MVP-PLANO.md, without womenEntry: Pedro decided on 2026-11-17 not to show it).
--
--  * events.verified_at: when a person on the team last checked the event (an approved casa submission, or a curator
--    confirming an ingested event). source_url (0006) says where the facts came from. The event page shows both.
--  * events.dress_code: free text from the casa (2..80 characters), e.g. "Esporte fino, sem chinelo".
--  * submit_event accepts dress_code (same body as 0015 otherwise); review_event stamps verified_at on approval.
--  * verify_event(id): service_role only, for curators to re-confirm a published event (ingested or not).

alter table public.events
  add column verified_at timestamptz,
  add column dress_code  text constraint events_dress_code_len check (dress_code is null or char_length(dress_code) between 2 and 80);

create or replace function public.submit_event(p_account uuid, p_payload jsonb) returns uuid
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
  v_dress text;
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
  v_dress := nullif(btrim(regexp_replace(coalesce(p_payload->>'dress_code', ''), '\s+', ' ', 'g')), '');
  if v_dress is not null and char_length(v_dress) not between 2 and 80 then
    perform public.venue_error('invalid_payload', 'dress_code');
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
                             status, cover_key, venue_account_id, submitted_by, poster_path, dress_code)
  values (acc.venue_id, v_title, v_starts, v_ends, v_pmin, v_pmax, v_free, v_ticket, v_age,
          'pending_review', coalesce(v_cover, 'generic'), p_account, v_uid, v_poster, v_dress)
  returning id into v_id;
  insert into public.event_genres (event_id, genre_slug) select v_id, g from unnest(v_genres) g;
  return v_id;
end $$;

create or replace function public.review_event(p_event_id uuid, p_approve boolean, p_note text default null) returns text
language plpgsql volatile security definer set search_path = public as $$
declare
  v_status text;
begin
  select status::text into v_status from public.events where id = p_event_id for update;
  if v_status is null then perform public.venue_error('event_not_found'); end if;
  if v_status <> 'pending_review' then perform public.venue_error('not_pending'); end if;
  update public.events
  set status = case when p_approve then 'published' else 'rejected' end::public.event_status,
      review_note = nullif(btrim(coalesce(p_note, '')), ''),
      verified_at = case when p_approve then now() else verified_at end,
      updated_at = now()
  where id = p_event_id;
  return case when p_approve then 'published' else 'rejected' end;
end $$;

create function public.verify_event(p_event_id uuid) returns timestamptz
language plpgsql volatile security definer set search_path = public as $$
declare
  v_at timestamptz;
begin
  update public.events set verified_at = now(), updated_at = now()
   where id = p_event_id and status = 'published'
  returning verified_at into v_at;
  if v_at is null then perform public.venue_error('event_not_found'); end if;
  return v_at;
end $$;

revoke execute on function public.verify_event(uuid) from public, anon, authenticated;
grant execute on function public.verify_event(uuid) to service_role;
