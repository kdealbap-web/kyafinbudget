# Bugs pendientes — K&A Dev Budget

## Prioridad de ejecución
1. FIX-01 Locale es-CO (bloquea moneda en toda la app)
2. FIX-02 Dashboard aportes Angely (dato incorrecto visible)
3. FIX-03 Wedding monto pagado no se resta (bug de negocio)
4. FIX-04 Pago deuda no crea transacción
5. FIX-05 Scheduled no crea transacción al ejecutar
6. FIX-06 Traslados entre cuentas (feature nuevo)
7. FIX-07 Doble clic en type-selector (UX)
8. FIX-08 Input fecha estilo raro (UI)
9. FIX-09 Logos banco pequeños (UI)
10. FIX-10 Wedding dashboard % pagado
11. FIX-11 Wedding gastos — solo gráfica sin cards

---

## FIX-01 — Locale es-CO no registrado (NG0701)

**Error en consola:**
```
NG02100: InvalidPipeArgument: 'NG0701: Missing locale data
for the locale "es-CO".' for pipe '_DecimalPipe'
```

**Archivos a modificar:**
- `src/main.ts`
- `src/app/app.config.ts`

**Fix en main.ts** — agregar ANTES de bootstrapApplication:
```typescript
import { registerLocaleData } from '@angular/common';
import localeEsCO from '@angular/common/locales/es-CO';
import localeEsCOExtra from '@angular/common/locales/extra/es-CO';
registerLocaleData(localeEsCO, 'es-CO', localeEsCOExtra);
```

**Fix en app.config.ts** — agregar en providers[]:
```typescript
import { LOCALE_ID } from '@angular/core';
{ provide: LOCALE_ID, useValue: 'es-CO' }
```

**Test:** reiniciar `ng serve` → sin errores NG0701 en consola.
Moneda debe verse: `$1.250.000`

---

## FIX-02 — Dashboard: Angely muestra $0 en aportes

**Datos reales:**
- Angely hizo "Aporte A Kevin para la casa" $1.040.000
  → `transactions.id = f9dae4fc` → type='expense', category='Alimentación'
- Tiene scheduled activo "CUOTA MOTO OFERO" $335.000

**Causa:** lógica de aportes solo cuenta ingresos,
no gastos de Angely hacia el hogar.

**SQL a ejecutar primero en Supabase:**
```sql
UPDATE transactions
SET category = 'Aporte al hogar'
WHERE id = 'f9dae4fc-9648-49e2-a784-4392a40ce276';
```

**Fix en dashboard.component.ts:**
```typescript
aporteAngely = computed(() => {
  const ANGELY = '88e8ae3b-7264-4a12-8b2a-b72dca73d74f';

  // Gastos de Angely marcados como aporte al hogar
  const txTotal = this.transactions()
    .filter(t =>
      t.user_id === ANGELY &&
      t.type === 'expense' &&
      (t.category === 'Aporte al hogar' ||
       t.concept?.toLowerCase().includes('aporte') ||
       t.concept?.toLowerCase().includes('casa'))
    )
    .reduce((sum, t) => sum + Number(t.amount), 0);

  // Pagos programados activos de Angely
  const scheduledTotal = this.scheduledPayments()
    .filter(s => s.user_id === ANGELY && s.is_active)
    .reduce((sum, s) => sum + Number(s.amount), 0);

  return txTotal + scheduledTotal;
});
```

**Test:** dashboard debe mostrar Angely: ~$1.375.000

---

## FIX-03 — Wedding: monto pagado no se resta

**Síntoma:** pago de $600.000 a SoloNovias registrado pero:
```
Pagado:   $0        ← debería ser $600.000
Pendiente: $3.000.000 ← debería ser $2.400.000
```

**Investigar primero:**
```typescript
// Verificar nombre real de la tabla
const { data } = await supabase.from('wedding_budget_items').select('*').limit(1);
console.log(data); // ver columnas disponibles
```

**Fix en wedding.service.ts → registerPayment():**
```typescript
// Después de insertar el pago, actualizar paid_amount
const newPaid = (item.paid_amount ?? 0) + paymentAmount;
const { error } = await this.supabase.client
  .from('wedding_budget_items')  // verificar nombre real
  .update({ paid_amount: newPaid })
  .eq('id', itemId);
```

**Fix en componente → pendingAmount:**
```typescript
pendingAmount = computed(() =>
  item.total_amount - (item.paid_amount ?? 0)
);
```

**Test:** registrar pago → montos deben actualizarse en tiempo real.

---

## FIX-04 — Pago de deuda no crea transacción

**Síntoma:** al pagar una deuda desde /debts el saldo
de la cuenta baja pero NO aparece en /transactions.

**Fix en debt.service.ts → registerPayment():**
Después de actualizar `paid_amount`, insertar en transactions:
```typescript
await this.supabase.client
  .from('transactions')
  .insert({
    user_id: userId,
    account_id: accountId,
    portfolio_id: debt.portfolio_id ?? null,
    concept: `Pago deuda: ${debt.name}`,
    amount: paymentAmount,
    type: 'expense',
    category: 'Pago deuda',
    date: new Date().toISOString().split('T')[0],
    notes: `Acreedor: ${debt.creditor ?? debt.name}`,
    is_scheduled: false
  });
```

**Test:** pagar deuda → debe aparecer en /transactions
como gasto con categoría "Pago deuda".

---

## FIX-05 — Scheduled: ejecutar pago no crea transacción

**Síntoma:** al marcar un pago programado como ejecutado
no aparece en el historial de transacciones.

**Fix en scheduled.service.ts → executePayment():**
```typescript
async executePayment(payment: ScheduledPayment): Promise<boolean> {
  this.progressBar.start();
  try {
    // 1. Crear transacción
    const { error: txError } = await this.supabase.client
      .from('transactions')
      .insert({
        user_id: payment.user_id,
        account_id: payment.account_id,
        portfolio_id: payment.portfolio_id ?? null,
        concept: payment.concept,
        amount: payment.amount,
        type: 'expense',
        category: payment.category,
        date: new Date().toISOString().split('T')[0],
        is_scheduled: true
      });
    if (txError) throw txError;

    // 2. Actualizar last_sent
    await this.supabase.client
      .from('scheduled_payments')
      .update({ last_sent: new Date().toISOString() })
      .eq('id', payment.id);

    this.progressBar.complete();
    this.toast.success(`Pago "${payment.concept}" ejecutado`);
    return true;
  } catch {
    this.progressBar.error();
    this.toast.error('Error al ejecutar el pago');
    return false;
  }
}
```

**Test:** ejecutar pago programado → aparece en /transactions.

---

## FIX-06 — Traslados entre cuentas (feature nuevo)

**SQL a ejecutar en Supabase:**
```sql
CREATE TABLE IF NOT EXISTS account_transfers (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  from_account  uuid REFERENCES accounts(id) ON DELETE SET NULL,
  to_account    uuid REFERENCES accounts(id) ON DELETE SET NULL,
  amount        numeric(14,2) NOT NULL CHECK (amount > 0),
  description   text,
  date          date NOT NULL DEFAULT CURRENT_DATE,
  created_at    timestamptz DEFAULT now()
);

ALTER TABLE account_transfers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "transfers_own" ON account_transfers
  FOR ALL USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE OR REPLACE FUNCTION process_account_transfer()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  UPDATE accounts SET balance = balance - NEW.amount
  WHERE id = NEW.from_account;
  UPDATE accounts SET balance = balance + NEW.amount
  WHERE id = NEW.to_account;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_account_transfer
AFTER INSERT ON account_transfers
FOR EACH ROW EXECUTE FUNCTION process_account_transfer();
```

**Componente nuevo:** `AccountTransferComponent` (modal)
- Campos: cuenta origen, cuenta destino, monto, descripción, fecha
- Validación: origen ≠ destino, monto ≤ saldo origen
- Al guardar: INSERT → trigger actualiza saldos
- Botón "Trasladar" visible en /accounts

**Historial en /accounts:**
- Tabla "Movimientos" con: fecha, desde, hacia, monto, tipo
- Tipos: Traslado (azul) | Ajuste saldo (ámbar)

**Test:** trasladar $100.000 de cuenta A a B →
saldo A baja $100.000, saldo B sube $100.000,
aparece en historial.

---

## FIX-07 — Doble clic en transaction-type-selector

**Síntoma:** primer clic no navega, necesita segundo clic.

**Causa probable:** signal intermedia antes de router.navigate().

**Fix:** reemplazar (click) + navigate() por routerLink directo:
```html
<!-- En transaction-type-selector.component.html -->
<a routerLink="/transactions/new/income" class="...card...">
  <!-- contenido tarjeta INGRESO -->
</a>
<a routerLink="/transactions/new/expense" class="...card...">
  <!-- contenido tarjeta GASTO -->
</a>
```

**Test:** un solo clic navega correctamente.

---

## FIX-08 — Input fecha estilo raro

**Fix en styles.scss** (agregar al final):
```scss
input[type="date"] {
  color-scheme: light;
  appearance: none;
  -webkit-appearance: none;
}
.dark input[type="date"] { color-scheme: dark; }
input[type="date"]::-webkit-calendar-picker-indicator {
  opacity: 0.5;
  cursor: pointer;
}
.dark input[type="date"]::-webkit-calendar-picker-indicator {
  filter: invert(1);
  opacity: 0.5;
}
input[type="date"]::-webkit-datetime-edit { color: inherit; }
```

**Fix en formularios:** usar clase `f360-input` en el input fecha.

**Test:** input fecha idéntico a los demás inputs en modo claro y oscuro.

---

## FIX-09 — Logos banco pequeños en formularios

**Fix en bank-logo.component.ts:**
```typescript
sizeClass = computed(() => ({
  sm: 'w-8 h-8',
  md: 'w-11 h-11',  // aumentado
  lg: 'w-14 h-14',
}[this.size()]));
```

**Fix en income-form y expense-form:**
```html
<app-bank-logo
  [slug]="account.bank_slug ?? ''"
  [name]="account.name"
  [color]="account.color ?? '#64748B'"
  size="md">
</app-bank-logo>
```

**Test:** logos claramente visibles en selector de cuentas.

---

## FIX-10 — Wedding dashboard: mostrar % pagado

**Agregar computed en wedding.component.ts:**
```typescript
totalBudget     = computed(() => this.items().reduce((s,i) => s + i.total_amount, 0));
totalPaid       = computed(() => this.items().reduce((s,i) => s + (i.paid_amount ?? 0), 0));
totalPending    = computed(() => this.totalBudget() - this.totalPaid());
paymentProgress = computed(() =>
  this.totalBudget() > 0
    ? Math.round((this.totalPaid() / this.totalBudget()) * 100)
    : 0);
```

**Agregar card de progreso en el dashboard de boda.**

---

## FIX-11 — Wedding gastos: eliminar cards duplicadas

**Síntoma:** hay una gráfica de barras Y cards por cada
gasto debajo — duplicado y confuso.

**Fix:** eliminar el bloque de cards individuales por gasto.
Dejar SOLO la gráfica horizontal con:
- Barra por categoría (pagado vs pendiente)
- Click en barra → lista de pagos de esa categoría inline
- Tooltip con monto exacto en COP

---

## Cómo testear cada fix

### Local
```bash
ng serve --configuration development
# Abrir http://localhost:4200
# Revisar consola de DevTools sin errores
```

### Producción
```bash
git add .
git commit -m "fix: descripción del fix"
git push origin prod
# Vercel redespliega automáticamente
# Verificar en: https://kyafinbudget-git-prod-kdealbap-7963s-projects.vercel.app
```

### Verificar Supabase
```
Dashboard → Table Editor → verificar datos
Dashboard → Auth → Logs → verificar sin errores
```
