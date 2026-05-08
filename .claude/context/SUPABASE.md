# Supabase & Base de datos — K&A Dev Budget

## Proyecto
```
URL:  https://lzwpfmrmoagnojfnthjo.supabase.co
Ref:  lzwpfmrmoagnojfnthjo
```

## Tablas existentes

### profiles
```sql
id          uuid (FK auth.users)
email       text
full_name   text
role        app_role  -- 'superadmin' | 'partner' | 'user'
is_active   boolean
partner_id  uuid (FK profiles)
created_at  timestamptz
```

### accounts
```sql
id          uuid PK
user_id     uuid FK auth.users
name        text
balance     numeric(14,2)  -- actualizado por triggers
bank_slug   text  -- bancolombia|nequi|nu|bbva|davivienda|banco-bogota|rappicard|efectivo
bank_name   text
color       text  -- hex del banco
type        text  -- 'checking'|'savings'|'cash'
created_at  timestamptz
```

### transactions
```sql
id           uuid PK
user_id      uuid FK auth.users
account_id   uuid FK accounts (nullable)
portfolio_id uuid FK portfolios
concept      text
amount       numeric(14,2)
type         text  -- 'income' | 'expense'
category     text
notes        text
receipt_url  text
date         date
is_scheduled boolean DEFAULT false
created_at   timestamptz
```

### debts
```sql
id               uuid PK
user_id          uuid FK auth.users
name             text
total_amount     numeric(14,2)
paid_amount      numeric(14,2) DEFAULT 0
remaining_amount numeric(14,2)  -- calculado por trigger
due_date         date
status           text  -- 'active'|'paid'|'overdue'
type             text  -- 'personal'|'household'
creditor         text
created_at       timestamptz
```

### scheduled_payments
```sql
id           uuid PK
user_id      uuid FK auth.users
portfolio_id uuid FK portfolios
concept      text
amount       numeric(14,2)
day_of_month int  -- 1-31
account_id   uuid FK accounts
category     text
type         text  -- 'expense'
is_active    boolean DEFAULT true
last_sent    timestamptz
alert_email  text
created_at   timestamptz
```

### shared_expenses
```sql
id             uuid PK
user_id        uuid FK auth.users
description    text
amount         numeric(14,2)
paid_by        paid_by_type  -- 'kevin'|'angely'|'both'
split_type     split_type    -- 'equal'|'custom'|'one_pays_all'|'by_income'|'personal'
kevin_share    numeric(5,2)  -- porcentaje
angely_share   numeric(5,2)
kevin_amount   numeric(14,2)
angely_amount  numeric(14,2)
category       text
account_id     uuid FK accounts
date           date
notes          text
status         text  -- 'pending'|'settled'
created_at     timestamptz
```

### account_transfers (NUEVA — crear si no existe)
```sql
id           uuid PK DEFAULT gen_random_uuid()
user_id      uuid FK auth.users
from_account uuid FK accounts
to_account   uuid FK accounts
amount       numeric(14,2) CHECK (amount > 0)
description  text
date         date DEFAULT CURRENT_DATE
created_at   timestamptz DEFAULT now()
```

### bank_catalog
```sql
id     uuid PK
name   text
slug   text UNIQUE
color  text
```

## RLS — Políticas activas

### profiles
```sql
-- profiles_own: cada usuario ve/edita solo su fila
USING (id = auth.uid())

-- profiles_admin_view: superadmin ve todos
USING (is_superadmin() OR id = auth.uid())

-- IMPORTANTE: is_superadmin() es SECURITY DEFINER
-- para evitar recursión infinita en la política
```

### Todas las demás tablas
```sql
-- Patrón estándar
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid())
```

## Triggers importantes

### balance de cuentas
El trigger `trg_update_account_balance` actualiza
`accounts.balance` automáticamente al insertar/eliminar
en `transactions`. **NO calcular balances en Angular.**

### remaining_amount en debts
El trigger actualiza `remaining_amount = total_amount - paid_amount`
al modificar `paid_amount`.

## Edge Functions desplegadas

### admin-create-user
```typescript
// Invocación desde Angular
const { data, error } = await this.supabase.client
  .functions.invoke('admin-create-user', {
    body: { email, full_name, role, partner_id }
  });
```
Requiere JWT válido — obtener sesión fresca antes:
```typescript
const { data: s } = await this.supabase.client.auth.getSession();
const token = s?.session?.access_token;
```

### admin-update-user
```typescript
const { data, error } = await this.supabase.client
  .functions.invoke('admin-update-user', {
    body: { userId, full_name, role, is_active }
  });
```

## Vistas útiles (crear si no existen)

### v_monthly_summary
```sql
CREATE OR REPLACE VIEW v_monthly_summary AS
SELECT
  user_id,
  DATE_TRUNC('month', date) AS month,
  SUM(CASE WHEN type='income' THEN amount ELSE 0 END) AS income,
  SUM(CASE WHEN type='expense' THEN amount ELSE 0 END) AS expenses,
  SUM(CASE WHEN type='income' THEN amount ELSE -amount END) AS net
FROM transactions
GROUP BY user_id, DATE_TRUNC('month', date)
ORDER BY month DESC;
```

### v_category_summary
```sql
CREATE OR REPLACE VIEW v_category_summary AS
SELECT
  user_id,
  DATE_TRUNC('month', date) AS month,
  category,
  SUM(amount) AS total,
  COUNT(*) AS count
FROM transactions
WHERE type = 'expense'
GROUP BY user_id, DATE_TRUNC('month', date), category;
```

## Función is_superadmin (SECURITY DEFINER)
```sql
CREATE OR REPLACE FUNCTION is_superadmin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = 'superadmin'
  );
$$;
```

## Categorías de transacción estándar

### Ingresos
```
Nómina | Transferencia | Freelance | Arriendo recibido
Aporte al hogar | Otro ingreso
```

### Gastos
```
Alimentación | Servicios públicos | Arriendo | Transporte
Salud | Tecnología | Entretenimiento | Deudas | Pago deuda
Aporte al hogar | Otros gastos
```

## Consultas frecuentes

### Cargar transacciones del usuario actual
```typescript
const { data, error } = await this.supabase.client
  .from('transactions')
  .select('*')
  .order('date', { ascending: false })
  .order('created_at', { ascending: false });
```

### Insertar transacción con trigger de balance
```typescript
const { error } = await this.supabase.client
  .from('transactions')
  .insert({
    user_id: userId,
    account_id: accountId,
    concept,
    amount,
    type: 'expense',
    category,
    date: new Date().toISOString().split('T')[0],
  });
// El trigger actualiza accounts.balance automáticamente
```

### Traslado entre cuentas
```sql
-- Ejecutar en SQL Editor o via RPC
INSERT INTO account_transfers
  (user_id, from_account, to_account, amount, description, date)
VALUES
  ($1, $2, $3, $4, $5, $6);
-- El trigger actualiza saldos de ambas cuentas
```
