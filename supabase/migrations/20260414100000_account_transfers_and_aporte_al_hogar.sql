-- FIX 2: Traslados entre cuentas (account_transfers) + trigger de saldos
-- FIX 1: Normalizar categoría "Aporte al hogar" para transacción real de Angely

create table if not exists public.account_transfers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete cascade,
  from_account uuid references public.accounts (id) on delete set null,
  to_account uuid references public.accounts (id) on delete set null,
  amount numeric(14, 2) not null check (amount > 0),
  description text,
  date date not null default current_date,
  created_at timestamptz default now()
);

alter table public.account_transfers enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'account_transfers'
      and policyname = 'transfers_own'
  ) then
    create policy "transfers_own"
      on public.account_transfers
      for all
      using (user_id = auth.uid())
      with check (user_id = auth.uid());
  end if;
end $$;

create index if not exists idx_account_transfers_user_date
  on public.account_transfers (user_id, date desc, created_at desc);

create or replace function public.process_account_transfer()
returns trigger
language plpgsql
as $$
begin
  update public.accounts
  set balance = balance - new.amount
  where id = new.from_account;

  update public.accounts
  set balance = balance + new.amount
  where id = new.to_account;

  return new;
end;
$$;

drop trigger if exists trg_account_transfer on public.account_transfers;
create trigger trg_account_transfer
after insert on public.account_transfers
for each row execute function public.process_account_transfer();

-- Actualización puntual: Aporte real de Angely para que cuente como "Aporte al hogar"
update public.transactions
set category = 'Aporte al hogar'
where id = 'f9dae4fc-9648-49e2-a784-4392a40ce276'
  and user_id = '88e8ae3b-7264-4a12-8b2a-b72dca73d74f';
