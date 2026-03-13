import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { AccountService } from '../../../core/services/account.service';
import { PortfolioService } from '../../../core/services/portfolio.service';
import { ScheduledPayment, ScheduledService } from '../../../core/services/scheduled.service';
import { SupabaseService } from '../../../core/services/supabase.service';
import { CategoryType, TransactionType } from '../../../domain/models/transaction.model';
import { BankLogoComponent } from '../../../shared/components/bank-logo/bank-logo.component';

interface CategoryOption {
  value: CategoryType;
  label: string;
  emoji: string;
}

@Component({
  selector: 'app-scheduled-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, BankLogoComponent],
  templateUrl: './scheduled-form.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ScheduledFormComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly scheduledService = inject(ScheduledService);
  private readonly portfolioService = inject(PortfolioService);
  private readonly accountService = inject(AccountService);
  private readonly supabase = inject(SupabaseService);

  readonly isEditMode = signal(false);
  readonly editId = signal<string | null>(null);
  readonly isSaving = computed(() => this.scheduledService.isLoading());

  readonly portfolios = computed(() => this.portfolioService.portfolios());
  readonly accounts = computed(() => this.accountService.accounts());

  // SOLO gastos — hardcoded según spec del proyecto
  readonly categoryOptions: CategoryOption[] = [
    { value: CategoryType.Utilities,     label: 'Servicios públicos', emoji: '💡' },
    { value: CategoryType.Rent,          label: 'Arriendo',           emoji: '🏠' },
    { value: CategoryType.Food,          label: 'Alimentación',       emoji: '🍽️' },
    { value: CategoryType.Transport,     label: 'Transporte',         emoji: '🚗' },
    { value: CategoryType.Health,        label: 'Salud',              emoji: '🏥' },
    { value: CategoryType.Entertainment, label: 'Entretenimiento',    emoji: '🎬' },
    { value: CategoryType.Education,     label: 'Educación',          emoji: '📚' },
    { value: CategoryType.Other,         label: 'Otros gastos',       emoji: '📦' },
  ];

  readonly dayOptions = Array.from({ length: 31 }, (_, i) => i + 1);

  readonly form = this.fb.nonNullable.group({
    // type siempre expense — no se muestra en el template
    type: this.fb.nonNullable.control<TransactionType>(TransactionType.Expense),
    concept:      this.fb.nonNullable.control<string>('',  [Validators.required, Validators.minLength(2)]),
    amount:       this.fb.control<number | null>(null,     [Validators.required, Validators.min(1)]),
    day_of_month: this.fb.nonNullable.control<number>(1,   [Validators.required, Validators.min(1), Validators.max(31)]),
    portfolio_id: this.fb.nonNullable.control<string>('',  [Validators.required]),
    account_id:   this.fb.control<string | null>(null,     [Validators.required]),
    category:     this.fb.nonNullable.control<CategoryType>(CategoryType.Other, [Validators.required]),
    alert_email:  this.fb.control<string>('',              [Validators.email]),
    is_active:    this.fb.nonNullable.control<boolean>(true),
  });

  async ngOnInit(): Promise<void> {
    await Promise.all([
      this.portfolioService.loadPortfolios(),
      this.accountService.loadAccounts(),
      this.accountService.loadBankCatalog(),
      this.scheduledService.loadScheduledPayments(),
    ]);

    const id = this.route.snapshot.paramMap.get('id');
    if (!id) return;

    this.isEditMode.set(true);
    this.editId.set(id);

    const scheduled = this.scheduledService.scheduledPayments().find((item) => item.id === id);
    if (scheduled) this.patchForm(scheduled);
  }

  hasError(controlName: keyof typeof this.form.controls): boolean {
    const control = this.form.controls[controlName];
    return Boolean(control.invalid && (control.dirty || control.touched));
  }

  selectDay(day: number): void {
    this.form.controls.day_of_month.setValue(day);
  }

  selectCategory(category: CategoryType): void {
    this.form.controls.category.setValue(category);
  }

  selectAccount(accountId: string): void {
    this.form.controls.account_id.setValue(accountId);
  }

  async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const userId = this.supabase.currentUser()?.id;
    if (!userId) return;

    const raw = this.form.getRawValue();
    const payload = {
      ...raw,
      concept:    raw.concept.trim(),
      amount:     Number(raw.amount ?? 0),
      alert_email: raw.alert_email?.trim() || null,
      user_id:    userId,
    };

    if (this.isEditMode() && this.editId()) {
      const ok = await this.scheduledService.updateScheduledPayment(this.editId()!, payload);
      if (ok) void this.router.navigate(['/scheduled']);
      return;
    }

    const ok = await this.scheduledService.createScheduledPayment(payload);
    if (ok) void this.router.navigate(['/scheduled']);
  }

  private patchForm(item: ScheduledPayment): void {
    this.form.patchValue({
      concept:      item.concept,
      amount:       item.amount,
      day_of_month: item.day_of_month,
      portfolio_id: item.portfolio_id,
      account_id:   item.account_id,
      category:     item.category,
      alert_email:  item.alert_email ?? '',
      is_active:    item.is_active,
    });
  }
}
