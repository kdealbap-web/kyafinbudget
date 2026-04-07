import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { CurrencyCopPipe } from '../../../shared/pipes/currency-cop.pipe';
import { CurrencyCopInputDirective } from '../../../shared/directives/currency-cop-input.directive';
import { ConfirmDialogService } from '../../../shared/services/confirm-dialog.service';
import { ToastService } from '../../../shared/services/toast.service';

import { AccountService } from '../../../core/services/account.service';
import { PortfolioService } from '../../../core/services/portfolio.service';
import { WeddingExpenseService } from '../../../core/services/wedding-expense.service';

import { WeddingBudgetStatus } from '../../../domain/models/wedding-budget.model';
import { WeddingExpense, WeddingExpenseStatus } from '../../../domain/models/wedding-expense.model';
import { WeddingExpensePaymentMethod } from '../../../domain/models/wedding-expense-payment.model';
import { WeddingExpenseAttachment, WeddingExpenseAttachmentType } from '../../../domain/models/wedding-expense-attachment.model';

type WeddingCategoryBreakdownRow = {
  id: string;
  name: string;
  color: string | null;
  icon: string | null;
  planned: number;
  spent: number;
  pending: number;
  count: number;
  percentOfBudget: number;
};

@Component({
  selector: 'app-wedding-dashboard',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, CurrencyCopPipe, CurrencyCopInputDirective],
  templateUrl: './wedding-dashboard.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WeddingDashboardComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(ToastService);
  private readonly confirmDialog = inject(ConfirmDialogService);
  private readonly weddingService = inject(WeddingExpenseService);
  private readonly accountService = inject(AccountService);
  private readonly portfolioService = inject(PortfolioService);

  readonly WeddingBudgetStatus = WeddingBudgetStatus;
  readonly WeddingExpensePaymentMethod = WeddingExpensePaymentMethod;
  readonly WeddingExpenseStatus = WeddingExpenseStatus;
  readonly WeddingExpenseAttachmentType = WeddingExpenseAttachmentType;

  readonly isLoading = computed(() => this.weddingService.isLoading());
  readonly budgets = computed(() => this.weddingService.budgets());

  readonly sortedBudgets = computed(() => {
    const list = this.budgets();
    return [...list].sort((a, b) => {
      const ca = a.created_at ?? '';
      const cb = b.created_at ?? '';
      if (ca !== cb) return cb.localeCompare(ca);
      return (b.event_date ?? '').localeCompare(a.event_date ?? '');
    });
  });
  readonly currentBudget = computed(() => this.weddingService.currentBudget());
  readonly expenses = computed(() => this.weddingService.expenses());
  readonly categories = computed(() => this.weddingService.categories());
  readonly error = computed(() => this.weddingService.error());

  readonly accounts = computed(() => this.accountService.accounts());
  readonly portfolios = computed(() => this.portfolioService.portfolios());

  readonly spendingPercent = computed(() => {
    const budget = this.currentBudget();
    if (!budget) return 0;
    const total = Number(budget.total_budget ?? 0);
    if (total <= 0) return 0;
    return Math.min(
      100,
      Math.max(0, Math.round((this.budgetTotals().spent / total) * 100))
    );
  });
  readonly budgetTotals = computed(() => {
    const budget = this.currentBudget();
    const totalBudget = Number(budget?.total_budget ?? 0);
    const activeExpenses = this
      .expenses()
      .filter((e) => e.status !== WeddingExpenseStatus.Cancelled);

    const planned = activeExpenses.reduce((sum, e) => sum + Number(e.amount ?? 0), 0);
    const spent = activeExpenses.reduce((sum, e) => sum + Number(e.paid_amount ?? 0), 0);
    const pending = activeExpenses.reduce(
      (sum, e) => sum + Math.max(0, Number(e.amount ?? 0) - Number(e.paid_amount ?? 0)),
      0,
    );

    const remaining = totalBudget - planned;
    return { totalBudget, planned, spent, pending, remaining };
  });

  readonly categoryBreakdown = computed(() => {
    const totalBudget = Number(this.currentBudget()?.total_budget ?? 0);
    const activeExpenses = this
      .expenses()
      .filter((e) => e.status !== WeddingExpenseStatus.Cancelled);

    const byCat = new Map<string, WeddingCategoryBreakdownRow>();

    for (const e of activeExpenses) {
      const catId = e.category?.id ?? e.category_id ?? 'unknown';
      const name = e.category?.name ?? 'Sin categoría';
      const color = (e.category as unknown as { color?: string | null })?.color ?? null;
      const icon = (e.category as unknown as { icon?: string | null })?.icon ?? null;

      const amount = Number(e.amount ?? 0);
      const paid = Number(e.paid_amount ?? 0);
      const pending = Math.max(0, amount - paid);

      const current = byCat.get(catId) ?? {
        id: catId,
        name,
        color,
        icon,
        planned: 0,
        spent: 0,
        pending: 0,
        count: 0,
        percentOfBudget: 0,
      };

      current.name = name;
      current.color = color;
      current.icon = icon;
      current.planned += amount;
      current.spent += paid;
      current.pending += pending;
      current.count += 1;

      byCat.set(catId, current);
    }

    const rows = Array.from(byCat.values()).map((r) => ({
      ...r,
      percentOfBudget:
        totalBudget > 0
          ? Math.min(100, Math.max(0, Math.round((r.planned / totalBudget) * 100)))
          : 0,
    }));

    rows.sort((a, b) => b.planned - a.planned);
    return rows;
  });

  readonly categoryBreakdownMaxPlanned = computed(() => {
    const rows = this.categoryBreakdown();
    if (!rows.length) return 1;
    return Math.max(1, ...rows.map((r) => Number(r.planned ?? 0)));
  });
  readonly selectedFilter = signal<'current' | 'all'>('current');

  readonly filteredExpenses = computed(() => {
    const all = this.expenses();
    if (this.selectedFilter() === 'all') return all;
    const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
    return all.filter(e => {
      const d = e.created_at ?? e.due_date ?? '';
      return d.slice(0, 7) === currentMonth;
    });
  });

  readonly filteredSpent = computed(() =>
    this.filteredExpenses()
      .filter(e => e.status !== WeddingExpenseStatus.Cancelled)
      .reduce((s, e) => s + Number(e.paid_amount ?? 0), 0)
  );

  readonly filteredPending = computed(() =>
    this.filteredExpenses()
      .filter(e => e.status !== WeddingExpenseStatus.Cancelled)
      .reduce((s, e) => s + Math.max(0, Number(e.amount ?? 0) - Number(e.paid_amount ?? 0)), 0)
  );

  readonly expensesByMonth = computed(() => {
    const map = new Map<string, WeddingExpense[]>();
    for (const e of this.filteredExpenses()) {
      const key = (e.created_at ?? e.due_date ?? '').slice(0, 7);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(e);
    }
    return [...map.entries()]
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([month, expenses]) => ({ month, expenses }));
  });


  readonly showBudgetForm = signal(false);
  readonly showExpenseForm = signal(false);
  readonly showPaymentForm = signal(false);
  readonly isEditingBudget = signal(false);

  readonly editingExpenseId = signal<string | null>(null);
  readonly selectedExpenseForPayment = signal<WeddingExpense | null>(null);
  readonly selectedExpenseDetails = signal<WeddingExpense | null>(null);

  readonly budgetForm = this.fb.nonNullable.group({
    event_name: this.fb.nonNullable.control('Boda K&A', [
      Validators.required,
      Validators.minLength(3),
    ]),
    event_date: this.fb.nonNullable.control(this.todayISO(), [Validators.required]),
    total_budget: this.fb.nonNullable.control(0, [
      Validators.required,
      Validators.min(100_000),
    ]),
    status: this.fb.nonNullable.control<WeddingBudgetStatus>(
      WeddingBudgetStatus.InProgress,
      [Validators.required]
    ),
    notes: this.fb.control<string | null>(null),
  });

  readonly expenseForm = this.fb.nonNullable.group({
    category_id: this.fb.nonNullable.control('', [Validators.required]),
    provider_name: this.fb.nonNullable.control('', [
      Validators.required,
      Validators.minLength(2),
    ]),
    amount: this.fb.nonNullable.control(0, [Validators.required, Validators.min(1)]),
    due_date: this.fb.control<string | null>(this.todayISO()),
    account_id: this.fb.control<string | null>(null),
    description: this.fb.control<string | null>(null),
    notes: this.fb.control<string | null>(null),
  });

  readonly paymentForm = this.fb.nonNullable.group({
    amount: this.fb.nonNullable.control(0, [Validators.required, Validators.min(1)]),
    payment_method: this.fb.nonNullable.control<WeddingExpensePaymentMethod>(
      WeddingExpensePaymentMethod.Transfer,
      [Validators.required]
    ),
    payment_date: this.fb.nonNullable.control(this.todayISO(), [Validators.required]),
    account_id: this.fb.nonNullable.control('', [Validators.required]),
    portfolio_id: this.fb.control<string | null>(null),
    reference_number: this.fb.control<string | null>(null),
    notes: this.fb.control<string | null>(null),
  });

  readonly selectedAttachmentFile = signal<File | null>(null);

  readonly attachmentForm = this.fb.nonNullable.group({
    attachment_type: this.fb.nonNullable.control<WeddingExpenseAttachmentType>(
      WeddingExpenseAttachmentType.Quote,
      [Validators.required]
    ),
  });


  async ngOnInit(): Promise<void> {
    await Promise.all([
      this.weddingService.loadBudgets(),
      this.accountService.loadAccounts(),
      this.portfolioService.loadPortfolios(),
    ]);

    const portfolios = this.portfolios();
    if (portfolios.length && !this.paymentForm.controls.portfolio_id.value) {
      this.paymentForm.controls.portfolio_id.setValue(portfolios[0].id);
    }

    const current = this.currentBudget();
    if (current?.id) {
      await this.weddingService.loadBudgetWithExpenses(current.id);
      return;
    }

    const latest = this.sortedBudgets()[0];
    if (latest?.id) {
      await this.weddingService.loadBudgetWithExpenses(latest.id);
    }
  }

  openBudgetForm(editMode = false): void {
    this.isEditingBudget.set(editMode);
    if (editMode && this.currentBudget()) {
      const b = this.currentBudget()!;
      this.budgetForm.reset({
        event_name: b.event_name ?? 'Boda K&A',
        event_date: b.event_date ?? this.todayISO(),
        total_budget: Number(b.total_budget ?? 0),
        status: b.status as WeddingBudgetStatus,
        notes: b.notes ?? null,
      });
    } else {
      this.budgetForm.reset({
        event_name: 'Boda K&A',
        event_date: this.todayISO(),
        total_budget: 0,
        status: WeddingBudgetStatus.InProgress,
        notes: null,
      });
    }
    this.showBudgetForm.set(true);
  }

  closeBudgetForm(): void {
    this.showBudgetForm.set(false);
  }

  openExpenseForm(): void {
    this.editingExpenseId.set(null);
    this.expenseForm.reset({
      category_id: '',
      provider_name: '',
      amount: 0,
      due_date: this.todayISO(),
      account_id: null,
      description: null,
      notes: null,
    });
    this.showExpenseForm.set(true);
  }

  openEditExpense(expense: WeddingExpense): void {
    this.editingExpenseId.set(expense.id);
    this.expenseForm.reset({
      category_id: expense.category_id,
      provider_name: expense.provider_name ?? '',
      amount: Number(expense.amount ?? 0),
      due_date: expense.due_date ?? this.todayISO(),
      account_id: expense.account_id ?? null,
      description: expense.description ?? null,
      notes: expense.notes ?? null,
    });
    this.showExpenseForm.set(true);
  }

  closeExpenseForm(): void {
    this.showExpenseForm.set(false);
    this.editingExpenseId.set(null);
  }

  openPaymentFor(expense: WeddingExpense): void {
    this.selectedExpenseForPayment.set(expense);

    const defaultAccountId = expense.account_id ?? '';
    const defaultAmount =
      Number(expense.remaining ?? 0) > 0 ? Number(expense.remaining) : 0;

    this.paymentForm.reset({
      amount: defaultAmount,
      payment_method: WeddingExpensePaymentMethod.Transfer,
      payment_date: this.todayISO(),
      account_id: defaultAccountId,
      portfolio_id:
        this.paymentForm.controls.portfolio_id.value ??
        (this.portfolios()[0]?.id ?? null),
      reference_number: null,
      notes: null,
    });

    this.showPaymentForm.set(true);
  }

  closePaymentForm(): void {
    this.showPaymentForm.set(false);
    this.selectedExpenseForPayment.set(null);
  }

  openDetails(expense: WeddingExpense): void {
    this.selectedExpenseDetails.set(expense);
    this.selectedAttachmentFile.set(null);
    this.attachmentForm.reset({ attachment_type: WeddingExpenseAttachmentType.Quote });

    if (typeof document !== 'undefined') {
      setTimeout(() => {
        document.getElementById('wedding-expense-details')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 0);
    }
  }

  closeDetails(): void {
    this.selectedExpenseDetails.set(null);
    this.selectedAttachmentFile.set(null);
  }

  async selectBudget(budgetId: string): Promise<void> {
    if (!budgetId) return;
    await this.weddingService.loadBudgetWithExpenses(budgetId);
    this.selectedExpenseDetails.set(null);
  }

  async submitBudget(): Promise<void> {
    if (this.budgetForm.invalid) {
      this.budgetForm.markAllAsTouched();
      return;
    }

    const raw = this.budgetForm.getRawValue();

    // Editar presupuesto existente
    if (this.isEditingBudget() && this.currentBudget()?.id) {
      const budgetId = this.currentBudget()!.id;
      const updated = await this.weddingService.updateBudget(budgetId, {
        event_name: raw.event_name,
        event_date: raw.event_date,
        total_budget: Number(raw.total_budget ?? 0),
        status: raw.status,
        notes: raw.notes,
      });
      if (updated?.id) {
        this.toast.success('Presupuesto actualizado');
        this.closeBudgetForm();
        await this.weddingService.loadBudgetWithExpenses(updated.id);
        return;
      }
      this.toast.error('No se pudo actualizar el presupuesto');
      return;
    }

    // Crear nuevo presupuesto
    const created = await this.weddingService.createBudget({
      event_name: raw.event_name,
      event_date: raw.event_date,
      total_budget: Number(raw.total_budget ?? 0),
      status: raw.status,
      notes: raw.notes,
    });

    if (created?.id) {
      this.toast.success('Presupuesto creado');
      this.closeBudgetForm();
      await this.weddingService.loadBudgetWithExpenses(created.id);
      return;
    }

    this.toast.error('No se pudo crear el presupuesto');
  }

  async submitExpense(): Promise<void> {
    if (this.expenseForm.invalid) {
      this.expenseForm.markAllAsTouched();
      return;
    }

    const budgetId = this.currentBudget()?.id;
    if (!budgetId) {
      this.toast.error('Selecciona un presupuesto primero');
      return;
    }

    const raw = this.expenseForm.getRawValue();
    const expenseId = this.editingExpenseId();

    const payload = {
      category_id: raw.category_id,
      provider_name: raw.provider_name,
      amount: Number(raw.amount ?? 0),
      due_date: raw.due_date || null,
      account_id: raw.account_id,
      description: raw.description,
      notes: raw.notes,
    };

    const result = expenseId
      ? await this.weddingService.updateExpense(expenseId, payload)
      : await this.weddingService.createExpense(budgetId, payload);

    if (result?.id) {
      this.toast.success(expenseId ? 'Gasto actualizado' : 'Gasto creado');
      this.closeExpenseForm();
      await this.weddingService.loadBudgetWithExpenses(budgetId);
      this.refreshDetailsExpense(result.id);
      return;
    }

    this.toast.error(expenseId ? 'No se pudo actualizar el gasto' : 'No se pudo crear el gasto');
  }
  async deleteExpense(expense: WeddingExpense): Promise<void> {
    const confirmed = await this.confirmDialog.confirm({
      title: 'Eliminar gasto',
      message: `¿Eliminar el gasto de "${expense.provider_name}"? Esta acción no se puede deshacer.`,
      type: 'danger',
      confirmLabel: 'Sí, eliminar',
      cancelLabel: 'Cancelar',
    });

    if (!confirmed) return;

    const ok = await this.weddingService.deleteExpense(expense.id);
    if (!ok) {
      this.toast.error('No se pudo eliminar el gasto');
      return;
    }

    const budgetId = this.currentBudget()?.id;
    if (budgetId) await this.weddingService.loadBudgetWithExpenses(budgetId);
    this.toast.success('Gasto eliminado');

    if (this.selectedExpenseDetails()?.id === expense.id) {
      this.closeDetails();
    }
  }
  async submitPayment(): Promise<void> {
    const expense = this.selectedExpenseForPayment();
    if (!expense) return;

    if (this.paymentForm.invalid) {
      this.paymentForm.markAllAsTouched();
      return;
    }

    const raw = this.paymentForm.getRawValue();

    const ok = await this.weddingService.addPayment(
      expense.id,
      {
        amount: Number(raw.amount ?? 0),
        payment_method: raw.payment_method,
        payment_date: raw.payment_date,
        reference_number: raw.reference_number,
        notes: raw.notes,
      },
      {
        account_id: raw.account_id,
        portfolio_id: raw.portfolio_id ?? null,
        concept: `💍 Boda: Pago a ${expense.provider_name}`,
        category: 'Otros',
      }
    );

    if (!ok) {
      this.toast.error('No se pudo registrar el pago');
      return;
    }

    this.toast.success('Pago registrado (crea transacción)');
    this.closePaymentForm();
    this.refreshDetailsExpense(expense.id);
  }

  async downloadReport(): Promise<void> {
    const budget = this.currentBudget();
    const expenses = this.expenses();

    if (!budget || expenses.length === 0) {
      this.toast.warning('No hay datos para exportar');
      return;
    }

    try {
      const XLSX = await import('xlsx');

      const rows = expenses.map((e) => ({
        Proveedor: e.provider_name ?? '',
        Categoría: e.category?.name ?? '',
        Cuenta: this.getAccountName(e.account_id),
        Monto: Number(e.amount ?? 0),
        Pagado: Number(e.paid_amount ?? 0),
        Pendiente: Number(e.remaining ?? 0),
        Estado: e.status ?? '',
        Vence: e.due_date ? new Date(e.due_date).toISOString().split('T')[0] : '',
      }));

      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Gastos');

      const data = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });

      const safeName = (budget.event_name ?? 'boda')
        .replace(/\s+/g, '-')
        .replace(/[^a-zA-Z0-9-_]/g, '')
        .toLowerCase();
      const today = new Date().toISOString().split('T')[0];

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `boda-gastos-${safeName}-${today}.xlsx`;
      link.click();
      URL.revokeObjectURL(url);

      this.toast.success('Reporte Excel descargado');
    } catch (err) {
      console.error('Error exportando reporte:', err);
      this.toast.error('No se pudo exportar el reporte');
    }
  }
  onAttachmentFileChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    this.selectedAttachmentFile.set(file);
  }

  getAttachmentUrl(attachment: WeddingExpenseAttachment): string {
    return this.weddingService.getAttachmentUrl(attachment);
  }

  getAttachmentTypeLabel(type: WeddingExpenseAttachmentType | string): string {
    switch (type) {
      case WeddingExpenseAttachmentType.Quote:
        return 'Cotización';
      case WeddingExpenseAttachmentType.Invoice:
        return 'Factura';
      case WeddingExpenseAttachmentType.Receipt:
        return 'Recibo';
      case WeddingExpenseAttachmentType.Contract:
        return 'Contrato';
      default:
        return 'Otro';
    }
  }

  formatFileSize(bytes?: number | null): string {
    const size = Number(bytes ?? 0);
    if (!size || size < 0) return '—';
    if (size < 1024) return `${size} B`;
    const kb = size / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    const mb = kb / 1024;
    return `${mb.toFixed(1)} MB`;
  }

  async uploadAttachment(): Promise<void> {
    const expense = this.selectedExpenseDetails();
    if (!expense) return;

    if (this.attachmentForm.invalid) {
      this.attachmentForm.markAllAsTouched();
      return;
    }

    const file = this.selectedAttachmentFile();
    if (!file) {
      this.toast.error('Selecciona un archivo');
      return;
    }

    const type = this.attachmentForm.controls.attachment_type.value;
    const created = await this.weddingService.addAttachment(expense.id, file, type);
    if (!created) {
      this.toast.error('No se pudo subir el adjunto');
      return;
    }

    this.toast.success('Adjunto subido');
    this.selectedAttachmentFile.set(null);
    this.refreshDetailsExpense(expense.id);
  }

  async deleteAttachment(attachment: WeddingExpenseAttachment): Promise<void> {
    const expense = this.selectedExpenseDetails();
    if (!expense) return;

    const confirmed = await this.confirmDialog.confirm({
      title: 'Eliminar adjunto',
      message: `¿Eliminar "${attachment.file_name}"?`,
      type: 'danger',
      confirmLabel: 'Sí, eliminar',
      cancelLabel: 'No',
    });

    if (!confirmed) return;

    const ok = await this.weddingService.deleteAttachment(expense.id, attachment);
    if (!ok) {
      this.toast.error('No se pudo eliminar el adjunto');
      return;
    }

    this.toast.success('Adjunto eliminado');
    this.refreshDetailsExpense(expense.id);
  }
  getExpenseStatusClass(status: string): string {
    switch (status) {
      case WeddingExpenseStatus.Paid:
        return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200';
      case WeddingExpenseStatus.Partial:
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200';
      case WeddingExpenseStatus.Cancelled:
        return 'bg-gray-200 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
      default:
        return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200';
    }
  }

  getExpenseStatusText(status: string): string {
    switch (status) {
      case WeddingExpenseStatus.Paid:
        return 'Pagado';
      case WeddingExpenseStatus.Partial:
        return 'Pago parcial';
      case WeddingExpenseStatus.Cancelled:
        return 'Eliminado';
      default:
        return 'Pendiente de pago';
    }
  }
  getPaymentMethodText(method: WeddingExpensePaymentMethod | string | null | undefined): string {
    if (!method) return '—';
    switch (method) {
      case WeddingExpensePaymentMethod.Cash:
        return 'Efectivo';
      case WeddingExpensePaymentMethod.Transfer:
        return 'Transferencia';
      case WeddingExpensePaymentMethod.Card:
        return 'Tarjeta';
      case WeddingExpensePaymentMethod.Check:
        return 'Cheque';
      default:
        return String(method ?? '');
    }
  }

  getPaymentMethodDotClass(method: WeddingExpensePaymentMethod | string | null | undefined): string {
    if (!method) return 'bg-gray-400';
    switch (method) {
      case WeddingExpensePaymentMethod.Transfer:
        return 'bg-blue-600';
      case WeddingExpensePaymentMethod.Cash:
        return 'bg-emerald-600';
      case WeddingExpensePaymentMethod.Card:
        return 'bg-purple-600';
      case WeddingExpensePaymentMethod.Check:
        return 'bg-gray-500';
      default:
        return 'bg-gray-400';
    }
  }

  getAccountName(accountId?: string | null): string {
    if (!accountId) return '—';
    return this.accounts().find((a) => a.id === accountId)?.name ?? '—';
  }

  getPaymentsCount(expense: WeddingExpense): number {
    return Array.isArray(expense.payments) ? expense.payments.length : 0;
  }

  private refreshDetailsExpense(expenseId: string): void {
    const currentDetails = this.selectedExpenseDetails();
    if (!currentDetails || currentDetails.id !== expenseId) return;
    const refreshed = this.weddingService.expenses().find((e) => e.id === expenseId);
    if (refreshed) this.selectedExpenseDetails.set(refreshed);
  }

  setFilter(f: 'current' | 'all'): void {
    this.selectedFilter.set(f);
  }

  formatMonth(month: string): string {
    const [year, m] = month.split('-');
    const date = new Date(Number(year), Number(m) - 1, 1);
    return date.toLocaleDateString('es-CO', { year: 'numeric', month: 'long' });
  }

  getCategoryPlannedWidth(row: WeddingCategoryBreakdownRow): number {
    const max = Number(this.categoryBreakdownMaxPlanned() ?? 1);
    if (!max || max <= 0) return 0;
    const planned = Number(row.planned ?? 0);
    return Math.min(100, Math.max(0, Math.round((planned / max) * 100)));
  }

  private todayISO(): string {
    return new Date().toISOString().split('T')[0];
  }
}



















