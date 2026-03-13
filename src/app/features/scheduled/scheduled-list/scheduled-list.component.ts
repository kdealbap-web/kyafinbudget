import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ScheduledPayment, ScheduledService } from '../../../core/services/scheduled.service';
import { CategoryType } from '../../../domain/models/transaction.model';
import { CurrencyCopPipe } from '../../../shared/pipes/currency-cop.pipe';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import { BankLogoComponent } from '../../../shared/components/bank-logo/bank-logo.component';

@Component({
  selector: 'app-scheduled-list',
  standalone: true,
  imports: [CommonModule, RouterModule, CurrencyCopPipe, ConfirmDialogComponent, BankLogoComponent],
  templateUrl: './scheduled-list.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ScheduledListComponent implements OnInit {
  private readonly scheduledService = inject(ScheduledService);

  readonly scheduledPayments = computed(() => this.scheduledService.scheduledPayments());
  readonly isLoading = computed(() => this.scheduledService.isLoading());

  @ViewChild(ConfirmDialogComponent) confirmDialog!: ConfirmDialogComponent;

  readonly categoryIcons: Record<string, string> = {
    [CategoryType.Rent]: '🏠',
    [CategoryType.Utilities]: '💡',
    [CategoryType.Food]: '🍽️',
    [CategoryType.Transport]: '🚗',
    [CategoryType.Health]: '🏥',
    [CategoryType.Entertainment]: '🎬',
    [CategoryType.Education]: '📚',
    [CategoryType.Other]: '📦',
  };

  async ngOnInit(): Promise<void> {
    await this.scheduledService.loadScheduledPayments();
  }

  getCategoryIcon(category: string): string {
    return this.categoryIcons[category] ?? '📅';
  }

  getNextDateLabel(dayOfMonth: number): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();

    const daysInCurrentMonth = new Date(year, month + 1, 0).getDate();
    const normalizedDay = Math.min(dayOfMonth, daysInCurrentMonth);
    const candidate = new Date(year, month, normalizedDay);

    let next = candidate;
    if (candidate.getDate() < now.getDate()) {
      const nextMonth = month + 1;
      const nextYear = nextMonth > 11 ? year + 1 : year;
      const normalizedNextMonth = nextMonth > 11 ? 0 : nextMonth;
      const daysInNextMonth = new Date(nextYear, normalizedNextMonth + 1, 0).getDate();
      next = new Date(nextYear, normalizedNextMonth, Math.min(dayOfMonth, daysInNextMonth));
    }

    return next.toLocaleDateString('es-CO', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }

  async toggleActive(payment: ScheduledPayment): Promise<void> {
    await this.scheduledService.toggleActive(payment.id, !payment.is_active);
  }

  async requestDelete(payment: ScheduledPayment): Promise<void> {
    const confirmed = await this.confirmDialog.open({
      title: 'Eliminar pago programado',
      message: `¿Eliminar el pago «${payment.concept}»? Esta acción no se puede deshacer.`,
      type: 'danger',
      confirmLabel: 'Eliminar',
      cancelLabel: 'Cancelar'
    });

    if (confirmed) {
      await this.scheduledService.deleteScheduledPayment(payment.id);
    }
  }
}
