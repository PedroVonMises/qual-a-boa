-- 0007_uploads.sql
-- Photo uploads: review photos (shown with published reviews) and support attachments (owner only).
-- Two private Storage buckets; objects live at `<user_id>/<uuid>.<ext>` so Storage policies can key off
-- the first folder. `review_photos` / `support_attachments` link files to reviews / tickets and carry the
-- moderation + ownership rules, mirroring 0005. Requires the Supabase `storage` schema (stubbed in the
-- local PGlite harness).

-- Buckets ------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('review-photos',       'review-photos',       false, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('support-attachments', 'support-attachments', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- Tables -------------------------------------------------------------------------
create table public.review_photos (
  id          uuid primary key default gen_random_uuid(),
  review_id   uuid not null references public.reviews (id) on delete cascade,
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  path        text not null unique
              check (path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|webp)$' and split_part(path, '/', 1) = user_id::text),
  created_at  timestamptz not null default now()
);
create index review_photos_review_idx on public.review_photos (review_id);

create table public.support_attachments (
  id          uuid primary key default gen_random_uuid(),
  ticket_id   uuid not null references public.support_tickets (id) on delete cascade,
  message_id  uuid references public.support_messages (id) on delete cascade,
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  path        text not null unique
              check (path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|webp)$' and split_part(path, '/', 1) = user_id::text),
  created_at  timestamptz not null default now()
);
create index support_attachments_ticket_idx on public.support_attachments (ticket_id);

-- Helpers + triggers (definer: reviews.user_id is not selectable by clients) -----------
create function public.owns_review(p_review_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.reviews r where r.id = p_review_id and r.user_id = auth.uid())
$$;
revoke execute on function public.owns_review(uuid) from public, anon;
grant execute on function public.owns_review(uuid) to authenticated, service_role;

-- At most 3 photos per review, 5 attachments per ticket.
create function public.review_photos_limit() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.review_photos p where p.review_id = new.review_id) >= 3 then
    raise exception 'a review can have at most 3 photos' using errcode = '23514';
  end if;
  return new;
end $$;
create trigger review_photos_limit_ins before insert on public.review_photos
  for each row execute function public.review_photos_limit();

create function public.support_attachments_limit() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.support_attachments a where a.ticket_id = new.ticket_id) >= 5 then
    raise exception 'a ticket can have at most 5 attachments' using errcode = '23514';
  end if;
  return new;
end $$;
create trigger support_attachments_limit_ins before insert on public.support_attachments
  for each row execute function public.support_attachments_limit();

-- A new photo sends a published review back to moderation, like a text edit does (0005).
create function public.review_photos_remoderate() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.reviews set status = 'pending' where id = new.review_id and status = 'published';
  return null;
end $$;
create trigger review_photos_remoderate_ins after insert on public.review_photos
  for each row execute function public.review_photos_remoderate();

-- Trigger-only definer functions are not callable through the API.
revoke execute on function public.review_photos_limit(), public.support_attachments_limit(),
  public.review_photos_remoderate()
  from public, anon, authenticated;

-- RLS + privileges -----------------------------------------------------------------
alter table public.review_photos       enable row level security;
alter table public.support_attachments enable row level security;

revoke all on public.review_photos, public.support_attachments from anon, authenticated;
-- user_id stays private on review photos (anonymous reviews): column-level select only.
grant select (id, review_id, path, created_at) on public.review_photos to anon, authenticated;
grant insert (review_id, user_id, path) on public.review_photos to authenticated;
grant delete on public.review_photos to authenticated;
grant select, delete on public.support_attachments to authenticated;
grant insert (ticket_id, message_id, user_id, path) on public.support_attachments to authenticated;
grant all on public.review_photos, public.support_attachments to service_role;

-- Review photos are public only while their review is published; the owner always sees their own.
create policy review_photos_read on public.review_photos
  for select to anon, authenticated
  using (user_id = (select auth.uid())
         or exists (select 1 from public.reviews r where r.id = review_photos.review_id and r.status = 'published'));
create policy review_photos_owner_insert on public.review_photos
  for insert to authenticated
  with check (user_id = (select auth.uid()) and public.owns_review(review_id));
create policy review_photos_owner_delete on public.review_photos
  for delete to authenticated using (user_id = (select auth.uid()));

create policy support_attachments_owner_select on public.support_attachments
  for select to authenticated using (user_id = (select auth.uid()));
create policy support_attachments_owner_insert on public.support_attachments
  for insert to authenticated
  with check (user_id = (select auth.uid())
              and exists (select 1 from public.support_tickets t
                          where t.id = ticket_id and t.user_id = (select auth.uid()))
              and (message_id is null
                   or exists (select 1 from public.support_messages m
                              where m.id = message_id and m.ticket_id = support_attachments.ticket_id)));
create policy support_attachments_owner_delete on public.support_attachments
  for delete to authenticated using (user_id = (select auth.uid()));

-- Storage policies -------------------------------------------------------------------
-- Upload/delete only inside your own `<user_id>/` folder. No update policy: files are immutable.
create policy review_photos_upload on storage.objects
  for insert to authenticated
  with check (bucket_id = 'review-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy review_photos_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'review-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
-- Readable by anyone while linked to a visible (published or own) review_photos row; always by the owner.
create policy review_photos_download on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'review-photos'
         and ((storage.foldername(name))[1] = (select auth.uid())::text
              or exists (select 1 from public.review_photos p where p.path = objects.name)));

create policy support_attachments_upload on storage.objects
  for insert to authenticated
  with check (bucket_id = 'support-attachments' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy support_attachments_download on storage.objects
  for select to authenticated
  using (bucket_id = 'support-attachments' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy support_attachments_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'support-attachments' and (storage.foldername(name))[1] = (select auth.uid())::text);
