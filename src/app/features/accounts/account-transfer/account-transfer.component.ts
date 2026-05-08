import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';

import { Account } from '../../../domain/models/account.model';
import { BankLogoComponent } from '../../../shared/components/bank-logo/bank-logo.component';
import { CurrencyCopPipe } from '../../../shared/pipes/currency-cop.pipe';
import { AccountTransferService } from '../../../core/services/account-transfer.service';

@Component({
  selector: 'app-account-transfer',
  standalone: true,
  imports: [CommonModule, BankLogoComponent, CurrencyCopPipe],
  templateUrl: './account-transfer.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccountTransferComponent {
  private readonly transferSvc = inject(AccountTransferService);

  @Input({ required: true }) accounts: Account[] = [];

  @Output() closed = new EventEmitter<void>();
  @Output() completed = new EventEmitter<void>();

  fromAccountId = signal('');
  toAccountId = signal('');
  amount = signal<number | null>(null);
  description = signal('');
  date = signal(this.todayISO());

  submitted = signal(false);
  isSaving = signal(false);

  fromAccount = computed(() => this.accounts.find((a) => a.id === this.fromAccountId()) ?? null);
  toAccount = computed(() => this.accounts.find((a) => a.id === this.toAccountId()) ?? null);

  availableToAccounts = computed(() =>
    this.accounts.filter((a) => a.id !== this.fromAccountId())
  );

  maxAmount = computed(() => Number(this.fromAccount()?.balance ?? 0));

  isValid = computed(() => {
    const from = this.fromAccountId();
    const to = this.toAccountId();
    const amount = Number(this.amount() ?? 0);
    const max = this.maxAmount();

    return (
      !!from &&
      !!to &&
      from !== to &&
      amount > 0 &&
      amount <= max &&
      (this.date()?.length ?? 0) > 0
    );
  });

  errors = computed(() => {
    const from = this.fromAccountId();
    const to = this.toAccountId();
    const amount = Number(this.amount() ?? 0);
    const max = this.maxAmount();
    const date = this.date();

    return {
      from: this.submitted() && !from,
      to: this.submitted() && (!to || to === from),
      amountRequired: this.submitted() && amount <= 0,
      amountTooHigh: this.submitted() && amount > 0 && amount > max,
      date: this.submitted() && !date,
    };
  });

  onFromChange(accountId: string): void {
    this.fromAccountId.set(accountId);
    if (this.toAccountId() === accountId) this.toAccountId.set('');

    const max = this.maxAmount();
    const currentAmount = Number(this.amount() ?? 0);
    if (currentAmount > max) this.amount.set(max > 0 ? max : null);
  }

  onAmountInput(event: Event): void {
    const raw = (event.target as HTMLInputElement).value.replace(/\D/g, '');
    this.amount.set(raw ? Number(raw) : null);
  }

  displayAmount(): string {
    const v = this.amount();
    if (!v) return '';
    return v.toLocaleString('es-CO');
  }

  formatCop(value: number): string {
    return '$ ' + Number(value ?? 0).toLocaleString('es-CO');
  }

  close(): void {
    this.closed.emit();
  }

  async submit(): Promise<void> {
    this.submitted.set(true);
    if (!this.isValid()) return;

    this.isSaving.set(true);
    try {
      const ok = await this.transferSvc.createTransfer({
        from_account: this.fromAccountId(),
        to_account: this.toAccountId(),
        amount: Number(this.amount() ?? 0),
        description: this.description().trim() || null,
        date: this.date(),
      });

      if (!ok) return;

      this.completed.emit();
      this.closed.emit();
    } finally {
      this.isSaving.set(false);
    }
  }

  private todayISO(): string {
    return new Date().toISOString().split('T')[0];
  }
}
