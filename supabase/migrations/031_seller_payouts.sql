-- Migration 031: Seller bank details + payout queue

-- Seller bank details (one per seller)
create table if not exists seller_bank_details (
  id                  uuid primary key default gen_random_uuid(),
  seller_id           uuid not null references auth.users(id) on delete cascade,
  account_holder_name text not null,
  bank_name           text not null,
  account_number      text not null,
  branch_code         text not null,
  account_type        text not null default 'cheque', -- cheque | savings
  verified            boolean not null default false,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (seller_id)
);

alter table seller_bank_details enable row level security;
create policy "Sellers manage own bank details"
  on seller_bank_details for all using (auth.uid() = seller_id);

-- Seller payout queue (one row per completed order)
create table if not exists seller_payouts (
  id              uuid primary key default gen_random_uuid(),
  order_id        uuid not null references orders(id) on delete cascade,
  seller_id       uuid not null references auth.users(id),
  amount_cents    integer not null,
  status          text not null default 'pending'
                  check (status in ('pending', 'processing', 'paid', 'failed', 'held')),
  held_reason     text,
  paid_at         timestamptz,
  paid_by         uuid references auth.users(id), -- Praesignis admin who marked it paid
  reference       text,    -- EFT reference number
  bank_snapshot   jsonb,   -- snapshot of bank details at time of payout
  created_at      timestamptz not null default now(),
  unique (order_id)
);

alter table seller_payouts enable row level security;
-- Sellers can see their own payouts
create policy "Sellers view own payouts"
  on seller_payouts for select using (auth.uid() = seller_id);
