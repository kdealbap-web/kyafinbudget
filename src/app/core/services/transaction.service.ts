import { Injectable, inject, signal, computed } from '@angular/core';
import {
    CategoryType,
    Transaction,
    TransactionType,
} from '../../domain/models/transaction.model';
import { SupabaseService } from './supabase.service';
import { ProgressBarService } from '../../shared/services/progress-bar.service';
import { ToastService } from '../../shared/services/toast.service';

const TRANSACTIONS_TABLE = 'transactions';

export interface TransactionFilters {
    type?: TransactionType | null;
    category?: CategoryType | null;
    portfolioId?: string | null;
    accountId?: string | null;
    month?: number | null;   // 0-11
    year?: number | null;
    search?: string | null;
}

@Injectable({ providedIn: 'root' })
export class TransactionService {
    private readonly supabase = inject(SupabaseService);
    private readonly progressBar = inject(ProgressBarService);
    private readonly toast = inject(ToastService);

    readonly transactions = signal<Transaction[]>([]);
    readonly totalCount = signal<number>(0);
    readonly isLoading = signal<boolean>(false);
    readonly PAGE_SIZE = 50;

    // ── Computed signals del período filtrado ────────────────────────────────
    readonly totalIncome = computed(() =>
        this.transactions()
            .filter(t => t.type === TransactionType.Income)
            .reduce((sum, t) => sum + Number(t.amount), 0)
    );

    readonly totalExpense = computed(() =>
        this.transactions()
            .filter(t => t.type === TransactionType.Expense)
            .reduce((sum, t) => sum + Number(t.amount), 0)
    );

    readonly balance = computed(() => this.totalIncome() - this.totalExpense());

    // ── Carga de transacciones ───────────────────────────────────────────────
    async loadTransactions(
        filters: TransactionFilters = {},
        page = 1
    ): Promise<void> {
        this.progressBar.start();
        this.isLoading.set(true);
        try {
            const currentPage = Math.max(1, page);
            const from = (currentPage - 1) * this.PAGE_SIZE;
            const to = from + this.PAGE_SIZE - 1;

            let query = this.supabase.client
                .from(TRANSACTIONS_TABLE)
                .select('*, account:account_id(id, name, bank_slug, bank_name, color)', { count: 'exact' })
                .order('date', { ascending: false })
                .range(from, to);

            // Filtro por mes/año
            if (filters.year != null) {
                const year = filters.year;
                const month = filters.month;
                if (month != null) {
                    const startDate = new Date(year, month, 1).toISOString().split('T')[0];
                    const endDate = new Date(year, month + 1, 0).toISOString().split('T')[0];
                    query = query.gte('date', startDate).lte('date', endDate);
                } else {
                    query = query
                        .gte('date', `${year}-01-01`)
                        .lte('date', `${year}-12-31`);
                }
            }

            if (filters.type) query = query.eq('type', filters.type);
            if (filters.category) query = query.eq('category', filters.category);
            if (filters.portfolioId) query = query.eq('portfolio_id', filters.portfolioId);
            if (filters.accountId) query = query.eq('account_id', filters.accountId);
            if (filters.search?.trim()) query = query.ilike('concept', `%${filters.search.trim()}%`);

            const { data, count, error } = await query;
            if (error) throw error;

            this.transactions.set((data ?? []) as unknown as Transaction[]);
            this.totalCount.set(count ?? 0);
            this.progressBar.complete();
        } catch (err) {
            console.error('[TransactionService] Error cargando transacciones:', err);
            this.transactions.set([]);
            this.totalCount.set(0);
            this.progressBar.error();
            this.toast.error('Error al cargar las transacciones');
        } finally {
            this.isLoading.set(false);
        }
    }

    // ── Obtener por ID ───────────────────────────────────────────────────────
    async getById(id: string): Promise<Transaction | null> {
        try {
            const { data, error } = await this.supabase.client
                .from(TRANSACTIONS_TABLE)
                .select('*, account:account_id(id, name, bank_slug, bank_name, color)')
                .eq('id', id)
                .single();
            if (error) throw error;
            return data as unknown as Transaction;
        } catch (err) {
            console.error('[TransactionService] Error cargando transacción:', err);
            return null;
        }
    }

    // ── Crear ────────────────────────────────────────────────────────────────
    async createTransaction(
        payload: Omit<Transaction, 'id' | 'created_at' | 'updated_at'>,
        receiptFile?: File
    ): Promise<Transaction | null> {
        this.progressBar.start();
        this.isLoading.set(true);
        try {
            const receiptUrl = await this.resolveReceiptUrl(
                payload.user_id,
                payload.receipt_url,
                receiptFile
            );
            const { data, error } = await this.supabase.client
                .from(TRANSACTIONS_TABLE)
                .insert({ ...payload, receipt_url: receiptUrl })
                .select('*')
                .single();
            if (error) throw error;

            const created = data as unknown as Transaction;
            this.transactions.update(current => [created, ...current]);
            this.totalCount.update(c => c + 1);
            this.progressBar.complete();
            this.toast.success('Transacción guardada correctamente');
            return created;
        } catch (err) {
            console.error('[TransactionService] Error creando transacción:', err);
            this.progressBar.error();
            this.toast.error('Error al guardar la transacción');
            return null;
        } finally {
            this.isLoading.set(false);
        }
    }

    // ── Actualizar ───────────────────────────────────────────────────────────
    async updateTransaction(
        id: string,
        payload: Partial<Omit<Transaction, 'id' | 'created_at'>>,
        receiptFile?: File
    ): Promise<Transaction | null> {
        this.progressBar.start();
        this.isLoading.set(true);
        try {
            const receiptUrl = await this.resolveReceiptUrl(
                payload.user_id,
                payload.receipt_url,
                receiptFile
            );
            const updatePayload = {
                ...payload,
                receipt_url: receiptFile ? receiptUrl : payload.receipt_url,
            };
            const { data, error } = await this.supabase.client
                .from(TRANSACTIONS_TABLE)
                .update(updatePayload)
                .eq('id', id)
                .select('*')
                .single();
            if (error) throw error;

            const updated = data as unknown as Transaction;
            this.transactions.update(current =>
                current.map(tx => (tx.id === id ? updated : tx))
            );
            this.progressBar.complete();
            this.toast.success('Transacción actualizada correctamente');
            return updated;
        } catch (err) {
            console.error('[TransactionService] Error actualizando transacción:', err);
            this.progressBar.error();
            this.toast.error('Error al actualizar la transacción');
            return null;
        } finally {
            this.isLoading.set(false);
        }
    }

    // ── Eliminar ─────────────────────────────────────────────────────────────
    async deleteTransaction(id: string): Promise<boolean> {
        this.progressBar.start();
        this.isLoading.set(true);
        try {
            const { error } = await this.supabase.client
                .from(TRANSACTIONS_TABLE)
                .delete()
                .eq('id', id);
            if (error) throw error;

            this.transactions.update(current => current.filter(tx => tx.id !== id));
            this.totalCount.update(c => Math.max(0, c - 1));
            this.progressBar.complete();
            this.toast.success('Transacción eliminada');
            return true;
        } catch (err) {
            console.error('[TransactionService] Error eliminando transacción:', err);
            this.progressBar.error();
            this.toast.error('Error al eliminar la transacción');
            return false;
        } finally {
            this.isLoading.set(false);
        }
    }

    // ── Helpers privados ─────────────────────────────────────────────────────
    private async resolveReceiptUrl(
        userId?: string | null,
        currentUrl?: string | null,
        receiptFile?: File
    ): Promise<string | null> {
        if (!receiptFile) return currentUrl ?? null;
        if (!userId) return null;
        return this.supabase.uploadReceipt(receiptFile, userId);
    }
}
