# REDESIGN-BRIEF.md — finanzas360 (K&A Fin Budget)

**Para invocar a Claude Design / `/frontend-design` desde otra sesión.**

> Cómo usar este archivo: en la nueva sesión di a Claude:
> _"Lee `.claude/context/REDESIGN-BRIEF.md` y aplica el plan completo. Mantén toda la funcionalidad existente. No toques `.ts` salvo cuando se indique. Trabaja en una rama `ui/redesign-v3`."_

---

## 1. Producto en una frase

App **mobile-first** de finanzas personales para una pareja (**Kevin** & **Angely**, novios) con un módulo emblemático para **gastos de la boda 12-sep-2026**. Stack: Angular 21 standalone + signals, Tailwind v3, Supabase, Chart.js. Se usa **principalmente en celular**.

## 2. Identidad visual (NO INVENTAR)
 //PRIORIDAD DARME FACILIDAD AL USUARIO, que sea totalmente intuitivo, no tanto scroll, yo pueda explicar el flujo a cualquier usuario de manera UX/UI pro max. OMITEME todos esos tailwind genericos, quiero un sello personal, de esta herramienta.
- Logo **YA existe**: `/public/favicon/favicon.svg` (es el favicon del navegador). Es ese, dejar presente en todo el codigo **Nunca reemplazar por monogramas K&A o iniciales — eso fue un error que ya se revirtió.** Si necesitas un brand mark, usa ese SVG con `<img src="favicon/favicon.svg">` o el SVG inline original (cuadro `bg-gradient-to-br from-blue-600 to-blue-800` + path `M12 2C6.48 2 2 6.48 2 12...`).
- Nombre de la marca: **K&A Fin Budget** · subtítulo "Gestión financiera"
- Colores marca: **azul navy + dorado** (var `--color-blue-*`, `--color-gold-*` ya en `tailwind.config.js`)
- Color exclusivo de la sección de boda -- destacerlo: **terracota** (`--color-terra-*`) elegido por la novia
- Tipografía cargada en `index.html`: Geist (UI), Geist Mono (números), Fraunces (display), Cormorant Garamond (sólo wedding)
- Tokens completos: ver `tailwind.config.js` y `src/styles.scss` (capa `@layer components` con `.f360-*`)

## 3. Estado actual y dolores reales del usuario

> Estos son los reclamos textuales del propietario tras el último intento de rediseño:

1. **"Cambiaste el logo del sidebar sin que nadie lo pidiera."** ✅ Revertido al SVG reloj original.
2. **"Los iconos parecen de ChatGPT/emojis WhatsApp, poco profesionales."** Necesitan refinamiento (consistencia, peso 1.6–1.8, estilo Heroicons line / Phosphor regular). NO usar emojis nunca como íconos de UI.
3. **"En `/wedding` el monograma con K&A es feo, las letras se salen del círculo."** ✅ Hay que reemplazar por algo elegante: símbolo nupcial (dos anillos entrelazados SVG en gold), o tipografía Cormorant más grande sin contenedor circular. Letras NO deben sobrepasar.
4. **"Cards del dashboard general (Gastos por mes / Aportes Kevin&Angely / Evolución histórica) son enormes y NO aportan."** ✅ Eliminadas. Si las quieres reincorporar, hazlas mini-cards (≤ 120px alto) con datos reales útiles, no canvas vacíos.
5. **"En `/wedding` quita el filtro Mes/Histórico, muéstrame TODOS los gastos ordenados del más reciente al más viejo."** Ver §5.A.
6. **Bug crítico de sumas (puntos 7-8 del usuario):**
   - Casona del Prado: 2 pagos $300k+$300k → muestra "Pagado $300k" (debería $600k).
   - SoloNovias: 1 pago de $600k → muestra "Pagado $0".
   - Casona Catering: $300k+$400k → muestra "$400k" (debería $700k).
   - **Cards de resumen muestran cifras imposibles**: "Presupuesto $22M, Gastado $1.2M, Pendiente $22.2M, Disponible -$1.4M".
   - **Causa raíz identificada:** la columna `wedding_expenses.paid_amount` en Supabase queda desincronizada (probable trigger BD que sólo escribe el último pago en lugar de sumar). **FIX YA APLICADO en `wedding-expense.service.ts::loadBudgetWithExpenses`**: `paid_amount = SUM(payments.amount)` recalculado en cliente. Verifica que se note en UI; si persiste, revisar migraciones Supabase en `supabase/migrations/` y el trigger de `wedding_expense_payments`.
7. **"Color-code de cada gasto según % pagado":**
   - 🔴 **rojo** si pagado = 0 (pendiente total)
   - 🟠 **naranja** si pagado > 0 y < 50%
   - 🟡 **amarillo** si pagado ≥ 50% y < 100%
   - 🟢 **verde** si pagado = 100% (completado)
   - Usar el ring/border y el badge de la card del gasto. Mapear con un helper en `wedding-dashboard.component.ts`.
8. **"Sólo dejar el último presupuesto activo (boda real, fecha 2026-09-12)."** Esto es **dato de BD**: el usuario debe borrar manualmente los duplicados en Supabase, o agregar un botón "Eliminar presupuesto" (no existe hoy — sólo `enforceSingleInProgressBudget` que cambia status, no borra). **Tarea opcional**: agregar `deleteBudget(id)` al service + confirm dialog en UI. SQL de limpieza para que el usuario corra:
   ```sql
   delete from wedding_expense_payments where expense_id in (
     select id from wedding_expenses where wedding_budget_id != '<UUID_DEL_REAL>'
   );
   delete from wedding_expense_attachments where expense_id in (
     select id from wedding_expenses where wedding_budget_id != '<UUID_DEL_REAL>'
   );
   delete from wedding_expenses where wedding_budget_id != '<UUID_DEL_REAL>';
   delete from wedding_budgets where id != '<UUID_DEL_REAL>';
   ```
9. **"Ver de forma global cuánto pagué y cuánto debo."** Hero del wedding-dashboard ya tiene chips Disponible/Pendiente, pero los valores estaban mal por el bug 6. Una vez aplicado el fix del service, deberían cuadrar.

## 4. Personajes y datos fijos para el módulo `/wedding`

- **Pareja:** Kevin De Alba P · Angely Acosta
- **Fecha:** 12 de septiembre de 2026 (sábado) — XII · IX · MMXXVI
- **Ceremonia:** Parroquia San Luis Beltrán · 7:00 pm
- **Recepción:** Casona del Prado · cena & celebración
- **Invitados:** 100 (lista bien gestionada actualmente)
- **Frase emblema:** _"Dos vidas que se eligen no se suman: se vuelven un solo horizonte, una sola casa, un solo para siempre."_
- **Roadmap futuro (mencionar como teaser, no implementar):** módulo digital de invitaciones inteligente (envío + RSVP + recordatorios).

## 5. Plan concreto

### A. `wedding-dashboard.component.ts` — limpiar filtros

- Eliminar `selectedFilter`, `filteredSpent`, `filteredPending`, `expensesByMonth`, `setFilter`, `formatMonth`.
- Reemplazar `filteredExpenses` por:
  ```ts
  readonly sortedExpenses = computed(() =>
    [...this.expenses()].sort((a, b) =>
      (b.created_at ?? '').localeCompare(a.created_at ?? '')
    )
  );
  ```
- Helper de color por estado:
  ```ts
  expenseColor(e: WeddingExpense): 'red' | 'orange' | 'yellow' | 'green' | 'gray' {
    if (e.status === 'cancelled') return 'gray';
    const amt = Number(e.amount ?? 0);
    const paid = Number(e.paid_amount ?? 0);
    if (amt <= 0 || paid <= 0) return 'red';
    const pct = (paid / amt) * 100;
    if (pct >= 100) return 'green';
    if (pct >= 50) return 'yellow';
    return 'orange';
  }
  ```

### B. `wedding-dashboard.component.html` — gastos

- Quitar tabs "Este mes / Histórico" y todo el bloque agrupado por mes.
- Renderizar `@for (e of sortedExpenses(); track e.id)` con la card existente, pero:
  - Anillo izquierdo de 4px en color según `expenseColor(e)` (rojo/naranja/amarillo/verde/gris).
  - Badge de estado con el mismo color (no las clases viejas).
  - Barra de progreso del mismo color.
- Eliminar el filter `selectedFilter() === 'current'` y la stats grid `filteredSpent/filteredPending`.

### C. Hero `/wedding` — arreglar el "icono feo K&A"

Reemplazar el círculo con K&A por uno de estos dos patrones:

**Opción A (recomendada): símbolo nupcial SVG** — dos anillos entrelazados gold sobre fondo terra, con tipografía Cormorant para los nombres debajo:
```html
<svg viewBox="0 0 64 32" class="w-16 h-8 mx-auto" fill="none" stroke="currentColor">
  <circle cx="22" cy="16" r="11" stroke-width="2"/>
  <circle cx="42" cy="16" r="11" stroke-width="2"/>
</svg>
```

**Opción B: pura tipografía**, sin contenedor circular — nombres en Cormorant 60px italic con un divisor de filete dorado.

NO devolver el círculo navy con texto "K&A" dentro.

### D. Iconos sidebar — refinamiento

Auditar todos los SVG inline en `sidebar.component.html`. Mantener el set actual (Lucide-style line) pero:
- Stroke uniforme `1.8`
- `stroke-linecap="round"` y `stroke-linejoin="round"` en todos
- Tamaño 18-20px en todos los `nav-icon` (consistencia)
- En la cuenta del usuario al fondo del sidebar, también revisar.

### E. Dashboard general — simplificación ya aplicada

Las tres gráficas grandes (`#barCanvas`, `#doughnutCanvas`, `#lineCanvas`) fueron **eliminadas del HTML**, pero los `@ViewChild` siguen en TS. Decidir:
- **Opción A:** dejar los canvas escondidos (`<div class="hidden">`) — funciona ya, 0 trabajo. ✅ aplicado.
- **Opción B:** borrar también del `.ts` los `@ViewChild('barCanvas')`, `@ViewChild('doughnutCanvas')`, `@ViewChild('lineCanvas')` y todos los métodos de Chart.js asociados.

Reemplazar más adelante por **mini-stats útiles** (no canvas vacíos):
- Top 3 días de gasto del mes
- Aporte de Kevin vs Angely en una barra horizontal de 2 segmentos (sin chart, sólo CSS)
- Comparativa mes anterior vs actual en %

## 6. Estado del progreso (2026-05-07)

### ✅ Completado
- Sidebar logo SVG reloj original restaurado (sin K&A)
- Iconos del dashboard general sin emojis (SVG line-stroke)
- Hero `/wedding` con símbolo nupcial (dos anillos entrelazados gold) — sin círculo K&A feo
- Wedding: filtro Mes/Histórico eliminado, todos los gastos ordenados desc
- **Color-code por % pagado** (`expenseColor()`): rojo/naranja/amarillo/verde/gris en border-l, badge y barra
- **Filtro por estado de pago** (`statusFilter` signal + chips clickables con contadores)
- **Layout 2 columnas agrupado por categoría** (`filteredExpensesByCategory` computed)
- **Cards compactas**: padding p-3, monto + due_date + % en una sola línea, barra de 1px
- **Detalle inline al expandir** (`expandedExpenseId` signal + `toggleExpandExpense()`): pagos, montos, acciones rápidas — JUSTO debajo del card, sin scroll
- **Adjuntar comprobante** (foto/PDF) integrado en 2 lugares:
  - En el modal "Registrar pago" (input file con preview)
  - En cada fila de pago ya creado: ícono pequeño 24×24px (clip o ojo); si ya tiene comprobante muestra abrir, si no muestra adjuntar
- **Eliminar pago individual** (`deletePayment(expense, paymentId)`): borra row + comprobante del storage + best-effort la transacción asociada (matching por `concept`+`amount`+`date`)
- **`addReceiptToPayment(expenseId, paymentId, file)`** en service: sube archivo a `wedding/<userId>/<expenseId>/payment-<paymentId>/...` y registra como `WeddingExpenseAttachment` tipo Receipt
- **Dashboard general — exclusión de pagos de boda** (`loadTransactions` filtra `concept ilike '%Boda:%'`)
- **KPI "Gastos del período"** ahora muestra `totalExpenses()` real (antes mostraba `totalAportesHogar` mal etiquetado dando 0)
- **Fix consistencia widget de boda en dashboard general** — `loadWeddingWidget` ahora trae `payments` y recalcula `paid_amount = SUM(payments.amount)` igual que el wedding-dashboard. Los 4 valores (Presupuesto/Gastado/Pendiente/Disponible) deben coincidir entre ambas vistas.
- Selector de presupuestos / botón Nuevo / botón Editar **eliminados** del wedding-dashboard. El presupuesto vigente se autocarga vía `ngOnInit → sortedBudgets[0]`
- **Gráfica "Pagos por categoría"** rediseñada como lista editorial (sin canvas Chart.js): barras apiladas verde/ámbar, click expande detalle. Movida al final del módulo (antes de Exportar Excel).
- **Bug crítico**: `paid_amount` desincronizado en BD → fix de cliente en `loadBudgetWithExpenses` y `loadWeddingWidget` (ambas vistas calculan desde `SUM(payments.amount)`)

### ⏳ Pendiente
- [ ] Limpiar duplicados de presupuesto en BD (correr SQL § 3.8 reemplazando `<UUID_DEL_REAL>`)
- [ ] Auditar trigger Postgres en `wedding_expense_payments` para que mantenga `paid_amount` sincronizado server-side (eliminaría necesidad del workaround de cliente)
- [ ] Refinar iconos del sidebar para que se vean menos "ChatGPT/WhatsApp" (peso 1.6, estilo Phosphor regular)
- [ ] (Opcional) `deleteBudget(id)` en service + botón en UI
- [ ] (Opcional) Mini-stats compactas para dashboard general (top 3 días gasto, comparativa mes anterior, aportes K&A en barra horizontal CSS — no canvas)
- [ ] (Futuro) Módulo de invitaciones digitales (envío + RSVP + recordatorios)
- [ ] Hover-peek en cards de gasto (desktop) — actualmente sólo click toggle. CSS group-hover podría mostrar mini-preview sin alterar `expandedExpenseId`.

### 🚫 NO requiere cambios de BD
Toda la funcionalidad de comprobantes por pago usa `wedding_expense_attachments` existente con `storage_path` que incluye `payment-<id>` para trazabilidad. Sin migraciones.

## 7. Archivos clave

- `src/app/layout/sidebar/sidebar.component.html` — sidebar
- `src/app/features/dashboard/dashboard.component.html` — home
- `src/app/features/wedding/wedding-dashboard/wedding-dashboard.component.html` — boda UI
- `src/app/features/wedding/wedding-dashboard/wedding-dashboard.component.ts` — boda lógica
- `src/app/core/services/wedding-expense.service.ts` — API/Supabase
- `src/styles.scss` — tokens y clases `.f360-*`
- `tailwind.config.js` — paleta + fonts
- `supabase/migrations/` — triggers a auditar si el bug de `paid_amount` reaparece

---

**Tono pedido:** profesional, calmo, editorial financiero (Mercury/Linear/Stripe). La sección de boda es la única licencia para ser ornamental — el resto es austero y confiable, pero se requiere que sea intuitivo y claro con el usuario, en todo lo de la boda debe ser algo mas .
