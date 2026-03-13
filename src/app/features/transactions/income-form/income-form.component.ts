import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';

import { SupabaseService } from '../../../core/services/supabase.service';
import { TransactionService } from '../../../core/services/transaction.service';
import { AccountService } from '../../../core/services/account.service';
import { PortfolioService } from '../../../core/services/portfolio.service';
import { Account } from '../../../domain/models/account.model';
import { Portfolio } from '../../../domain/models/portfolio.model';
import { BankLogoComponent } from '../../../shared/components/bank-logo/bank-logo.component';

export const INCOME_CATEGORIES = [
  { value: 'Nómina', label: 'Nómina', icon: '💼' },
  { value: 'Transferencia', label: 'Transferencia', icon: '💸' },
  { value: 'Freelance', label: 'Freelance', icon: '💻' },
  { value: 'Arriendo recibido', label: 'Arriendo recibido', icon: '🏠' },
  { value: 'Otro ingreso', label: 'Otro ingreso', icon: '📥' },
];

@Component({
  selector: 'app-income-form',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, BankLogoComponent],
  templateUrl: './income-form.component.html',
})
export class IncomeFormComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly supabase = inject(SupabaseService);
  private readonly txService = inject(TransactionService);
  private readonly accountSvc = inject(AccountService);
  private readonly portfolioSvc = inject(PortfolioService);

  // ── Modo edición ──────────────────────────────────────────────────────────
  editId = signal<string | null>(null);
  isEdit = computed(() => !!this.editId());

  // ── Campos del formulario ─────────────────────────────────────────────────
  concept = signal('');
  amount = signal<number | null>(null);
  accountId = signal('');
  date = signal(this.todayISO());
  category = signal('');
  notes = signal('');
  portfolioId = signal('');

  readonly today = new Date().toISOString().split('T')[0];

  // ── Estado UI ─────────────────────────────────────────────────────────────
  accounts = computed(() => this.accountSvc.accounts());
  portfolios = computed(() => this.portfolioSvc.portfolios());
  isLoading = signal(false);
  submitted = signal(false);

  readonly categories = INCOME_CATEGORIES;

  // ── Validación ────────────────────────────────────────────────────────────
  readonly isValid = computed(() =>
    this.concept().trim().length > 0 &&
    (this.amount() ?? 0) > 0 &&
    this.accountId().length > 0 &&
    this.date().length > 0
  );

  readonly errors = computed(() => ({
    concept: this.submitted() && !this.concept().trim(),
    amount: this.submitted() && !(this.amount() && this.amount()! > 0),
    accountId: this.submitted() && !this.accountId(),
    date: this.submitted() && !this.date(),
  }));

  async ngOnInit(): Promise<void> {
    await Promise.all([
      this.accountSvc.loadAccounts(),
      this.portfolioSvc.loadPortfolios(),
    ]);

    // Preseleccionar primer portafolio
    const portfolios = this.portfolioSvc.portfolios();
    if (portfolios.length && !this.portfolioId()) {
      this.portfolioId.set(portfolios[0].id);
    }

    // Modo edición — cargar datos si hay :id
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.editId.set(id);
      await this.loadForEdit(id);
    }
  }

  private async loadForEdit(id: string): Promise<void> {
    const tx = await this.txService.getById(id);
    if (!tx) return;
    this.concept.set(tx.concept);
    this.amount.set(Number(tx.amount));
    this.accountId.set((tx as unknown as { account_id?: string }).account_id ?? '');
    this.date.set(tx.date);
    this.category.set(tx.category ?? '');
    this.notes.set(tx.notes ?? '');
    this.portfolioId.set(tx.portfolio_id ?? '');
  }

  async submit(): Promise<void> {
    this.submitted.set(true);
    if (!this.isValid()) return;

    const userId = this.supabase.currentUser()?.id;
    if (!userId) return;

    const payload = {
      user_id: userId,
      portfolio_id: this.portfolioId() || null,
      account_id: this.accountId(),
      type: 'income' as const,
      amount: this.amount()!,
      concept: this.concept().trim(),
      category: this.category() || null,
      date: this.date(),
      notes: this.notes().trim() || null,
      is_scheduled: false,
      receipt_url: null,
    };

    const id = this.editId();
    if (id) {
      await this.txService.updateTransaction(id, payload as never);
    } else {
      await this.txService.createTransaction(payload as never);
    }

    if (!this.txService.isLoading()) {
      void this.router.navigate(['/transactions']);
    }
  }

  goBack(): void {
    if (this.isEdit()) {
      void this.router.navigate(['/transactions']);
    } else {
      void this.router.navigate(['/transactions/new']);
    }
  }

  selectAccount(id: string): void {
    this.accountId.set(id);
  }

  // ── Helpers ────────────────────────────────────────────────────────────────
  onAmountInput(event: Event): void {
    const raw = (event.target as HTMLInputElement).value.replace(/\D/g, '');
    this.amount.set(raw ? Number(raw) : null);
  }

  displayAmount(): string {
    const v = this.amount();
    if (!v) return '';
    return v.toLocaleString('es-CO');
  }

  private todayISO(): string {
    return new Date().toISOString().split('T')[0];
  }

  getAccountSlug(acc: Account): string {
    return acc.bank_slug ?? '';
  }
}



