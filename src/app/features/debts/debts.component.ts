import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AccountService } from '../../core/services/account.service';
import { DebtService } from '../../core/services/debt.service';
import { PortfolioService } from '../../core/services/portfolio.service';
import { SupabaseService } from '../../core/services/supabase.service';
import { ConfirmDialogService } from '../../shared/services/confirm-dialog.service';
import { Debt, DebtStatus, DebtType } from '../../domain/models/debt.model';
import { CurrencyCopPipe } from '../../shared/pipes/currency-cop.pipe';
import { BankLogoComponent } from '../../shared/components/bank-logo/bank-logo.component';

export type DebtTab = 'all' | 'personal' | 'household' | 'overdue';

@Component({
  selector: 'app-debts',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, CurrencyCopPipe, BankLogoComponent],
  templateUrl: './debts.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DebtsComponent implements OnInit {
  private readonly fb             = inject(FormBuilder);
  private readonly debtService    = inject(DebtService);
  private readonly portfolioService = inject(PortfolioService);
  private readonly accountService = inject(AccountService);
  private readonly supabase       = inject(SupabaseService);
  private readonly confirmDialog  = inject(ConfirmDialogService);

  readonly DebtType   = DebtType;
  readonly DebtStatus = DebtStatus;

  readonly isLoading  = computed(() => this.debtService.isLoading());
  readonly debts      = computed(() => this.debtService.debts());
  readonly totalDebt  = computed(() => this.debtService.totalDebt());
  readonly personalDebt   = computed(() => this.debtService.personalDebt());
  readonly householdDebt  = computed(() => this.debtService.householdDebt());
  readonly overdueCount   = computed(() => this.debtService.overdueDebts().length);

  readonly portfolios = computed(() => this.portfolioService.portfolios());
  readonly accounts   = computed(() => this.accountService.accounts());

  readonly activeTab          = signal<DebtTab>('all');
  readonly showPaymentModal   = signal(false);
  readonly showDebtFormModal  = signal(false);
  readonly editingDebtId      = signal<string | null>(null);
  readonly selectedDebt       = signal<Debt | null>(null);

  readonly debtTypeOptions = [
    { value: DebtType.Personal,    label: 'Personal' },
    { value: DebtType.Household,   label: 'Hogar' },
    { value: DebtType.BankLoan,    label: 'Préstamo banco' },
    { value: DebtType.CreditCard,  label: 'Tarjeta crédito' },
  ];

  readonly tabConfig: { id: DebtTab; label: string; count: () => number }[] = [
    { id: 'all',       label: 'Todas',    count: () => this.debts().length },
    { id: 'personal',  label: 'Personal', count: () => this.debts().filter(d => d.type === DebtType.Personal).length },
    { id: 'household', label: 'Hogar',    count: () => this.debts().filter(d => d.type === DebtType.Household).length },
    { id: 'overdue',   label: 'Vencidas', count: () => this.overdueCount() },
  ];

  readonly debtForm = this.fb.nonNullable.group({
    name:          this.fb.nonNullable.control('', [Validators.required, Validators.minLength(2)]),
    creditor:      this.fb.control<string>(''),
    type:          this.fb.nonNullable.control<DebtType>(DebtType.Personal, [Validators.required]),
    total_amount:  this.fb.control<number | null>(null, [Validators.required, Validators.min(1)]),
    paid_amount:   this.fb.nonNullable.control<number>(0, [Validators.min(0)]),
    interest_rate: this.fb.nonNullable.control<number>(0, [Validators.min(0)]),
    due_date:      this.fb.control<string | null>(null),
    account_id:    this.fb.control<string | null>(null),
    portfolio_id:  this.fb.control<string | null>(null),
    description:   this.fb.control<string>(''),
    is_shared:     this.fb.nonNullable.control<boolean>(false),
    status:        this.fb.nonNullable.control<DebtStatus>(DebtStatus.Active, [Validators.required]),
  });

  readonly paymentForm = this.fb.nonNullable.group({
    amount:     this.fb.control<number | null>(null, [Validators.required, Validators.min(1)]),
    account_id: this.fb.control<string | null>(null, [Validators.required]),
  });

  readonly filteredDebts = computed(() => {
    const all = this.debts();
    switch (this.activeTab()) {
      case 'personal':  return all.filter(d => d.type === DebtType.Personal);
      case 'household': return all.filter(d => d.type === DebtType.Household);
      case 'overdue':   return all.filter(d => d.status === DebtStatus.Overdue);
      default:          return all;
    }
  });

  async ngOnInit(): Promise<void> {
    await Promise.all([
      this.debtService.loadDebts(),
      this.accountService.loadAccounts(),
      this.accountService.loadBankCatalog(),
      this.portfolioService.loadPortfolios(),
    ]);
  }

  setTab(tab: DebtTab): void { this.activeTab.set(tab); }

  // ── Modal deuda ───────────────────────────────
  openCreateDebtModal(): void {
    this.editingDebtId.set(null);
    this.debtForm.reset({
      name: '', creditor: '', type: DebtType.Personal,
      total_amount: null, paid_amount: 0, interest_rate: 0,
      due_date: null, account_id: null, portfolio_id: null,
      description: '', is_shared: false, status: DebtStatus.Active,
    });
    this.showDebtFormModal.set(true);
  }

  openEditDebtModal(debt: Debt): void {
    this.editingDebtId.set(debt.id);
    this.debtForm.patchValue({
      name:          debt.name,
      creditor:      debt.creditor ?? '',
      type:          debt.type,
      total_amount:  Number(debt.total_amount),
      paid_amount:   Number(debt.paid_amount),
      interest_rate: Number(debt.interest_rate ?? 0),
      due_date:      debt.due_date ?? null,
      account_id:    debt.account_id ?? null,
      portfolio_id:  debt.portfolio_id ?? null,
      description:   debt.description ?? '',
      is_shared:     debt.is_shared,
      status:        debt.status,
    });
    this.showDebtFormModal.set(true);
  }

  closeDebtFormModal(): void {
    this.showDebtFormModal.set(false);
    this.editingDebtId.set(null);
  }

  async submitDebtForm(): Promise<void> {
    if (this.debtForm.invalid) { this.debtForm.markAllAsTouched(); return; }
    const userId = this.supabase.currentUser()?.id;
    if (!userId) return;

    const raw = this.debtForm.getRawValue();
    const payload = {
      user_id:       userId,
      name:          raw.name.trim(),
      creditor:      raw.creditor?.trim() || null,
      type:          raw.type,
      total_amount:  Number(raw.total_amount ?? 0),
      paid_amount:   Number(raw.paid_amount ?? 0),
      interest_rate: Number(raw.interest_rate ?? 0),
      due_date:      raw.due_date || null,
      account_id:    raw.account_id,
      portfolio_id:  raw.portfolio_id,
      description:   raw.description?.trim() || null,
      is_shared:     raw.is_shared,
      status:        raw.status,
    };

    const ok = this.editingDebtId()
      ? await this.debtService.updateDebt(this.editingDebtId()!, payload)
      : await this.debtService.createDebt(payload as Omit<Debt, 'id' | 'remaining_amount' | 'created_at' | 'updated_at' | 'account'>);

    if (ok) this.closeDebtFormModal();
  }

  async deleteDebt(debt: Debt): Promise<void> {
    const confirmed = await this.confirmDialog.confirm({
      title:        'Eliminar deuda',
      message:      `¿Eliminar "${debt.name}"? Esta acción no se puede deshacer.`,
      type:         'danger',
      confirmLabel: 'Sí, eliminar',
      cancelLabel:  'Cancelar',
    });
    if (!confirmed) return;
    await this.debtService.deleteDebt(debt.id);
  }

  // ── Modal pago ────────────────────────────────
  openPaymentModal(debt: Debt): void {
    this.selectedDebt.set(debt);
    this.paymentForm.reset({ amount: null, account_id: debt.account_id ?? null });
    this.showPaymentModal.set(true);
  }

  closePaymentModal(): void {
    this.showPaymentModal.set(false);
    this.selectedDebt.set(null);
  }

  async registerPayment(): Promise<void> {
    const debt = this.selectedDebt();
    if (!debt || this.paymentForm.invalid) { this.paymentForm.markAllAsTouched(); return; }
    const amount    = Number(this.paymentForm.controls.amount.value ?? 0);
    const accountId = this.paymentForm.controls.account_id.value;
    if (!accountId) return;
    const ok = await this.debtService.registerPayment(debt.id, amount, accountId);
    if (ok) this.closePaymentModal();
  }

  // ── Helpers visuales ──────────────────────────
  getProgress(debt: Debt): number {
    if (!debt.total_amount) return 0;
    return Math.min(100, Math.max(0, (Number(debt.paid_amount) / Number(debt.total_amount)) * 100));
  }

  getProgressClass(progress: number): string {
    if (progress > 50) return 'bg-emerald-500';
    if (progress > 25) return 'bg-amber-400';
    return 'bg-red-500';
  }

  getProgressTrackClass(progress: number): string {
    if (progress > 50) return 'bg-emerald-100 dark:bg-emerald-900/30';
    if (progress > 25) return 'bg-amber-100 dark:bg-amber-900/30';
    return 'bg-red-100 dark:bg-red-900/30';
  }

  getDueUrgency(dueDate?: string | null): { label: string; class: string; icon: string } {
    if (!dueDate) return { label: 'Sin fecha', class: 'text-gray-400', icon: '—' };
    const diffDays = Math.ceil((new Date(dueDate).getTime() - Date.now()) / 86_400_000);
    if (diffDays > 30)  return { label: `${diffDays} días`,   class: 'text-emerald-600 dark:text-emerald-400', icon: '✓' };
    if (diffDays >= 7)  return { label: `${diffDays} días`,   class: 'text-amber-600 dark:text-amber-400',    icon: '!' };
    if (diffDays >= 0)  return { label: `${diffDays} días`,   class: 'text-red-600 dark:text-red-400',        icon: '‼' };
    return               { label: 'Vencida',                   class: 'text-red-700 dark:text-red-500 font-bold', icon: '✕' };
  }

  getTypeLabel(type: DebtType): string {
    const map: Record<DebtType, string> = {
      [DebtType.Personal]:   'Personal',
      [DebtType.Household]:  'Hogar',
      [DebtType.BankLoan]:   'Banco',
      [DebtType.CreditCard]: 'Tarjeta',
    };
    return map[type] ?? type;
  }

  getTypeBadgeClass(type: DebtType): string {
    const map: Record<DebtType, string> = {
      [DebtType.Personal]:   'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
      [DebtType.Household]:  'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
      [DebtType.BankLoan]:   'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
      [DebtType.CreditCard]: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
    };
    return map[type] ?? 'bg-gray-100 text-gray-600';
  }

  hasDebtError(controlName: keyof typeof this.debtForm.controls): boolean {
    const c = this.debtForm.controls[controlName];
    return Boolean(c.invalid && (c.dirty || c.touched));
  }

  hasPaymentError(controlName: keyof typeof this.paymentForm.controls): boolean {
    const c = this.paymentForm.controls[controlName];
    return Boolean(c.invalid && (c.dirty || c.touched));
  }
}
