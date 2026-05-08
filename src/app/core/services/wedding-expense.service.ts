import { Injectable, computed, inject, signal } from '@angular/core';
import { SupabaseService } from './supabase.service';

import { WeddingBudget, WeddingBudgetStatus } from '../../domain/models/wedding-budget.model';
import { WeddingExpense, WeddingExpenseStatus } from '../../domain/models/wedding-expense.model';
import { WeddingExpenseCategory } from '../../domain/models/wedding-expense-category.model';
import { WeddingExpensePayment, WeddingExpensePaymentMethod } from '../../domain/models/wedding-expense-payment.model';
import { WeddingExpenseAttachment, WeddingExpenseAttachmentType } from '../../domain/models/wedding-expense-attachment.model';

export interface WeddingBudgetCreateInput {
  event_name?: string;
  event_date: string;
  total_budget: number;
  status?: WeddingBudgetStatus;
  notes?: string | null;
}

export type WeddingBudgetUpdateInput = Partial<WeddingBudgetCreateInput>;

export interface WeddingExpenseCreateInput {
  category_id: string;
  provider_name: string;
  amount: number;
  description?: string | null;
  website_url?: string | null;
  instagram_profile?: string | null;
  contact_phone?: string | null;
  contact_email?: string | null;
  due_date?: string | null;
  account_id?: string | null;
  notes?: string | null;
}

export type WeddingExpenseUpdateInput = Partial<WeddingExpenseCreateInput> & {
  status?: WeddingExpenseStatus;
  paid_amount?: number;
};

export interface WeddingExpensePaymentCreateInput {
  amount: number;
  payment_method?: WeddingExpensePaymentMethod;
  payment_date: string;
  reference_number?: string | null;
  notes?: string | null;
}

export interface WeddingPaymentTransactionContext {
  account_id: string;
  portfolio_id?: string | null;
  concept?: string;
  category?: string;
  notes?: string | null;
}

@Injectable({ providedIn: 'root' })
export class WeddingExpenseService {
  private readonly supabase = inject(SupabaseService);

  readonly budgets = signal<WeddingBudget[]>([]);
  readonly currentBudget = signal<WeddingBudget | null>(null);
  readonly categories = signal<WeddingExpenseCategory[]>([]);
  readonly expenses = signal<WeddingExpense[]>([]);
  readonly isLoading = signal(false);
  readonly error = signal<string | null>(null);

  readonly hasBudget = computed(() => this.currentBudget() !== null);

  constructor() {
    void this.loadCategories();
  }

  private normalizeJoin<T>(value: T | T[] | null | undefined): T | null {
    if (!value) return null;
    return Array.isArray(value) ? (value[0] ?? null) : value;
  }

  private getUserIdOrThrow(): string {
    const userId = this.supabase.currentUser()?.id;
    if (!userId) throw new Error('Sin autenticación');
    return userId;
  }

  private getPartnerId(): string | null {
    return this.supabase.userProfile()?.partner_id ?? null;
  }
  private async enforceSingleInProgressBudget(activeBudgetId: string): Promise<void> {
    try {
      const { error } = await this.supabase.client
        .from('wedding_budgets')
        .update({ status: WeddingBudgetStatus.Planning })
        .neq('id', activeBudgetId)
        .eq('status', WeddingBudgetStatus.InProgress);
      if (error) throw error;
    } catch (err) {
      console.error('Error ajustando presupuesto en progreso:', err);
    }
  }

  async loadCategories(): Promise<void> {
    try {
      const { data, error } = await this.supabase.client
        .from('wedding_expense_categories')
        .select('*')
        .order('sort_order', { ascending: true });
      if (error) throw error;
      this.categories.set((data ?? []) as WeddingExpenseCategory[]);
    } catch (err) {
      console.error('Error cargando categorías de boda:', err);
      this.categories.set([]);
    }
  }

  async loadBudgets(): Promise<void> {
    this.isLoading.set(true);
    this.error.set(null);
    try {
      const { data, error } = await this.supabase.client
        .from('wedding_budgets')
        .select('*')
        .order('event_date', { ascending: true });
      if (error) throw error;
      this.budgets.set((data ?? []) as WeddingBudget[]);
    } catch (err) {
      console.error('Error cargando presupuestos de boda:', err);
      this.budgets.set([]);
      this.error.set('No se pudieron cargar los presupuestos de boda.');
    } finally {
      this.isLoading.set(false);
    }
  }

  async loadBudgetWithExpenses(budgetId: string): Promise<void> {
    this.isLoading.set(true);
    this.error.set(null);
    try {
      const { data: budget, error: budgetError } = await this.supabase.client
        .from('wedding_budgets')
        .select('*')
        .eq('id', budgetId)
        .single();
      if (budgetError) throw budgetError;

      const { data: expenses, error: expenseError } = await this.supabase.client
        .from('wedding_expenses')
        .select(
          `
          *,
          category:wedding_expense_categories(id, name, color, icon),
          payments:wedding_expense_payments(*),
          attachments:wedding_expense_attachments(*)
        `
        )
        .eq('wedding_budget_id', budgetId)
        .order('created_at', { ascending: false });
      if (expenseError) throw expenseError;

      const normalized = ((expenses ?? []) as Array<Record<string, unknown>>).map((row) => {
        const amount = Number((row as Record<string, unknown>)['amount'] ?? (row as any).amount ?? 0);

        const paymentsArr = Array.isArray((row as any)['payments'])
          ? ((row as any)['payments'] as WeddingExpensePayment[])
          : (row as any)['payments']
            ? [((row as any)['payments'] as unknown as WeddingExpensePayment)]
            : [];

        // paid_amount = SUM(payments.amount): fuente de verdad,
        // evita desincronización por triggers BD que reescriben el campo.
        const paid_amount = paymentsArr.reduce(
          (s, p) => s + Number((p as any)?.amount ?? 0),
          0,
        );
        const remaining = Math.max(0, amount - paid_amount);

        const cancelled = (row as any).status === WeddingExpenseStatus.Cancelled;
        const status = (cancelled
          ? WeddingExpenseStatus.Cancelled
          : paid_amount >= amount && amount > 0
            ? WeddingExpenseStatus.Paid
            : paid_amount > 0
              ? WeddingExpenseStatus.Partial
              : WeddingExpenseStatus.Pending) as WeddingExpenseStatus;

        return {
          ...(row as unknown as WeddingExpense),
          amount,
          paid_amount,
          remaining,
          status,
          category: this.normalizeJoin((row as any)['category'] as WeddingExpense['category']),
          payments: paymentsArr,
          attachments: Array.isArray((row as any)['attachments'])
            ? ((row as any)['attachments'] as WeddingExpenseAttachment[])
            : (row as any)['attachments']
              ? [((row as any)['attachments'] as unknown as WeddingExpenseAttachment)]
              : [],
        };
      });

      this.currentBudget.set(budget as WeddingBudget);
      this.expenses.set(normalized as WeddingExpense[]);
    } catch (err) {
      console.error('Error cargando presupuesto de boda:', err);
      this.currentBudget.set(null);
      this.expenses.set([]);
      this.error.set('No se pudo cargar el presupuesto seleccionado.');
    } finally {
      this.isLoading.set(false);
    }
  }

  async createBudget(input: WeddingBudgetCreateInput): Promise<WeddingBudget | null> {
    this.isLoading.set(true);
    this.error.set(null);
    try {
      const userId = this.getUserIdOrThrow();

      const payload = {
        user_id: userId,
        partner_id: this.getPartnerId(),
        event_name: input.event_name?.trim() || 'Boda K&A',
        event_date: input.event_date,
        total_budget: Number(input.total_budget ?? 0),
        status: input.status ?? WeddingBudgetStatus.Planning,
        notes: input.notes?.trim() || null,
      };

      const { data, error } = await this.supabase.client
        .from('wedding_budgets')
        .insert(payload)
        .select()
        .single();
      if (error) throw error;

      const budget = data as WeddingBudget;

      if (budget.status === WeddingBudgetStatus.InProgress) {
        await this.enforceSingleInProgressBudget(budget.id);
      }

      await this.loadBudgets();
      this.currentBudget.set(budget);
      return budget;
    } catch (err) {
      console.error('Error creando presupuesto de boda:', err);
      this.error.set('No se pudo crear el presupuesto.');
      return null;
    } finally {
      this.isLoading.set(false);
    }
  }

  async updateBudget(id: string, updates: WeddingBudgetUpdateInput): Promise<WeddingBudget | null> {
    this.isLoading.set(true);
    this.error.set(null);
    try {
      const payload = {
        ...(updates.event_name !== undefined ? { event_name: updates.event_name?.trim() || 'Boda K&A' } : {}),
        ...(updates.event_date !== undefined ? { event_date: updates.event_date } : {}),
        ...(updates.total_budget !== undefined ? { total_budget: Number(updates.total_budget ?? 0) } : {}),
        ...(updates.status !== undefined ? { status: updates.status } : {}),
        ...(updates.notes !== undefined ? { notes: updates.notes?.trim() || null } : {}),
      };

      const { data, error } = await this.supabase.client
        .from('wedding_budgets')
        .update(payload)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;

      const updated = data as WeddingBudget;

      if (updated.status === WeddingBudgetStatus.InProgress) {
        await this.enforceSingleInProgressBudget(updated.id);
      }

      await this.loadBudgets();
      if (this.currentBudget()?.id === id) this.currentBudget.set(updated);
      return updated;
    } catch (err) {
      console.error('Error actualizando presupuesto de boda:', err);
      this.error.set('No se pudo actualizar el presupuesto.');
      return null;
    } finally {
      this.isLoading.set(false);
    }
  }

  async createExpense(budgetId: string, input: WeddingExpenseCreateInput): Promise<WeddingExpense | null> {
    this.isLoading.set(true);
    this.error.set(null);
    try {
      const userId = this.getUserIdOrThrow();
      const payload = {
        wedding_budget_id: budgetId,
        category_id: input.category_id,
        provider_name: input.provider_name.trim(),
        description: input.description?.trim() || null,
        amount: Number(input.amount ?? 0),
        paid_amount: 0,
        status: WeddingExpenseStatus.Pending,
        website_url: input.website_url?.trim() || null,
        instagram_profile: input.instagram_profile?.trim() || null,
        contact_phone: input.contact_phone?.trim() || null,
        contact_email: input.contact_email?.trim() || null,
        due_date: input.due_date || null,
        account_id: input.account_id ?? null,
        notes: input.notes?.trim() || null,
        created_by: userId,
      };

      const { data, error } = await this.supabase.client
        .from('wedding_expenses')
        .insert(payload)
        .select(
          `
          *,
          category:wedding_expense_categories(id, name, color, icon)
        `
        )
        .single();
      if (error) throw error;

      const expenseRow = data as unknown as Record<string, unknown>;
      const normalized = {
        ...(data as unknown as WeddingExpense),
        amount: Number((expenseRow as any).amount ?? payload.amount ?? 0),
        paid_amount: Number((expenseRow as any).paid_amount ?? 0),
        remaining: Number((expenseRow as any).remaining ?? Math.max(0, Number((expenseRow as any).amount ?? payload.amount ?? 0) - Number((expenseRow as any).paid_amount ?? 0))),
        status: ((expenseRow as any).status ?? WeddingExpenseStatus.Pending) as WeddingExpenseStatus,
        category: this.normalizeJoin(expenseRow['category'] as WeddingExpense['category']),
        payments: [],
        attachments: [],
      } satisfies WeddingExpense;

      this.expenses.update((list) => [normalized, ...list]);
      return normalized;
    } catch (err) {
      console.error('Error creando gasto de boda:', err);
      this.error.set('No se pudo crear el gasto.');
      return null;
    } finally {
      this.isLoading.set(false);
    }
  }

  async updateExpense(id: string, updates: WeddingExpenseUpdateInput): Promise<WeddingExpense | null> {
    this.isLoading.set(true);
    this.error.set(null);
    try {
      const payload = {
        ...(updates.category_id !== undefined ? { category_id: updates.category_id } : {}),
        ...(updates.provider_name !== undefined ? { provider_name: updates.provider_name.trim() } : {}),
        ...(updates.description !== undefined ? { description: updates.description?.trim() || null } : {}),
        ...(updates.amount !== undefined ? { amount: Number(updates.amount ?? 0) } : {}),
        ...(updates.paid_amount !== undefined ? { paid_amount: Number(updates.paid_amount ?? 0) } : {}),
        ...(updates.status !== undefined ? { status: updates.status } : {}),
        ...(updates.website_url !== undefined ? { website_url: updates.website_url?.trim() || null } : {}),
        ...(updates.instagram_profile !== undefined
          ? { instagram_profile: updates.instagram_profile?.trim() || null }
          : {}),
        ...(updates.contact_phone !== undefined ? { contact_phone: updates.contact_phone?.trim() || null } : {}),
        ...(updates.contact_email !== undefined ? { contact_email: updates.contact_email?.trim() || null } : {}),
        ...(updates.due_date !== undefined ? { due_date: updates.due_date || null } : {}),
        ...(updates.account_id !== undefined ? { account_id: updates.account_id ?? null } : {}),
        ...(updates.notes !== undefined ? { notes: updates.notes?.trim() || null } : {}),
      };

      const { data, error } = await this.supabase.client
        .from('wedding_expenses')
        .update(payload)
        .eq('id', id)
        .select(
          `
          *,
          category:wedding_expense_categories(id, name, color, icon),
          payments:wedding_expense_payments(*),
          attachments:wedding_expense_attachments(*)
        `
        )
        .single();
      if (error) throw error;

      const expenseRow = data as unknown as Record<string, unknown>;
      const normalized = {
        ...(data as unknown as WeddingExpense),
        amount: Number((expenseRow as any).amount ?? 0),
        paid_amount: Number((expenseRow as any).paid_amount ?? 0),
        remaining: Number((expenseRow as any).remaining ?? Math.max(0, Number((expenseRow as any).amount ?? 0) - Number((expenseRow as any).paid_amount ?? 0))),
        status: ((expenseRow as any).status ?? WeddingExpenseStatus.Pending) as WeddingExpenseStatus,
        category: this.normalizeJoin(expenseRow['category'] as WeddingExpense['category']),
        payments: Array.isArray(expenseRow['payments'])
          ? (expenseRow['payments'] as WeddingExpensePayment[])
          : expenseRow['payments']
            ? ([expenseRow['payments']] as unknown as WeddingExpensePayment[])
            : [],
        attachments: Array.isArray(expenseRow['attachments'])
          ? (expenseRow['attachments'] as WeddingExpenseAttachment[])
          : expenseRow['attachments']
            ? ([expenseRow['attachments']] as unknown as WeddingExpenseAttachment[])
            : [],
      } satisfies WeddingExpense;

      this.expenses.update((list) => list.map((e) => (e.id === id ? normalized : e)));
      return normalized;
    } catch (err) {
      console.error('Error actualizando gasto de boda:', err);
      this.error.set('No se pudo actualizar el gasto.');
      return null;
    } finally {
      this.isLoading.set(false);
    }
  }


  private readonly attachmentsBucket = 'receipts';

  getAttachmentUrl(attachment: WeddingExpenseAttachment): string {
    return this.supabase.client.storage
      .from(this.attachmentsBucket)
      .getPublicUrl(attachment.storage_path).data.publicUrl;
  }

  async addAttachment(
    expenseId: string,
    file: File,
    attachmentType: WeddingExpenseAttachmentType
  ): Promise<WeddingExpenseAttachment | null> {
    this.isLoading.set(true);
    this.error.set(null);
    try {
      const userId = this.getUserIdOrThrow();
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const storagePath = `wedding/${userId}/${expenseId}/${Date.now()}_${safeName}`;

      const { error: uploadError } = await this.supabase.client.storage
        .from(this.attachmentsBucket)
        .upload(storagePath, file, {
          upsert: false,
          contentType: file.type || undefined,
        });
      if (uploadError) throw uploadError;

      const payload = {
        expense_id: expenseId,
        file_name: file.name,
        file_type: file.type || null,
        file_size: file.size || null,
        storage_path: storagePath,
        attachment_type: attachmentType,
        uploaded_by: userId,
      };

      const { data, error } = await this.supabase.client
        .from('wedding_expense_attachments')
        .insert(payload)
        .select('*')
        .single();
      if (error) throw error;

      const attachment = data as WeddingExpenseAttachment;
      this.expenses.update((list) =>
        list.map((e) =>
          e.id === expenseId
            ? { ...e, attachments: [...(e.attachments ?? []), attachment] }
            : e
        )
      );
      return attachment;
    } catch (err) {
      console.error('Error subiendo adjunto de boda:', err);
      this.error.set('No se pudo subir el adjunto.');
      return null;
    } finally {
      this.isLoading.set(false);
    }
  }

  async deleteAttachment(expenseId: string, attachment: WeddingExpenseAttachment): Promise<boolean> {
    this.isLoading.set(true);
    this.error.set(null);
    try {
      // Best-effort: borrar archivo
      try {
        await this.supabase.client.storage
          .from(this.attachmentsBucket)
          .remove([attachment.storage_path]);
      } catch (storageErr) {
        console.error('Error borrando archivo en storage:', storageErr);
      }

      const { error } = await this.supabase.client
        .from('wedding_expense_attachments')
        .delete()
        .eq('id', attachment.id);
      if (error) throw error;

      this.expenses.update((list) =>
        list.map((e) =>
          e.id === expenseId
            ? { ...e, attachments: (e.attachments ?? []).filter((a) => a.id !== attachment.id) }
            : e
        )
      );
      return true;
    } catch (err) {
      console.error('Error eliminando adjunto de boda:', err);
      this.error.set('No se pudo eliminar el adjunto.');
      return false;
    } finally {
      this.isLoading.set(false);
    }
  }

  async deleteExpense(expenseId: string): Promise<boolean> {
    this.isLoading.set(true);
    this.error.set(null);
    try {
      // 1) Best-effort: listar adjuntos para borrar archivos
      const { data: attachments, error: attError } = await this.supabase.client
        .from('wedding_expense_attachments')
        .select('id, storage_path')
        .eq('expense_id', expenseId);
      if (attError) throw attError;

      for (const a of (attachments ?? []) as Array<{ id: string; storage_path: string }>) {
        try {
          await this.supabase.client.storage
            .from(this.attachmentsBucket)
            .remove([a.storage_path]);
        } catch (storageErr) {
          console.error('Error borrando archivo en storage:', storageErr);
        }
      }

      // 2) Borrar adjuntos y pagos (por si no hay cascade)
      const { error: delAttError } = await this.supabase.client
        .from('wedding_expense_attachments')
        .delete()
        .eq('expense_id', expenseId);
      if (delAttError) throw delAttError;

      const { error: delPayError } = await this.supabase.client
        .from('wedding_expense_payments')
        .delete()
        .eq('expense_id', expenseId);
      if (delPayError) throw delPayError;

      // 3) Borrar gasto
      const { error } = await this.supabase.client
        .from('wedding_expenses')
        .delete()
        .eq('id', expenseId);
      if (error) throw error;

      this.expenses.update((list) => list.filter((e) => e.id !== expenseId));
      return true;
    } catch (err) {
      console.error('Error eliminando gasto de boda:', err);
      this.error.set('No se pudo eliminar el gasto.');
      return false;
    } finally {
      this.isLoading.set(false);
    }
  }  async cancelExpense(id: string): Promise<boolean> {
    const updated = await this.updateExpense(id, { status: WeddingExpenseStatus.Cancelled });
    return !!updated;
  }

  async addPayment(
    expenseId: string,
    payment: WeddingExpensePaymentCreateInput,
    tx?: WeddingPaymentTransactionContext,
    receipt?: File | null,
  ): Promise<boolean> {
    this.isLoading.set(true);
    this.error.set(null);

    let createdPaymentId: string | null = null;
    let createdTxId: string | null = null;

    try {
      const userId = this.getUserIdOrThrow();

      const { data: expenseRow, error: expenseError } = await this.supabase.client
        .from('wedding_expenses')
        .select('id, amount, paid_amount, status, provider_name, account_id')
        .eq('id', expenseId)
        .single();
      if (expenseError) throw expenseError;

      const expense = expenseRow as Pick<WeddingExpense, 'id' | 'amount' | 'paid_amount' | 'status' | 'provider_name' | 'account_id'>;

      const paymentAmount = Number(payment.amount ?? 0);
      if (paymentAmount <= 0) throw new Error('Monto inválido');

      const nextPaid = Number(expense.paid_amount ?? 0) + paymentAmount;
      const nextStatus =
        nextPaid >= Number(expense.amount)
          ? WeddingExpenseStatus.Paid
          : nextPaid > 0
            ? WeddingExpenseStatus.Partial
            : WeddingExpenseStatus.Pending;

      // 1) Crear registro de pago (wedding_expense_payments)
      const paymentPayload = {
        expense_id: expenseId,
        amount: paymentAmount,
        payment_method: payment.payment_method ?? WeddingExpensePaymentMethod.Transfer,
        payment_date: payment.payment_date,
        reference_number: payment.reference_number?.trim() || null,
        notes: payment.notes?.trim() || null,
        created_by: userId,
      };

      const { data: createdPayment, error: paymentError } = await this.supabase.client
        .from('wedding_expense_payments')
        .insert(paymentPayload)
        .select('id')
        .single();
      if (paymentError) throw paymentError;
      createdPaymentId = (createdPayment as { id: string }).id;

      // 1.b) Subir comprobante si se adjuntó (ligado al pago vía storage_path)
      if (receipt && createdPaymentId) {
        try {
          const safeName = receipt.name.replace(/[^a-zA-Z0-9._-]/g, '_');
          const storagePath = `wedding/${userId}/${expenseId}/payment-${createdPaymentId}/${Date.now()}_${safeName}`;

          const { error: uploadError } = await this.supabase.client.storage
            .from(this.attachmentsBucket)
            .upload(storagePath, receipt, {
              upsert: false,
              contentType: receipt.type || undefined,
            });
          if (uploadError) throw uploadError;

          const attachmentPayload = {
            expense_id: expenseId,
            file_name: receipt.name,
            file_type: receipt.type || null,
            file_size: receipt.size || null,
            storage_path: storagePath,
            attachment_type: WeddingExpenseAttachmentType.Receipt,
            uploaded_by: userId,
          };
          await this.supabase.client
            .from('wedding_expense_attachments')
            .insert(attachmentPayload);
        } catch (uploadErr) {
          // Comprobante es opcional: si falla no abortamos el pago.
          console.error('Error subiendo comprobante de pago:', uploadErr);
        }
      }

      // 2) Crear transacción para impactar cuentas/dashboard (opcional)
      const accountId = tx?.account_id ?? expense.account_id ?? null;
      if (accountId) {
        const concept = (tx?.concept ?? `💍 Boda: Pago a ${expense.provider_name}`).trim();
        const category = (tx?.category ?? 'Otros').trim() || 'Otros';
        const txPayload = {
          user_id: userId,
          portfolio_id: tx?.portfolio_id ?? null,
          account_id: accountId,
          type: 'expense' as const,
          amount: paymentAmount,
          concept,
          category,
          date: payment.payment_date,
          notes: tx?.notes ?? null,
          receipt_url: null,
          is_scheduled: false,
        };

        const { data: createdTx, error: txError } = await this.supabase.client
          .from('transactions')
          .insert(txPayload)
          .select('id')
          .single();
        if (txError) throw txError;
        createdTxId = (createdTx as { id: string }).id;
      }

      // 3) Actualizar el gasto
      const { error: updateError } = await this.supabase.client
        .from('wedding_expenses')
        .update({ paid_amount: nextPaid, status: nextStatus })
        .eq('id', expenseId);
      if (updateError) throw updateError;

      // 4) Recargar estado
      const current = this.currentBudget();
      if (current?.id) {
        await this.loadBudgetWithExpenses(current.id);
      }

      return true;
    } catch (err) {
      console.error('Error registrando pago de gasto de boda:', err);
      this.error.set('No se pudo registrar el pago.');

      // Best-effort rollback (si falló después de insertar)
      try {
        if (createdTxId) {
          await this.supabase.client.from('transactions').delete().eq('id', createdTxId);
        }
      } catch (rollbackErr) {
        console.error('Rollback tx falló:', rollbackErr);
      }

      try {
        if (createdPaymentId) {
          await this.supabase.client.from('wedding_expense_payments').delete().eq('id', createdPaymentId);
        }
      } catch (rollbackErr) {
        console.error('Rollback payment falló:', rollbackErr);
      }

      return false;
    } finally {
      this.isLoading.set(false);
    }
  }

  /**
   * Adjunta un comprobante (foto/PDF) a un pago existente que aún no lo tiene.
   * Sube al bucket `receipts` con storage_path que incluye `payment-<id>` para
   * que `paymentReceiptUrl()` lo localice.
   */
  async addReceiptToPayment(
    expenseId: string,
    paymentId: string,
    file: File,
  ): Promise<boolean> {
    this.isLoading.set(true);
    this.error.set(null);
    try {
      const userId = this.getUserIdOrThrow();
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const storagePath = `wedding/${userId}/${expenseId}/payment-${paymentId}/${Date.now()}_${safeName}`;

      const { error: uploadError } = await this.supabase.client.storage
        .from(this.attachmentsBucket)
        .upload(storagePath, file, {
          upsert: false,
          contentType: file.type || undefined,
        });
      if (uploadError) throw uploadError;

      const payload = {
        expense_id: expenseId,
        file_name: file.name,
        file_type: file.type || null,
        file_size: file.size || null,
        storage_path: storagePath,
        attachment_type: WeddingExpenseAttachmentType.Receipt,
        uploaded_by: userId,
      };
      const { error } = await this.supabase.client
        .from('wedding_expense_attachments')
        .insert(payload);
      if (error) throw error;

      const current = this.currentBudget();
      if (current?.id) await this.loadBudgetWithExpenses(current.id);
      return true;
    } catch (err) {
      console.error('Error adjuntando comprobante a pago:', err);
      this.error.set('No se pudo adjuntar el comprobante.');
      return false;
    } finally {
      this.isLoading.set(false);
    }
  }

  /**
   * Elimina un pago concreto, su comprobante adjunto, y best-effort la
   * transacción que se creó automáticamente al registrarlo. Después
   * recarga el presupuesto para recalcular paid_amount/status.
   */
  async deletePayment(expenseId: string, paymentId: string): Promise<boolean> {
    this.isLoading.set(true);
    this.error.set(null);
    try {
      // 1) Datos del pago + expense (para localizar la tx asociada)
      const { data: paymentRow } = await this.supabase.client
        .from('wedding_expense_payments')
        .select('amount, payment_date')
        .eq('id', paymentId)
        .single();

      const { data: expenseRow } = await this.supabase.client
        .from('wedding_expenses')
        .select('provider_name')
        .eq('id', expenseId)
        .single();

      // 2) Borrar comprobantes ligados al pago (path contiene "payment-<id>")
      const { data: paymentAttachments } = await this.supabase.client
        .from('wedding_expense_attachments')
        .select('id, storage_path')
        .eq('expense_id', expenseId)
        .like('storage_path', `%payment-${paymentId}%`);

      const attachList = (paymentAttachments ?? []) as Array<{ id: string; storage_path: string }>;
      for (const a of attachList) {
        try {
          await this.supabase.client.storage
            .from(this.attachmentsBucket)
            .remove([a.storage_path]);
        } catch (err) {
          console.error('Error borrando archivo de comprobante:', err);
        }
      }
      if (attachList.length) {
        await this.supabase.client
          .from('wedding_expense_attachments')
          .delete()
          .in('id', attachList.map((a) => a.id));
      }

      // 3) Best-effort: borrar transacción asociada
      if (paymentRow && expenseRow) {
        const provider = (expenseRow as { provider_name: string }).provider_name;
        const concept = `💍 Boda: Pago a ${provider}`;
        const amount = Number((paymentRow as { amount: number }).amount ?? 0);
        const date = (paymentRow as { payment_date: string }).payment_date;
        try {
          await this.supabase.client
            .from('transactions')
            .delete()
            .eq('concept', concept)
            .eq('amount', amount)
            .eq('date', date);
        } catch (err) {
          console.error('Error borrando transacción asociada:', err);
        }
      }

      // 4) Borrar el pago
      const { error: deleteError } = await this.supabase.client
        .from('wedding_expense_payments')
        .delete()
        .eq('id', paymentId);
      if (deleteError) throw deleteError;

      // 5) Recargar para recalcular paid_amount/status
      const current = this.currentBudget();
      if (current?.id) await this.loadBudgetWithExpenses(current.id);
      return true;
    } catch (err) {
      console.error('Error eliminando pago de boda:', err);
      this.error.set('No se pudo eliminar el pago.');
      return false;
    } finally {
      this.isLoading.set(false);
    }
  }
}




