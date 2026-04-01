import { Component, OnInit, OnDestroy, ElementRef, ViewChild, signal, computed, effect, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Chart, registerables, TooltipItem, Scale } from 'chart.js';
import { SupabaseService } from '../../core/services/supabase.service';
import { CurrencyCopPipe } from '../../shared/pipes/currency-cop.pipe';
import { RelativeDatePipe } from '../../shared/pipes/relative-date.pipe';

if (typeof window !== 'undefined') {
  Chart.register(...registerables);
}

// —— Interfaces ——————————————————————————————————————————————————————————————

interface Transaction {
  id: string;
  concept: string;
  amount: number;
  type: 'income' | 'expense';
  category: string;
  date: string;
  user_id: string;
  portfolio_id: string | null;
}

interface TopCategory {
  name: string;
  amount: number;
  percentage: number;
  emoji: string;
}

interface RecentTransaction extends Transaction {
  payerName: string;
  payerInitial: string;
}

interface WeddingBudgetWidget {
  id: string;
  event_name: string;
  event_date: string;
  total_budget: number;
  total_spent: number;
  total_pending: number;
  remaining: number;
  status: string;
}

interface UpcomingWeddingPayment {
  id: string;
  provider_name: string;
  remaining: number;
  due_date: string | null;
  status: string;
}


// —— Constantes ———————————————————————————————————————————————————————————————

const CATEGORY_EMOJIS: Record<string, string> = {
  'Arriendo': '🏠',
  'Servicios': '💡',
  'Alimentación': '🍔',
  'Transporte': '🚗',
  'Salud': '💊',
  'Entretenimiento': '🎬',
  'Educación': '📚',
  'Otros': '📦'
};

const MONTHS: string[] = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

// —— Componente ———————————————————————————————————————————————————————————————

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, CurrencyCopPipe, RelativeDatePipe],
  templateUrl: './dashboard.component.html'
})
export class DashboardComponent implements OnInit, OnDestroy {

  private supabase = inject(SupabaseService);

  @ViewChild('barCanvas') barCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('doughnutCanvas') doughnutCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('lineCanvas') lineCanvas!: ElementRef<HTMLCanvasElement>;

  private barChart?: Chart;
  private doughnutChart?: Chart;
  private lineChart?: Chart;

  // —— Signals ————————————————————————————————————————————————————————————————

  isLoading = signal(false);
  selectedYear = signal(new Date().getFullYear());
  selectedMonth = signal<number | null>(null);
  /** FIX #1: tipado estricto — nunca más "Object is of type unknown" */
  transactions = signal<Transaction[]>([]);
  kevinId = signal<string>('');
  angelyId = signal<string>('');
  // —— Wedding widget ———————————————————————————————————————————————————————————————
  weddingBudget = signal<WeddingBudgetWidget | null>(null);
  weddingPendingCount = signal(0);
  upcomingWeddingPayments = signal<UpcomingWeddingPayment[]>([]);
  weddingLoading = signal(false);

  MONTHS_LIST = MONTHS;

  todayDateLong = new Date().toLocaleDateString('es-CO', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });

  // —— Computed ———————————————————————————————————————————————————————————————

  totalExpenses = computed(() =>
    this.transactions()
      .filter(t => t.type === 'expense')
      .reduce((sum: number, t: Transaction) => sum + Number(t.amount), 0)
  );

  totalIncome = computed(() =>
    this.transactions()
      .filter(t => t.type === 'income')
      .reduce((sum: number, t: Transaction) => sum + Number(t.amount), 0)
  );

  balance = computed(() => this.totalIncome() - this.totalExpenses());

  savingsRate = computed(() => {
    const income = this.totalIncome();
    if (income === 0) return 0;
    return Math.max(0, Math.round((this.balance() / income) * 100));
  });

  expensesByMonth = computed(() => {
    const expenses = new Array(12).fill(0) as number[];
    this.transactions()
      .filter(t => t.type === 'expense')
      .forEach((t: Transaction) => {
        const month = new Date(t.date).getMonth();
        expenses[month] += Number(t.amount);
      });
    return expenses;
  });

  incomeByMonth = computed(() => {
    const incomes = new Array(12).fill(0) as number[];
    this.transactions()
      .filter(t => t.type === 'income')
      .forEach((t: Transaction) => {
        const month = new Date(t.date).getMonth();
        incomes[month] += Number(t.amount);
      });
    return incomes;
  });

  kevinTotal = computed(() =>
    this.transactions()
      .filter(t => t.type === 'expense' && t.user_id === this.kevinId())
      .reduce((sum: number, t: Transaction) => sum + Number(t.amount), 0)
  );

  angelyTotal = computed(() =>
    this.transactions()
      .filter(t => t.type === 'expense' && t.user_id === this.angelyId())
      .reduce((sum: number, t: Transaction) => sum + Number(t.amount), 0)
  );

  topCategories = computed((): TopCategory[] => {
    const byCategory: Record<string, number> = {};

    this.transactions()
      .filter(t => t.type === 'expense')
      .forEach((t: Transaction) => {
        const cat = t.category ?? 'Otros';
        byCategory[cat] = (byCategory[cat] ?? 0) + Number(t.amount);
      });

    const sorted = Object.entries(byCategory)
      .map(([name, amount]) => ({
        name,
        amount,
        percentage: 0,
        emoji: CATEGORY_EMOJIS[name] ?? '📦'
      }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);

    const max = sorted[0]?.amount ?? 1;
    sorted.forEach(c => { c.percentage = (c.amount / max) * 100; });

    return sorted;
  });

  savingsSuggestions = computed((): string[] => {
    const tips: string[] = [];
    const top = this.topCategories()[0];
    const income = this.totalIncome();

    if (top && income > 0 && top.amount > income * 0.4) {
      tips.push(`${top.emoji} Tu mayor gasto es ${top.name}, representa más del 40% de tus ingresos.`);
    }
    if (this.balance() < 0) {
      const deficit = Math.abs(this.balance()).toLocaleString('es-CO');
      tips.push(`⚠️ Este mes los gastos superan los ingresos en $ ${deficit}.`);
    }
    if (this.kevinTotal() > this.angelyTotal() * 1.5 && this.angelyTotal() > 0) {
      tips.push('📊 Kevin está aportando significativamente más este período.');
    } else if (this.angelyTotal() > this.kevinTotal() * 1.5 && this.kevinTotal() > 0) {
      tips.push('📊 Angely está aportando significativamente más este período.');
    }

    return tips;
  });

  recentTransactions = computed((): RecentTransaction[] =>
    [...this.transactions()]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 5)
      .map(t => ({
        ...t,
        payerName: t.user_id === this.kevinId() ? 'Kevin' : 'Angely',
        payerInitial: t.user_id === this.kevinId() ? 'K' : 'A'
      }))
  );

  greeting = computed(() => {
    const h = new Date().getHours();
    if (h < 12) return 'Buenos días';
    if (h < 18) return 'Buenas tardes';
    return 'Buenas noches';
  });

  // —— Constructor / Lifecycle ————————————————————————————————————————————————

  constructor() {
    /**
     * FIX #2: effect sin allowSignalWrites — solo lectura de signals.
     * El efecto se dispara cada vez que selectedYear o selectedMonth cambian.
     */
    effect(() => {
      void this.selectedYear();   // lectura para suscribirse
      void this.selectedMonth();  // lectura para suscribirse
      void this.loadTransactions();
    });
  }

  async ngOnInit(): Promise<void> {
    await this.loadUserIds();
    await this.loadWeddingWidget();
  }

  ngOnDestroy(): void {
    this.barChart?.destroy();
    this.doughnutChart?.destroy();
    this.lineChart?.destroy();
  }

  // —— Métodos de datos ———————————————————————————————————————————————————————

  async loadUserIds(): Promise<void> {
    try {
      const { data, error } = await this.supabase.client
        .from('profiles')
        .select('id, full_name');

      if (error) throw error;

      if (data) {
        const kevin = (data as { id: string; full_name: string }[])
          .find(p => p.full_name?.toLowerCase().includes('kevin'));
        const angely = (data as { id: string; full_name: string }[])
          .find(p => p.full_name?.toLowerCase().includes('angely'));

        if (kevin) this.kevinId.set(kevin.id);
        if (angely) this.angelyId.set(angely.id);
      }
    } catch (err) {
      console.error('Error cargando IDs de usuarios:', err);
    }
  }


  async loadWeddingWidget(): Promise<void> {
    this.weddingLoading.set(true);
    try {
      const { data: budgets, error: budgetError } = await this.supabase.client
        .from('wedding_budgets')
        .select('id, event_name, event_date, total_budget, status')
        .in('status', ['planning', 'in_progress'])
        .order('event_date', { ascending: true })
        .limit(1);

      if (budgetError) throw budgetError;

      const budget = (budgets ?? [])[0] as (Pick<WeddingBudgetWidget, 'id' | 'event_name' | 'event_date' | 'total_budget' | 'status'>) | undefined;
      if (!budget?.id) {
        this.weddingBudget.set(null);
        this.weddingPendingCount.set(0);
        this.upcomingWeddingPayments.set([]);
        return;
      }

      const { data: expenses, error: expenseError } = await this.supabase.client
        .from('wedding_expenses')
        .select('id, provider_name, amount, paid_amount, due_date, status')
        .eq('wedding_budget_id', budget.id)
        .order('created_at', { ascending: false });
      if (expenseError) throw expenseError;

      const rows = (expenses ?? []) as Array<{
        id: string;
        provider_name: string;
        amount: number;
        paid_amount: number | null;
        due_date: string | null;
        status: string;
      }>;

      const active = rows.filter((r) => r.status !== 'cancelled');
      const planned = active.reduce((sum, r) => sum + Number(r.amount ?? 0), 0);
      const spent = active.reduce((sum, r) => sum + Number(r.paid_amount ?? 0), 0);
      const pending = active.reduce(
        (sum, r) => sum + Math.max(0, Number(r.amount ?? 0) - Number(r.paid_amount ?? 0)),
        0
      );
      const remaining = Number(budget.total_budget ?? 0) - planned;

      this.weddingBudget.set({
        id: budget.id,
        event_name: budget.event_name,
        event_date: budget.event_date,
        total_budget: Number(budget.total_budget ?? 0),
        total_spent: spent,
        total_pending: pending,
        remaining,
        status: budget.status as string,
      });

      const pendingRows = rows.filter((r) => r.status === 'pending' || r.status === 'partial');
      this.weddingPendingCount.set(pendingRows.length);

      const upcoming = pendingRows
        .slice()
        .sort((a, b) => {
          const ad = a.due_date ? new Date(a.due_date).getTime() : Number.POSITIVE_INFINITY;
          const bd = b.due_date ? new Date(b.due_date).getTime() : Number.POSITIVE_INFINITY;
          return ad - bd;
        })
        .slice(0, 3)
        .map((r) => ({
          id: r.id,
          provider_name: r.provider_name,
          remaining: Math.max(0, Number(r.amount ?? 0) - Number(r.paid_amount ?? 0)),
          due_date: r.due_date,
          status: r.status,
        }));

      this.upcomingWeddingPayments.set(upcoming);
    } catch (err) {
      console.error('Error cargando widget de boda:', err);
      this.weddingBudget.set(null);
      this.weddingPendingCount.set(0);
      this.upcomingWeddingPayments.set([]);
    } finally {
      this.weddingLoading.set(false);
    }
  }

  getWeddingSpendingPercentage(): number {
    const budget = this.weddingBudget();
    if (!budget) return 0;
    const total = Number(budget.total_budget ?? 0);
    if (total <= 0) return 0;
    return Math.round((Number(budget.total_spent ?? 0) / total) * 100);
  }

  async loadTransactions(): Promise<void> {
    this.isLoading.set(true);
    try {
      const year = this.selectedYear();
      const month = this.selectedMonth();

      const startDate = new Date(year, month ?? 0, 1)
        .toISOString().split('T')[0];

      const endDate = month !== null
        ? new Date(year, month + 1, 0).toISOString().split('T')[0]
        : new Date(year, 11, 31).toISOString().split('T')[0];

      const { data, error } = await this.supabase.client
        .from('transactions')
        .select(`
          id, concept, amount, type, category, date,
          user_id, portfolio_id, notes, receipt_url,
          is_scheduled
        `)
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: false });

      if (error) throw error;

      this.transactions.set((data ?? []) as Transaction[]);
      setTimeout(() => this.updateCharts(), 100);

    } catch (err) {
      console.error('Error cargando transacciones:', err);
    } finally {
      this.isLoading.set(false);
    }
  }

  // —— Controles de período ———————————————————————————————————————————————————

  changeYear(delta: number): void {
    this.selectedYear.update(y => y + delta);
  }

  selectMonth(month: number | null): void {
    this.selectedMonth.set(month);
  }

  // —— Charts —————————————————————————————————————————————————————————————————

  updateCharts(): void {
    if (!this.barCanvas || !this.doughnutCanvas || !this.lineCanvas) return;
    this.initBarChart();
    this.initDoughnutChart();
    this.initLineChart();
  }

  /**
   * FIX #3: callbacks de Chart.js tipados correctamente.
   * ctx.raw es `unknown` en Chart.js — se castea a number de forma segura.
   * Scale.ticks callback recibe `number | string` — se maneja ambos casos.
   */
  initBarChart(): void {
    this.barChart?.destroy();

    this.barChart = new Chart(this.barCanvas.nativeElement, {
      type: 'bar',
      data: {
        labels: MONTHS,
        datasets: [{
          label: 'Gastos',
          data: this.expensesByMonth(),
          backgroundColor: 'rgba(30,64,175,0.7)',
          borderRadius: 6,
          borderSkipped: false
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx: TooltipItem<'bar'>) => {
                const raw = typeof ctx.raw === 'number' ? ctx.raw : Number(ctx.raw ?? 0);
                return '$ ' + raw.toLocaleString('es-CO');
              }
            }
          }
        },
        scales: {
          y: {
            grid: { color: 'rgba(0,0,0,0.05)' },
            ticks: {
              callback(this: Scale, tickValue: number | string) {
                const num = typeof tickValue === 'number'
                  ? tickValue
                  : parseFloat(String(tickValue));
                return '$ ' + num.toLocaleString('es-CO', {
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0
                });
              }
            }
          },
          x: { grid: { display: false } }
        }
      }
    });
  }

  initDoughnutChart(): void {
    this.doughnutChart?.destroy();

    this.doughnutChart = new Chart(this.doughnutCanvas.nativeElement, {
      type: 'doughnut',
      data: {
        labels: ['Kevin', 'Angely'],
        datasets: [{
          data: [this.kevinTotal(), this.angelyTotal()],
          backgroundColor: ['#1E40AF', '#059669'],
          borderWidth: 0,
          hoverOffset: 4
        }]
      },
      options: {
        responsive: true,
        cutout: '70%',
        plugins: {
          legend: {
            position: 'bottom',
            labels: { padding: 20, usePointStyle: true }
          },
          tooltip: {
            callbacks: {
              label: (ctx: TooltipItem<'doughnut'>) => {
                const raw = typeof ctx.raw === 'number' ? ctx.raw : Number(ctx.raw ?? 0);
                return `${ctx.label}: $ ${raw.toLocaleString('es-CO')}`;
              }
            }
          }
        }
      }
    });
  }

  initLineChart(): void {
    this.lineChart?.destroy();

    this.lineChart = new Chart(this.lineCanvas.nativeElement, {
      type: 'line',
      data: {
        labels: MONTHS,
        datasets: [
          {
            label: 'Gastos',
            data: this.expensesByMonth(),
            borderColor: '#DC2626',
            backgroundColor: 'rgba(220,38,38,0.1)',
            fill: true,
            tension: 0.4,
            pointRadius: 4,
            pointHoverRadius: 6
          },
          {
            label: 'Ingresos',
            data: this.incomeByMonth(),
            borderColor: '#059669',
            backgroundColor: 'rgba(5,150,105,0.1)',
            fill: true,
            tension: 0.4,
            pointRadius: 4,
            pointHoverRadius: 6
          }
        ]
      },
      options: {
        responsive: true,
        interaction: { mode: 'index', intersect: false },
        plugins: { legend: { position: 'top' } },
        scales: {
          y: {
            grid: { color: 'rgba(0,0,0,0.05)' },
            ticks: {
              callback(this: Scale, tickValue: number | string) {
                const num = typeof tickValue === 'number'
                  ? tickValue
                  : parseFloat(String(tickValue));
                return '$ ' + num.toLocaleString('es-CO', {
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0
                });
              }
            }
          },
          x: { grid: { display: false } }
        }
      }
    });
  }
}





