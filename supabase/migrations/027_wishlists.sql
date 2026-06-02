-- Wishlist: users can heart/save listings for later.
-- price_at_save lets us detect when the seller drops the price.

create table if not exists public.wishlists (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  listing_id    uuid not null references public.listings(id) on delete cascade,
  price_at_save integer not null,
  created_at    timestamptz not null default now(),
  unique (user_id, listing_id)
);

alter table public.wishlists enable row level security;

-- Users can only see and manage their own wishlist entries
create policy "wishlist_select" on public.wishlists
  for select using (auth.uid() = user_id);

create policy "wishlist_insert" on public.wishlists
  for insert with check (auth.uid() = user_id);

create policy "wishlist_delete" on public.wishlists
  for delete using (auth.uid() = user_id);

-- Service role needs read access to send price-drop notifications
create policy "wishlist_service_select" on public.wishlists
  for select using (true);
