import { Injectable, computed, inject, signal } from '@angular/core';
import { Debt, DebtStatus, DebtType } from '../../domain/models/debt.model';
import { CategoryType, TransactionType } from '../../domain/models/transaction.model';
import { SupabaseService } from './supabase.service';

@Injectable({ providedIn: 'root' })
export class DebtService {
  private readonly supabase = inject(SupabaseService);

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
    this.isLoading.set(true);
    try {
      const userId = this.supabase.currentUser()?.id;
      if (!userId) throw new Error('Sin autenticacion');

      const { data: debt, error: debtError } = await this.supabase.client
        .from('debts')
        .select('*')
        .eq('id', debtId)
        .single();

      if (debtError) throw debtError;
      const debtRecord = debt as Debt;

      const paymentAmount = Number(amount);
      if (paymentAmount <= 0) throw new Error('Monto invalido');

      const nextPaid = Number(debtRecord.paid_amount ?? 0) + paymentAmount;
      const nextStatus = nextPaid >= Number(debtRecord.total_amount)
        ? DebtStatus.Paid
        : debtRecord.status;

      const txPayload = {
        portfolio_id: debtRecord.portfolio_id,
        user_id: userId,
        account_id: accountId,
        concept: `Pago deuda: ${debtRecord.name}`,
        amount: paymentAmount,
        type: TransactionType.Expense,
        category: 'Pago deuda' as unknown as CategoryType,
        notes: debtRecord.creditor ? `Acreedor: ${debtRecord.creditor}` : null,
        receipt_url: null,
        date: new Date().toISOString().slice(0, 10),
        is_scheduled: false,
      };

      const { error: txError } = await this.supabase.client
        .from('transactions')
        .insert(txPayload);
      if (txError) throw txError;

      const { error: updateError } = await this.supabase.client
        .from('debts')
        .update({ paid_amount: nextPaid, status: nextStatus })
        .eq('id', debtId);
      if (updateError) throw updateError;

      await this.loadDebts();
      return true;
    } catch (err) {
      console.error('Error registrando pago de deuda:', err);
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
