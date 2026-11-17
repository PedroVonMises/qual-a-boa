-- 0017_community_guards.sql
-- Anti-brigada e limite de frequência na Comunidade (items B6 and B7 of docs/MVP-PLANO.md).
--
--  * Auto-hide (0010) hid any post after 3 distinct reporters, and ensureUserId() signs anonymous users in, so three
--    throwaway sessions could take down any post. Now only reporters with a real (non-anonymous) account that is at
--    least `reporter_min_age` old count. Every report is still stored, for human moderation.
--  * Posting is rate limited per user: threads per 10 minutes, comments per hour.
--  * The numbers live in public.community_limits (one row, service_role only), so they can be tuned without a release.

create table public.community_limits (
  id                   boolean primary key default true check (id),
  threads_per_10min    int not null default 5 check (threads_per_10min > 0),
  comments_per_hour    int not null default 30 check (comments_per_hour > 0),
  reports_to_hide      int not null default 3 check (reports_to_hide > 0),
  reporter_min_age     interval not null default interval '24 hours'
);
insert into public.community_limits default values;
alter table public.community_limits enable row level security;
revoke all on public.community_limits from anon, authenticated;
grant all on public.community_limits to service_role;

-- Reporters whose report counts towards auto-hide.
create function public.community_counted_reporters(p_thread_id uuid, p_comment_id uuid) returns int
language sql stable security definer set search_path = public as $$
  select count(distinct r.user_id)::int
  from public.community_reports r
  join auth.users u on u.id = r.user_id
  cross join public.community_limits l
  where (r.thread_id = p_thread_id or r.comment_id = p_comment_id)
    and coalesce(u.is_anonymous, false) = false
    and u.created_at <= now() - l.reporter_min_age
$$;

create or replace function public.community_reports_autohide() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  need int := (select reports_to_hide from public.community_limits);
begin
  if new.thread_id is not null then
    if public.community_counted_reporters(new.thread_id, null) >= need then
      update public.threads set status = 'hidden' where id = new.thread_id;
    end if;
  else
    if public.community_counted_reporters(null, new.comment_id) >= need then
      update public.comments set status = 'hidden' where id = new.comment_id;
    end if;
  end if;
  return null;
end $$;

-- Rate limits ---------------------------------------------------------------------------------------------------------
create function public.threads_throttle() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.threads t
      where t.user_id = new.user_id and t.created_at > now() - interval '10 minutes')
     >= (select threads_per_10min from public.community_limits) then
    raise exception 'rate_limited' using errcode = 'P0001', hint = 'rate_limited', detail = 'threads';
  end if;
  return new;
end $$;
create trigger threads_throttle_ins before insert on public.threads
  for each row execute function public.threads_throttle();

create function public.comments_throttle() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.comments c
      where c.user_id = new.user_id and c.created_at > now() - interval '1 hour')
     >= (select comments_per_hour from public.community_limits) then
    raise exception 'rate_limited' using errcode = 'P0001', hint = 'rate_limited', detail = 'comments';
  end if;
  return new;
end $$;
create trigger comments_throttle_ins before insert on public.comments
  for each row execute function public.comments_throttle();

-- Supporting indexes for the per-user counts.
create index threads_user_created_idx on public.threads (user_id, created_at desc);
create index comments_user_created_idx on public.comments (user_id, created_at desc);

revoke execute on function public.community_counted_reporters(uuid, uuid), public.threads_throttle(),
  public.comments_throttle()
  from public, anon, authenticated;
