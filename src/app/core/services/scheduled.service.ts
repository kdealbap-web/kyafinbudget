import { Injectable, inject, signal } from '@angular/core';
import { CategoryType, TransactionType } from '../../domain/models/transaction.model';
import { SupabaseService } from './supabase.service';
import { ProgressBarService } from '../../shared/services/progress-bar.service';
import { ToastService } from '../../shared/components/toast/toast.service';

export interface ScheduledPayment {
  id: string;
  portfolio_id: string;
  user_id: string;
  account_id: string | null;
  concept: string;
  amount: number;
  type: TransactionType;
  category: CategoryType;
  day_of_month: number;
  alert_email: string | null;
  is_active: boolean;
  last_sent: string | null;
  portfolio?: { id: string; name: string; type?: string } | null;
  account?: { id: string; name: string; bank_slug?: string | null; bank_name?: string | null; color?: string | null } | null;
}

@Injectable({ providedIn: 'root' })
export class ScheduledService {
  private readonly supabase = inject(SupabaseService);
  private readonly progressBar = inject(ProgressBarService);
  private readonly toast = inject(ToastService);

  readonly scheduledPayments = signal<ScheduledPayment[]>([]);
  readonly isLoading = signal<boolean>(false);

  async loadScheduledPayments(): Promise<void> {
    this.isLoading.set(true);
    this.progressBar.start();
    try {
      const { data, error } = await this.supabase.client
        .from('scheduled_payments')
        .select(`
          id, portfolio_id, user_id, account_id,
          concept, amount, type, category,
          day_of_month, alert_email, is_active, last_sent,
          portfolios:portfolio_id (id, name, type),
          accounts:account_id (id, name, bank_slug, bank_name, color)
        `)
        .order('day_of_month', { ascending: true });

      if (error) throw error;

      const mapped = ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
        id: String(row['id']),
        portfolio_id: String(row['portfolio_id']),
        user_id: String(row['user_id']),
        account_id: (row['account_id'] as string | null) ?? null,
        concept: String(row['concept'] ?? ''),
        amount: Number(row['amount'] ?? 0),
        type: (row['type'] as TransactionType) ?? TransactionType.Expense,
        category: (row['category'] as CategoryType) ?? CategoryType.Other,
        day_of_month: Number(row['day_of_month'] ?? 1),
        alert_email: (row['alert_email'] as string | null) ?? null,
        is_active: Boolean(row['is_active']),
        last_sent: (row['last_sent'] as string | null) ?? null,
        portfolio: Array.isArray(row['portfolios'])
          ? (row['portfolios'][0] as { id: string; name: string; type?: string })
          : (row['portfolios'] as { id: string; name: string; type?: string } | null),
        account: Array.isArray(row['accounts'])
          ? (row['accounts'][0] as { id: string; name: string; bank_slug?: string | null; bank_name?: string | null; color?: string | null })
          : (row['accounts'] as { id: string; name: string; bank_slug?: string | null; bank_name?: string | null; color?: string | null } | null),
      }));

      this.scheduledPayments.set(mapped);
      this.progressBar.complete();
    } catch (err) {
      console.error('Error cargando pagos programados:', err);
      this.scheduledPayments.set([]);
      this.progressBar.error();
      this.toast.error('Error al cargar los pagos programados.');
    } finally {
      this.isLoading.set(false);
    }
  }

  async createScheduledPayment(
    payload: Omit<ScheduledPayment, 'id' | 'last_sent' | 'portfolio' | 'account'>
  ): Promise<boolean> {
    this.isLoading.set(true);
    this.progressBar.start();
    try {
      const { error } = await this.supabase.client
        .from('scheduled_payments')
        .insert(payload);
      if (error) throw error;
      await this.loadScheduledPayments();
      this.toast.success('Pago programado guardado correctamente.');
      this.progressBar.complete();
      return true;
    } catch (err) {
      console.error('Error creando pago programado:', err);
      this.progressBar.error();
      this.toast.error('Error al guardar el pago programado.');
      return false;
    } finally {
      this.isLoading.set(false);
    }
  }

  async updateScheduledPayment(
    id: string,
    payload: Partial<Omit<ScheduledPayment, 'id' | 'last_sent' | 'portfolio' | 'account'>>
  ): Promise<boolean> {
    this.isLoading.set(true);
    this.progressBar.start();
    try {
      const { error } = await this.supabase.client
        .from('scheduled_payments')
        .update(payload)
        .eq('id', id);
      if (error) throw error;
      await this.loadScheduledPayments();
      this.toast.success('Pago programado actualizado.');
      this.progressBar.complete();
      return true;
    } catch (err) {
      console.error('Error actualizando pago programado:', err);
      this.progressBar.error();
      this.toast.error('Error al actualizar el pago programado.');
      return false;
    } finally {
      this.isLoading.set(false);
    }
  }

  async toggleActive(id: string, isActive: boolean): Promise<boolean> {
    this.progressBar.start();
    try {
      const ok = await this.updateScheduledPayment(id, { is_active: isActive });
      if (ok) {
        this.toast.success(isActive ? 'Pago activado.' : 'Pago desactivado.');
      }
      return ok;
    } catch {
      this.progressBar.error();
      this.toast.error('Error al cambiar el estado del pago.');
      return false;
    }
  }

  async deleteScheduledPayment(id: string): Promise<boolean> {
    this.isLoading.set(true);
    this.progressBar.start();
    try {
      const { error } = await this.supabase.client
        .from('scheduled_payments')
        .delete()
        .eq('id', id);
      if (error) throw error;
      this.scheduledPayments.update((list) => list.filter((item) => item.id !== id));
      this.toast.success('Pago programado eliminado.');
      this.progressBar.complete();
      return true;
    } catch (err) {
      console.error('Error eliminando pago programado:', err);
      this.progressBar.error();
      this.toast.error('Error al eliminar el pago programado.');
      return false;
    } finally {
      this.isLoading.set(false);
    }
  }
}


