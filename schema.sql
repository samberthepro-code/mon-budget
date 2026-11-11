-- Mon Budget : schéma Supabase
-- À exécuter dans Supabase > SQL Editor, avec un projet neuf.
create extension if not exists pgcrypto;

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('income','expense')),
  label text not null,
  amount numeric(14,2) not null check (amount > 0),
  currency text not null default 'EUR',
  transaction_date date not null,
  category text,
  note text,
  created_at timestamptz not null default now()
);
create table if not exists public.debts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null,
  creditor text not null,
  amount numeric(14,2) not null check (amount > 0),
  paid_amount numeric(14,2) not null default 0 check (paid_amount >= 0 and paid_amount <= amount),
  currency text not null default 'EUR',
  due_date date,
  status text not null default 'pending' check (status in ('pending','paid')),
  created_at timestamptz not null default now()
);
create table if not exists public.debt_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  debt_id uuid not null references public.debts(id) on delete cascade,
  transaction_id uuid references public.transactions(id) on delete set null,
  amount numeric(14,2) not null check (amount > 0),
  payment_date date not null,
  created_at timestamptz not null default now()
);

create table if not exists public.receivables (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null,
  debtor text not null,
  amount numeric(14,2) not null check (amount > 0),
  received_amount numeric(14,2) not null default 0 check (received_amount >= 0 and received_amount <= amount),
  currency text not null default 'EUR',
  due_date date,
  status text not null default 'pending' check (status in ('pending','received')),
  created_at timestamptz not null default now()
);

create table if not exists public.recurring_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null,
  type text not null check (type in ('income','expense')),
  amount numeric(14,2) not null check (amount > 0),
  currency text not null default 'EUR',
  frequency text not null check (frequency in ('weekly','biweekly','monthly','quarterly','yearly')),
  start_date date not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create table if not exists public.savings_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null,
  target_amount numeric(14,2) not null check (target_amount > 0),
  saved_amount numeric(14,2) not null default 0 check (saved_amount >= 0),
  currency text not null default 'EUR',
  created_at timestamptz not null default now()
);

-- Reconstitue l'historique des remboursements créés par les anciennes versions de l'application.
create unique index if not exists debt_payments_transaction_id_uidx on public.debt_payments(transaction_id) where transaction_id is not null;
insert into public.debt_payments(user_id,debt_id,transaction_id,amount,payment_date)
select t.user_id,d.id,t.id,t.amount,t.transaction_date
from public.transactions t
join public.debts d on d.user_id=t.user_id
  and t.label=('Remboursement : ' || d.label)
  and coalesce(t.note,'')=('Créancier : ' || d.creditor)
where t.category='Remboursement'
  and not exists (select 1 from public.debt_payments p where p.transaction_id=t.id)
on conflict do nothing;

alter table public.transactions enable row level security;
alter table public.debts enable row level security;
alter table public.receivables enable row level security;
alter table public.debt_payments enable row level security;
alter table public.recurring_rules enable row level security;
alter table public.savings_goals enable row level security;

drop policy if exists "transactions own rows" on public.transactions;
create policy "transactions own rows" on public.transactions for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "debts own rows" on public.debts;
create policy "debts own rows" on public.debts for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "debt payments own rows" on public.debt_payments;
create policy "debt payments own rows" on public.debt_payments for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "receivables own rows" on public.receivables;
create policy "receivables own rows" on public.receivables for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "recurrences own rows" on public.recurring_rules;
create policy "recurrences own rows" on public.recurring_rules for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "goals own rows" on public.savings_goals;
create policy "goals own rows" on public.savings_goals for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

grant usage on schema public to authenticated;
grant select,insert,update,delete on public.transactions,public.debts,public.debt_payments,public.receivables,public.recurring_rules,public.savings_goals to authenticated;
