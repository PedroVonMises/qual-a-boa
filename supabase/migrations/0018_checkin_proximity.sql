-- 0018_checkin_proximity.sql
-- Check-in por proximidade (item B5 of docs/MVP-PLANO.md).
-- A check-in unlocks live reports (queue/crowd) and "Foi ao evento" reviews, which feed the safety index, so it must
-- not be possible from home. Direct inserts are closed; public.check_in() takes the device position, checks it is
-- within CHECKIN_RADIUS_M of the venue (minus the fix accuracy, capped) during the window (2 h before start until the
-- end), and stores only the check-in: the coordinates are never saved (LGPD: only what is needed).
-- JS mirror of the rule: app/src/domain/checkin.ts.

drop policy checkins_owner_insert on public.checkins;
revoke insert on public.checkins from authenticated;

create function public.check_in(
  p_event_id    uuid,
  p_lat         double precision,
  p_lng         double precision,
  p_accuracy_m  double precision default null
) returns timestamptz
language plpgsql volatile security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  radius_m constant double precision := 300;
  max_slack_m constant double precision := 150;
  v_lat double precision;
  v_lng double precision;
  v_at timestamptz;
  dist_m double precision;
begin
  if me is null then raise exception 'not_authenticated' using errcode = 'P0001', hint = 'not_authenticated'; end if;
  select v.lat, v.lng into v_lat, v_lng
  from public.events e join public.venues v on v.id = e.venue_id
  where e.id = p_event_id and e.status = 'published'
    and now() between e.starts_at - interval '2 hours' and coalesce(e.ends_at, e.starts_at + interval '8 hours');
  if not found then
    raise exception 'checkin_closed' using errcode = 'P0001', hint = 'checkin_closed';
  end if;
  if p_lat is null or p_lng is null or p_lat not between -90 and 90 or p_lng not between -180 and 180 then
    raise exception 'location_required' using errcode = 'P0001', hint = 'location_required';
  end if;
  dist_m := public.haversine_km(p_lat, p_lng, v_lat, v_lng) * 1000
            - least(greatest(coalesce(p_accuracy_m, 0), 0), max_slack_m);
  if dist_m > radius_m then
    raise exception 'too_far' using errcode = 'P0001', hint = 'too_far', detail = round(dist_m)::text;
  end if;
  insert into public.checkins (user_id, event_id) values (me, p_event_id)
  on conflict on constraint checkins_one_per_user_event do nothing;
  select c.at into v_at from public.checkins c where c.user_id = me and c.event_id = p_event_id;
  return v_at;
end $$;

revoke execute on function public.check_in(uuid, double precision, double precision, double precision) from public, anon;
grant execute on function public.check_in(uuid, double precision, double precision, double precision) to authenticated;
