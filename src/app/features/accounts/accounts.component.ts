import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { AccountService } from '../../core/services/account.service';
import { SupabaseService } from '../../core/services/supabase.service';
import { AuditService } from '../../core/services/audit.service';
import {
  ACCOUNT_TYPE_ICONS,
  ACCOUNT_TYPE_LABELS,
  Account,
  AccountType,
  BankCatalog,
} from '../../domain/models/account.model';
import { CurrencyCopPipe } from '../../shared/pipes/currency-cop.pipe';
import { BankLogoComponent } from '../../shared/components/bank-logo/bank-logo.component';
import { ConfirmDialogService } from '../../shared/services/confirm-dialog.service';
import { ProgressBarService } from '../../shared/services/progress-bar.service';
import { AccountTransferComponent } from './account-transfer/account-transfer.component';

export const ACCOUNT_COLORS = [
  { name: 'Azul', hex: '#1E40AF' },
  { name: 'Verde', hex: '#059669' },
  { name: 'Rojo', hex: '#DC2626' },
  { name: 'Morado', hex: '#7C3AED' },
  { name: 'Rosa', hex: '#DB2777' },
  { name: 'Amarillo', hex: '#D97706' },
  { name: 'Cyan', hex: '#0891B2' },
  { name: 'Gris', hex: '#64748B' },
  { name: 'Lima', hex: '#65A30D' },
  { name: 'Indigo', hex: '#4338CA' },
  { name: 'Naranja', hex: '#EA580C' },
];

const BANK_COLOR_MAP: Record<string, string> = {
  bancolombia: '#FDD835',
  nequi: '#20004a',
  nu: '#8b06bf',
  bbva: '#1f598f',
  davivienda: '#ED1C24',
  'banco-bogota': '#003087',
  rappicard: '#080808',
};
type AccountMovementType = 'transfer' | 'balance_adjustment';

interface AccountMovement {
  id: string;
  date: string;
  from_account: string | null;
  to_account: string | null;
  amount: number;
  description: string | null;
  type: AccountMovementType;
  created_at: string;
}

@Component({
  selector: 'app-accounts',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, CurrencyCopPipe, BankLogoComponent, AccountTransferComponent],
  templateUrl: './accounts.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccountsComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  readonly accountService = inject(AccountService);
  private readonly supabase = inject(SupabaseService);
  private readonly audit = inject(AuditService);
  private readonly confirmDialog = inject(ConfirmDialogService);
  private readonly progressBar = inject(ProgressBarService);

  readonly accounts = computed(() => this.accountService.accounts());
  readonly isLoading = computed(() => this.accountService.isLoading());
  readonly totalBalance = computed(() => this.accountService.totalBalance());
  readonly bankCatalog = computed(() => this.accountService.bankCatalog());

  readonly showCreateModal = signal(false);

  readonly showBalanceModal = signal(false);

  readonly showTransferModal = signal(false);
  readonly movements = signal<AccountMovement[]>([]);
  readonly movementsLoading = signal(false);

  readonly balanceAccount = signal<Account | null>(null);

  readonly updateBalanceForm = this.fb.nonNullable.group({
    balance: this.fb.nonNullable.control<number>(0, [Validators.required]),
  });

  readonly typeOptions = Object.values(AccountType);
  readonly accountColors = ACCOUNT_COLORS;

  readonly createForm = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    type: this.fb.nonNullable.control<AccountType>(AccountType.Savings, [Validators.required]),
    bank_slug: this.fb.control<string | null>(null),
    balance: this.fb.nonNullable.control<number>(0),
    color: this.fb.nonNullable.control<string>('', [Validators.required]),
    is_shared: this.fb.nonNullable.control<boolean>(false),
  });

  async ngOnInit(): Promise<void> {
    this.progressBar.start();
    try {
      await Promise.all([
        this.accountService.loadAccounts(),
        this.accountService.loadBankCatalog(),
      ]);
      await this.loadMovements({ showProgress: false });
      this.progressBar.complete();
    } catch {
      this.progressBar.error();
    }
  }

  toNumber(value: number | string | null | undefined): number {
    return Number(value ?? 0);
  }

  getTypeLabel(type: AccountType): string {
    return ACCOUNT_TYPE_LABELS[type];
  }

  getTypeIcon(type: AccountType): string {
    return ACCOUNT_TYPE_ICONS[type];
  }

  openCreateModal(): void {
    this.showCreateModal.set(true);
    this.createForm.reset({
      name: '',
      type: AccountType.Savings,
      bank_slug: null,
      balance: 0,
      color: '',
      is_shared: false,
    });
  }

  closeCreateModal(): void {
    this.showCreateModal.set(false);
    this.createForm.reset({
      name: '',
      type: AccountType.Savings,
      bank_slug: null,
      balance: 0,
      color: '',
      is_shared: false,
    });
  }

  openBalanceModal(account: Account): void {
    this.balanceAccount.set(account);
    this.updateBalanceForm.reset({ balance: Number(account.balance ?? 0) });
    this.showBalanceModal.set(true);
  }

  closeBalanceModal(): void {
    this.showBalanceModal.set(false);
    this.balanceAccount.set(null);
    this.updateBalanceForm.reset({ balance: 0 });
  }

  private formatCop(value: number): string {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0,
    }).format(Number(value ?? 0));
  }

  async submitBalanceUpdate(): Promise<void> {
    if (this.updateBalanceForm.invalid) {
      this.updateBalanceForm.markAllAsTouched();
      return;
    }

    const account = this.balanceAccount();
    if (!account) return;

    const newBalance = Number(this.updateBalanceForm.controls.balance.value ?? 0);
     const oldBalance = Number(account.balance ?? 0);
    const confirmed = await this.confirmDialog.confirm({
      title: '¿Actualizar balance?',
      message: `${account.name}: ${this.formatCop(Number(account.balance ?? 0))} → ${this.formatCop(newBalance)}.\n\nEste cambio actualiza el saldo guardado en la cuenta y no crea una transacción.`,
      confirmLabel: 'Sí, actualizar',
      cancelLabel: 'Cancelar',
      type: 'warning',
    });
    if (!confirmed) return;

    this.progressBar.start();
    try {
      const updated = await this.accountService.updateAccountBalance(account.id, newBalance);
      if (updated) {
         await this.audit.logAction('UPDATE', 'accounts', account.id, { balance: oldBalance }, { balance: newBalance });
         await this.loadMovements({ showProgress: false });
         this.closeBalanceModal();
        this.progressBar.complete();
      } else {
        this.progressBar.error();
      }
    } catch {
      this.progressBar.error();
    }
  }

  selectColor(color: string): void {
    this.createForm.controls.color.setValue(color);
  }

  selectBank(slug: string | null): void {
    this.createForm.controls.bank_slug.setValue(slug);
    const preset = slug ? BANK_COLOR_MAP[slug] : null;
    if (preset) {
      this.createForm.controls.color.setValue(preset);
      return;
    }
    if (!slug) {
      this.createForm.controls.color.setValue('');
    }
  }

  async refreshAccounts(): Promise<void> {
    this.progressBar.start();
    try {
      await this.accountService.refreshAccounts();
      await this.loadMovements({ showProgress: false });
      this.progressBar.complete();
    } catch {
      this.progressBar.error();
    }
  }

  async submitCreate(): Promise<void> {
    if (this.createForm.invalid) {
      this.createForm.markAllAsTouched();
      return;
    }

    const raw = this.createForm.getRawValue();
    const accountType = raw.type;
    const bank = this.bankCatalog().find((item) => item.slug === raw.bank_slug);

    this.progressBar.start();
    try {
      const created = await this.accountService.createAccount({
        user_id: '',
        name: raw.name.trim(),
        type: accountType,
        bank_name: bank?.name ?? null,
        bank_slug: raw.bank_slug,
        balance: Number(raw.balance),
        currency: 'COP',
        color: raw.color,
        icon: ACCOUNT_TYPE_ICONS[accountType],
        is_active: true,
        is_shared: raw.is_shared,
      });

      if (created) {
        this.closeCreateModal();
        this.progressBar.complete();
      } else {
        this.progressBar.error();
      }
    } catch {
      this.progressBar.error();
    }
  }

  async deleteAccount(account: Account): Promise<void> {
    const confirmed = await this.confirmDialog.confirm({
      title: '¿Eliminar cuenta?',
      message: `Se eliminará permanentemente ${account.name}. Esta acción no se puede deshacer.`,
      confirmLabel: 'Sí, eliminar',
      cancelLabel: 'Cancelar',
      type: 'danger',
    });
    if (!confirmed) return;

    this.progressBar.start();
    try {
      const ok = await this.accountService.deleteAccount(account.id);
      if (ok) {
        this.progressBar.complete();
      } else {
        this.progressBar.error();
      }
    } catch {
      this.progressBar.error();
    }
  }
  openTransferModal(): void {
    if (this.accounts().length < 2) return;
    this.showTransferModal.set(true);
  }

  closeTransferModal(): void {
    this.showTransferModal.set(false);
  }

  async onTransferCompleted(): Promise<void> {
    this.showTransferModal.set(false);

    this.progressBar.start();
    try {
      await this.accountService.refreshAccounts();
      await this.loadMovements({ showProgress: false });
      this.progressBar.complete();
    } catch {
      this.progressBar.error();
    }
  }

  async loadMovements(opts: { showProgress?: boolean } = {}): Promise<void> {
    const showProgress = opts.showProgress ?? true;

    const userId = this.supabase.currentUser()?.id;
    if (!userId) {
      this.movements.set([]);
      return;
    }

    this.movementsLoading.set(true);
    if (showProgress) this.progressBar.start();

    try {
      const { data: transfers, error: transferError } = await this.supabase.client
        .from('account_transfers')
        .select('id, from_account, to_account, amount, description, date, created_at')
        .eq('user_id', userId)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(20);

      if (transferError) throw transferError;

      const transferMovements: AccountMovement[] = (transfers ?? []).map((t: any) => ({
        id: String(t.id),
        date: String(t.date ?? '').slice(0, 10),
        from_account: (t.from_account ?? null) as string | null,
        to_account: (t.to_account ?? null) as string | null,
        amount: Number(t.amount ?? 0),
        description: (t.description ?? null) as string | null,
        type: 'transfer',
        created_at: String(t.created_at ?? ''),
      }));

      let adjustmentMovements: AccountMovement[] = [];
      try {
        const { data: audits, error: auditError } = await this.supabase.client
          .from('audit_logs')
          .select('id, created_at, record_id, old_data, new_data, action, table_name')
          .eq('user_id', userId)
          .eq('table_name', 'accounts')
          .eq('action', 'UPDATE')
          .order('created_at', { ascending: false })
          .limit(20);

        if (auditError) throw auditError;

        adjustmentMovements = (audits ?? [])
          .map((row: any) => {
            const oldBalance = Number(row.old_data?.balance ?? NaN);
            const newBalance = Number(row.new_data?.balance ?? NaN);
            if (!isFinite(oldBalance) || !isFinite(newBalance) || oldBalance === newBalance) return null;

            const delta = newBalance - oldBalance;
            const oldStr = oldBalance.toLocaleString('es-CO');
            const newStr = newBalance.toLocaleString('es-CO');

            return {
              id: String(row.id),
              date: String(row.created_at ?? '').slice(0, 10),
              from_account: String(row.record_id ?? ''),
              to_account: null,
              amount: delta,
              description: `Ajuste de saldo: $ ${oldStr} → $ ${newStr}`,
              type: 'balance_adjustment',
              created_at: String(row.created_at ?? ''),
            } satisfies AccountMovement;
          })
          .filter(Boolean) as AccountMovement[];
      } catch (err) {
        console.warn('[Accounts] No se pudo cargar ajustes de saldo desde auditoría:', err);
      }

      const all = [...transferMovements, ...adjustmentMovements]
        .filter((m) => !!m.created_at)
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 20);

      this.movements.set(all);

      if (showProgress) this.progressBar.complete();
    } catch (err) {
      console.error('[Accounts] Error cargando movimientos:', err);
      this.movements.set([]);
      if (showProgress) this.progressBar.error();
    } finally {
      this.movementsLoading.set(false);
    }
  }

  movementFromName(m: AccountMovement): string {
    const id = m.from_account;
    if (!id) return '—';
    return this.accounts().find((a) => a.id === id)?.name ?? '—';
  }

  movementToName(m: AccountMovement): string {
    const id = m.to_account;
    if (!id) return '—';
    return this.accounts().find((a) => a.id === id)?.name ?? '—';
  }

  movementTypeLabel(m: AccountMovement): string {
    return m.type === 'transfer' ? 'Traslado' : 'Ajuste de saldo';
  }

  movementTypeClasses(m: AccountMovement): string {
    return m.type === 'transfer'
      ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300'
      : 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300';
  }

  formatMovementDate(dateStr: string): string {
    if (!dateStr) return '—';
    const d = new Date(dateStr + 'T12:00:00');
    return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  bankBySlug(slug?: string | null): BankCatalog | undefined {
    if (!slug) return undefined;
    return this.bankCatalog().find((item) => item.slug === slug);
  }

  accountAccent(account: Account): string {
    return this.bankBySlug(account.bank_slug)?.color ?? account.color ?? '#1E40AF';
  }

  isColorSelected(color: string): boolean {
    return this.createForm.controls.color.value === color;
  }
}












