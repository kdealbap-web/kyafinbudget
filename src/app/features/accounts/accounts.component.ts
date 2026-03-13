import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { AccountService } from '../../core/services/account.service';
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
  nequi: '#6B21A8',
  nu: '#820AD1',
  bbva: '#004481',
  davivienda: '#ED1C24',
  'banco-bogota': '#003087',
  rappicard: '#FF441A',
};

@Component({
  selector: 'app-accounts',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, CurrencyCopPipe, BankLogoComponent],
  templateUrl: './accounts.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccountsComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  readonly accountService = inject(AccountService);
  private readonly confirmDialog = inject(ConfirmDialogService);
  private readonly progressBar = inject(ProgressBarService);

  readonly accounts = computed(() => this.accountService.accounts());
  readonly isLoading = computed(() => this.accountService.isLoading());
  readonly totalBalance = computed(() => this.accountService.totalBalance());
  readonly bankCatalog = computed(() => this.accountService.bankCatalog());

  readonly showCreateModal = signal(false);

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
    await Promise.all([
      this.accountService.loadAccounts(),
      this.accountService.loadBankCatalog(),
    ]);
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
