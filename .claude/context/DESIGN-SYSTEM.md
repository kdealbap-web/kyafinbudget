# Design System — K&A Dev Budget

## Paleta de colores

### Modo claro
```
Página:     bg-gray-50    (#F8FAFC)
Cards:      bg-white      (#FFFFFF)
Bordes:     border-gray-100 (#F3F4F6)
Texto 1°:   text-gray-900
Texto 2°:   text-gray-500
Texto 3°:   text-gray-400
```

### Modo oscuro
```
Página:     dark:bg-gray-950  (#0F172A)
Cards:      dark:bg-gray-900  (#111827)
Bordes:     dark:border-gray-800
Texto 1°:   dark:text-gray-100
Texto 2°:   dark:text-gray-400
Texto 3°:   dark:text-gray-500
```

### Colores de marca
```
Primary:    #1E40AF  (azul)
Primary L:  #3B82F6
Primary XL: #60A5FA
Success:    #059669  (verde)
Danger:     #DC2626  (rojo)
Warning:    #D97706  (ámbar)
Purple:     #7C3AED
```

### Colores de banco
```
bancolombia: #FDD835
nequi:       #6B21A8
nu:          #820AD1
bbva:        #004481
davivienda:  #ED1C24
banco-bogota:#003087
rappicard:   #FF441A
efectivo:    #059669  (fallback — inicial 'E')
```

## Clases globales disponibles

```css
/* Cards */
.f360-card          /* bg-white dark:bg-gray-900 rounded-2xl shadow-sm border */

/* Inputs */
.f360-input         /* w-full rounded-xl border px-4 py-3 bg-white dark:bg-gray-800 */
.f360-label         /* text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 */
.f360-select        /* igual que f360-input con appearance-none */
.f360-textarea      /* igual que f360-input resize-none */
.f360-error         /* text-sm text-red-600 dark:text-red-400 mt-1 */

/* Botones */
.f360-btn-primary   /* bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-4 py-2.5 */
.f360-btn-secondary /* bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 */
.f360-btn-danger    /* bg-red-600 hover:bg-red-700 text-white rounded-xl */

/* Badges */
.f360-badge         /* text-xs font-medium px-2.5 py-0.5 rounded-full */

/* Layout */
.f360-page-header   /* flex items-center justify-between mb-6 */
.f360-page-title    /* text-2xl font-bold text-gray-900 dark:text-gray-100 */
.f360-page-subtitle /* text-sm text-gray-500 dark:text-gray-400 mt-0.5 */
```

## Estructura de página estándar
```html
<div class="min-h-full bg-gray-50 dark:bg-gray-950
            pt-6 px-4 md:px-6 pb-24 lg:pb-8">

  <!-- Header -->
  <div class="f360-page-header mb-6">
    <div>
      <h1 class="f360-page-title">Título</h1>
      <p class="f360-page-subtitle">Subtítulo</p>
    </div>
    <button class="f360-btn-primary">Acción</button>
  </div>

  <!-- Contenido -->
  ...

</div>
```

> **IMPORTANTE**: `pb-24` en mobile para no tapar el bottom nav.
> `lg:pb-8` en desktop donde no hay bottom nav.

## Animaciones disponibles
```css
.animate-fade-in          /* opacity 0→1 */
.animate-slide-up         /* translateY 20px→0 */
.animate-slide-down       /* translateY -20px→0 */
.animate-slide-in-right   /* translateX 20px→0 */
.animate-pulse-soft       /* pulse suave */
.animate-shake            /* shake para errores */
```

## BankLogoComponent
```html
<app-bank-logo
  [slug]="account.bank_slug ?? ''"
  [name]="account.bank_name ?? account.name"
  [color]="account.color ?? '#64748B'"
  size="md">     <!-- sm | md | lg -->
</app-bank-logo>
```

Slugs con PNG: `bancolombia`, `nequi`, `nu`, `bbva`,
`davivienda`, `banco-bogota`, `rappicard`

`efectivo` → fallback con inicial 'E' en verde

## Input de fecha — estilo correcto
```html
<input
  type="date"
  formControlName="date"
  class="f360-input"
  [max]="today"
/>
```
```typescript
readonly today = new Date().toISOString().split('T')[0];
```

## Colores de progreso (metas, deudas)
```
< 25%   → bg-red-100   text-red-700   dark:bg-red-900/20
25-74%  → bg-amber-100 text-amber-700 dark:bg-amber-900/20
≥ 75%   → bg-emerald-100 text-emerald-700 dark:bg-emerald-900/20
= 100%  → bg-purple-100  text-purple-700  dark:bg-purple-900/20
```

## Colores de urgencia (fechas de vencimiento)
```
< 7 días  → text-red-600   dark:text-red-400   (crítico)
< 30 días → text-amber-600 dark:text-amber-400 (advertencia)
≥ 30 días → text-emerald-600 dark:text-emerald-400 (ok)
```

## Tabs estándar
```html
<div class="flex gap-1 mb-4 p-1 bg-gray-100 dark:bg-gray-800
            rounded-xl w-fit">
  <button
    (click)="activeTab.set('pendientes')"
    [ngClass]="activeTab() === 'pendientes'
      ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
      : 'text-gray-500 dark:text-gray-400'"
    class="px-4 py-2 rounded-lg text-sm font-medium
           transition-all duration-150 flex items-center gap-2">
    Pendientes
    <span class="text-xs px-2 py-0.5 rounded-full
                 bg-blue-100 text-blue-700
                 dark:bg-blue-900/40 dark:text-blue-300">
      {{ count() }}
    </span>
  </button>
</div>
```

## Skeleton loading
```html
@if (isLoading()) {
  <div class="space-y-3">
    @for (i of [1,2,3]; track i) {
      <div class="f360-card h-20 animate-pulse
                  bg-gray-100 dark:bg-gray-800">
      </div>
    }
  </div>
}
```

## Empty state
```html
<div class="f360-card p-12 text-center">
  <svg width="48" height="48" viewBox="0 0 48 48" fill="none"
       class="mx-auto mb-4 text-gray-300 dark:text-gray-600">
    <!-- icono SVG contextual -->
  </svg>
  <p class="text-gray-500 dark:text-gray-400 font-medium">
    Sin registros
  </p>
  <p class="text-sm text-gray-400 dark:text-gray-500 mt-1">
    Crea el primer registro
  </p>
</div>
```

## Chart.js — dark mode helper
```typescript
private getChartTheme() {
  const isDark = document.documentElement
    .classList.contains('dark');
  return {
    gridColor: isDark
      ? 'rgba(255,255,255,0.08)'
      : 'rgba(0,0,0,0.06)',
    labelColor: isDark ? '#9CA3AF' : '#6B7280',
    tooltipBg: isDark ? '#1F2937' : '#FFFFFF',
    tooltipColor: isDark ? '#F9FAFB' : '#111827',
  };
}
```
