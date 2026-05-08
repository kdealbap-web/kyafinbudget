# Módulos pendientes — Alta prioridad

## Estado actual de módulos

| Módulo | Estado |
|--------|--------|
| Dashboard | ✅ Completo (con bug FIX-02) |
| Transacciones | ✅ Completo |
| Cuentas | ✅ Completo (falta traslados FIX-06) |
| Deudas | ✅ Completo (con bug FIX-04) |
| Pagos programados | ✅ Completo (con bug FIX-05) |
| Gastos compartidos | ✅ Completo |
| Admin/users | ✅ Completo |
| Wedding | ✅ Completo (con bugs FIX-03,10,11) |
| **Plan de ahorro** | 🔴 Pendiente |
| **Reportes y gráficas** | 🔴 Pendiente |
| **Notificaciones** | 🔴 Pendiente |

---

## MÓDULO: Plan de ahorro con IA

### Tablas SQL a crear
```sql
CREATE TYPE saving_goal_type AS ENUM ('personal', 'household');
CREATE TYPE saving_goal_status AS ENUM ('active','paused','completed','cancelled');

CREATE TABLE saving_goals (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  name            text NOT NULL,
  description     text,
  goal_type       saving_goal_type NOT NULL DEFAULT 'personal',
  owner           text NOT NULL DEFAULT 'kevin'
                  CHECK (owner IN ('kevin','angely','both')),
  target_amount   numeric(14,2) NOT NULL CHECK (target_amount > 0),
  current_amount  numeric(14,2) NOT NULL DEFAULT 0,
  monthly_target  numeric(14,2),
  target_date     date,
  account_id      uuid REFERENCES accounts(id) ON DELETE SET NULL,
  category        text NOT NULL DEFAULT 'general',
  status          saving_goal_status NOT NULL DEFAULT 'active',
  ai_suggestion   text,
  ai_monthly_rec  numeric(14,2),
  priority        int DEFAULT 1 CHECK (priority BETWEEN 1 AND 3),
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

CREATE TABLE saving_contributions (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id        uuid REFERENCES saving_goals(id) ON DELETE CASCADE,
  user_id        uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  amount         numeric(14,2) NOT NULL CHECK (amount > 0),
  account_id     uuid REFERENCES accounts(id) ON DELETE SET NULL,
  contributed_by text NOT NULL CHECK (contributed_by IN ('kevin','angely')),
  note           text,
  date           date NOT NULL DEFAULT CURRENT_DATE,
  created_at     timestamptz DEFAULT now()
);

-- Trigger: actualizar current_amount y status
CREATE OR REPLACE FUNCTION update_goal_amount()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  UPDATE saving_goals
  SET current_amount = current_amount + NEW.amount,
      status = CASE
        WHEN current_amount + NEW.amount >= target_amount
        THEN 'completed' ELSE status END,
      updated_at = now()
  WHERE id = NEW.goal_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_update_goal_amount
AFTER INSERT ON saving_contributions
FOR EACH ROW EXECUTE FUNCTION update_goal_amount();

ALTER TABLE saving_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE saving_contributions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "saving_goals_own" ON saving_goals
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "saving_contributions_own" ON saving_contributions
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
```

### Integración con IA (Claude API)
```typescript
// En saving-goal.service.ts
async getAISuggestion(goal: SavingGoal): Promise<void> {
  // Recolectar contexto financiero real
  const transactions = // últimas 90 transacciones
  const avgIncome = // promedio ingresos últimos 3 meses
  const avgExpense = // promedio gastos últimos 3 meses
  const activeDebts = // deudas activas
  const activeGoals = // otras metas activas

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      system: `Eres un asesor financiero personal experto en finanzas
               colombianas. Analizas datos reales y das consejos concretos
               en español latinoamericano. Responde SOLO en JSON válido.`,
      messages: [{
        role: 'user',
        content: `Datos financieros reales:
          - Ingreso mensual promedio: $${avgIncome} COP
          - Gasto mensual promedio: $${avgExpense} COP
          - Ahorro disponible estimado: $${avgIncome - avgExpense} COP/mes
          - Deuda total activa: $${totalDebt} COP
          - Meta: ${goal.name} por $${goal.target_amount} COP
          - Meses hasta la fecha límite: ${monthsToGoal}
          - Otras metas activas: ${activeGoals.length}

          Responde SOLO con este JSON:
          {
            "monthly_recommendation": number,
            "months_to_goal": number,
            "feasibility": "alta|media|baja",
            "suggestion": "consejo máx 120 chars",
            "warning": "advertencia o null",
            "tips": ["tip1 máx 80 chars", "tip2 máx 80 chars"]
          }`
      }]
    })
  });
  const data = await response.json();
  const result = JSON.parse(data.content[0].text);
  // Guardar en Supabase
  await this.supabase.client
    .from('saving_goals')
    .update({
      ai_suggestion: result.suggestion,
      ai_monthly_rec: result.monthly_recommendation
    })
    .eq('id', goal.id);
}
```

### Ruta
```typescript
{ path: 'saving-goals',
  loadComponent: () => import('./features/saving-goals/saving-goals.component')
    .then(m => m.SavingGoalsComponent),
  canActivate: [AuthGuard] }
```

---

## MÓDULO: Reportes y gráficas con IA

### Vistas SQL necesarias
Ver `SUPABASE.md` → sección "Vistas útiles"

### Gráficas a implementar (Chart.js)
1. **Flujo de caja** — Bar + Line combo (ingresos vs gastos + neto)
2. **Distribución gastos** — Doughnut por categoría del mes actual
3. **Tendencia categorías** — Line chart top 5 categorías
4. **Patrimonio por cuenta** — Bar horizontal ordenado

### Score financiero IA
```typescript
// Prompt para análisis completo
// Respuesta JSON esperada:
{
  "score": 75,  // 0-100
  "score_label": "Buena",  // Excelente|Buena|Regular|En riesgo
  "headline": "frase motivacional personalizada",
  "summary": "análisis 2-3 oraciones",
  "highlights": [
    { "type": "positive|warning|tip", "text": "observación" }
  ],
  "recommendations": [
    { "priority": "alta|media|baja", "action": "acción", "impact": "impacto" }
  ],
  "projection_3m": { "estimated_savings": number, "message": "proyección" }
}
```

---

## MÓDULO: Notificaciones inteligentes

### Tabla SQL
```sql
CREATE TYPE notification_type AS ENUM (
  'debt_due', 'scheduled_payment', 'goal_milestone',
  'budget_alert', 'unusual_expense', 'weekly_summary',
  'goal_suggestion', 'low_balance'
);

CREATE TABLE notifications (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  type         notification_type NOT NULL,
  title        text NOT NULL,
  message      text NOT NULL,
  action_url   text,
  action_label text,
  is_read      boolean NOT NULL DEFAULT false,
  is_ai        boolean NOT NULL DEFAULT false,
  priority     text NOT NULL DEFAULT 'medium'
               CHECK (priority IN ('low','medium','high','critical')),
  metadata     jsonb,
  created_at   timestamptz DEFAULT now()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notifications_own" ON notifications
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
```

### Integración en topbar
- Badge rojo con unreadCount en ícono campana
- Dropdown con últimas 8 notificaciones
- Click → markAsRead + navigate a action_url
- Badge "IA" en notificaciones generadas por IA

---

## Orden de construcción recomendado

```
1. Resolver todos los BUGS (ver BUGS.md)
2. Plan de ahorro (SQL → Service → List → Form)
3. Reportes (SQL views → Service → Charts → IA)
4. Notificaciones (SQL → Service → Bell → Page)
```
