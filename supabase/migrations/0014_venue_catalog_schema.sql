-- 0014_venue_catalog_schema.sql
-- Adds canonical catalog columns on public.venues: price_range ('$', '$$', '$$$', '$$$$')
-- and optional validated https image_url. Backward-compatible defaults preserve existing rows.

alter table public.venues
  add column if not exists price_range text not null default '$$'
    constraint venues_price_range_check check (price_range in ('$', '$$', '$$$', '$$$$')),
  add column if not exists image_url text
    constraint venues_image_url_https check (image_url is null or image_url ~* '^https://[^@/]+(/|$)');
