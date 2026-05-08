import { Injectable, computed, inject, signal } from '@angular/core';
import { Debt, DebtStatus, DebtType } from '../../domain/models/debt.model';
import { CategoryType, TransactionType } from '../../domain/models/transaction.model';
import { SupabaseService } from './supabase.service';
import { ProgressBarService } from '../../shared/services/progress-bar.service';
import { ToastService } from '../../shared/services/toast.service';

@Injectable({ providedIn: 'root' })
export class DebtService {
  private readonly supabase = inject(SupabaseService);
  private readonly progressBar = inject(ProgressBarService);
  private readonly toast = inject(ToastService);

  readonly debts = signal<Debt[]>([]);
  readonly isLoading = signal<boolean>(false);

  readonly totalDebt = computed(() =>
    this.debts()
      .filter((debt) => debt.status === DebtStatus.Active)
      .reduce((sum, debt) => sum + Number(debt.remaining_amount ?? 0), 0)
  );

  readonly personalDebt = computed(() =>
    this.debts()
      .filter((debt) => debt.type === DebtType.Personal && debt.status !== DebtStatus.Paid)
      .reduce((sum, debt) => sum + Number(debt.remaining_amount ?? 0), 0)
  );

  readonly householdDebt = computed(() =>
    this.debts()
      .filter((debt) => debt.type === DebtType.Household && debt.status !== DebtStatus.Paid)
      .reduce((sum, debt) => sum + Number(debt.remaining_amount ?? 0), 0)
  );

  readonly overdueDebts = computed(() =>
    this.debts().filter((debt) => debt.status === DebtStatus.Overdue)
  );

  async loadDebts(): Promise<void> {
    this.isLoading.set(true);
    try {
      const { data, error } = await this.supabase.client
        .from('debts')
        .select(`
          *,
          accounts:account_id (id, name, bank_slug)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      const list = ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
        ...(row as unknown as Debt),
        account: Array.isArray(row['accounts'])
          ? (row['accounts'][0] as Debt['account'])
          : (row['accounts'] as Debt['account']),
      }));
      this.debts.set(list as Debt[]);
    } catch (err) {
      console.error('Error cargando deudas:', err);
      this.debts.set([]);
    } finally {
      this.isLoading.set(false);
    }
  }

  async createDebt(payload: Omit<Debt, 'id' | 'remaining_amount' | 'created_at' | 'updated_at' | 'account'>): Promise<boolean> {
    this.isLoading.set(true);
    try {
      const { error } = await this.supabase.client
        .from('debts')
        .insert(payload);
      if (error) throw error;
      await this.loadDebts();
      return true;
    } catch (err) {
      console.error('Error creando deuda:', err);
      return false;
    } finally {
      this.isLoading.set(false);
    }
  }
  async registerPayment(debtId: string, amount: number, accountId: string): Promise<boolean> {
    const userId = this.supabase.currentUser()?.id;
    if (!userId) return false;

    this.isLoading.set(true);
    this.progressBar.start();
    try {
      const { data: debt, error: debtError } = await this.supabase.client
        .from('debts')
        .select('*')
        .eq('id', debtId)
        .single();

      if (debtError) throw debtError;
      const debtRecord = debt as Debt;

      const paymentAmount = Number(amount);
      if (paymentAmount <= 0) throw new Error('Monto inválido');

      const nextPaid = Number(debtRecord.paid_amount ?? 0) + paymentAmount;
      const nextStatus = nextPaid >= Number(debtRecord.total_amount)
        ? DebtStatus.Paid
        : debtRecord.status;

      // 1) Actualizar deuda
      const { error: updateError } = await this.supabase.client
        .from('debts')
        .update({ paid_amount: nextPaid, status: nextStatus })
        .eq('id', debtId);
      if (updateError) throw updateError;

      // 2) Insertar transacción de gasto por pago de deuda
      const { error: txError } = await this.supabase.client
        .from('transactions')
        .insert({
          user_id: userId,
          account_id: accountId,
          portfolio_id: debtRecord.portfolio_id ?? null,
          concept: `Pago deuda: ${debtRecord.name}`,
          amount: paymentAmount,
          type: TransactionType.Expense,
          category: 'Pago deuda',
          date: new Date().toISOString().slice(0, 10),
          notes: `Acreedor: ${debtRecord.creditor ?? debtRecord.name}`,
          receipt_url: null,
          is_scheduled: false,
        });

      if (txError) {
        console.warn('Pago registrado pero no se creó transacción:', txError);
      }

      await this.loadDebts();

      this.progressBar.complete();
      if (nextStatus === DebtStatus.Paid) {
        this.toast.success('¡Deuda pagada completamente!');
      } else {
        this.toast.success('Pago registrado correctamente.');
      }
      return true;
    } catch (err) {
      console.error('Error registrando pago de deuda:', err);
      this.progressBar.error();
      this.toast.error('Error al registrar el pago de la deuda.');
      return false;
    } finally {
      this.isLoading.set(false);
    }
  }

  async updateDebt(id: string, payload: Partial<Omit<Debt, 'id' | 'remaining_amount' | 'created_at' | 'updated_at' | 'account'>>): Promise<boolean> {
    this.isLoading.set(true);
    try {
      const { error } = await this.supabase.client
        .from('debts')
        .update(payload)
        .eq('id', id);
      if (error) throw error;
      await this.loadDebts();
      return true;
    } catch (err) {
      console.error('Error actualizando deuda:', err);
      return false;
    } finally {
      this.isLoading.set(false);
    }
  }

  async deleteDebt(id: string): Promise<boolean> {
    this.isLoading.set(true);
    try {
      const { error } = await this.supabase.client
        .from('debts')
        .delete()
        .eq('id', id);
      if (error) throw error;
      this.debts.update((list) => list.filter((debt) => debt.id !== id));
      return true;
    } catch (err) {
      console.error('Error eliminando deuda:', err);
      return false;
    } finally {
      this.isLoading.set(false);
    }
  }
}

