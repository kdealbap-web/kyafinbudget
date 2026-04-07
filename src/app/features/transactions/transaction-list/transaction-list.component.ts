import {
    ChangeDetectionStrategy,
    Component,
    OnInit,
    computed,
    inject,
    signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';

import { TransactionService, TransactionFilters } from '../../../core/services/transaction.service';
import { AccountService } from '../../../core/services/account.service';
import { ConfirmDialogService } from '../../../shared/services/confirm-dialog.service';
import { SupabaseService } from '../../../core/services/supabase.service';

import { Transaction, TransactionType, CategoryType } from '../../../domain/models/transaction.model';
import { CurrencyCopPipe } from '../../../shared/pipes/currency-cop.pipe';
import { BankLogoComponent } from '../../../shared/components/bank-logo/bank-logo.component';

// ── Meses en español ──────────────────────────────────────────────────────────
interface WeddingPendingExpense {
    id: string;
    provider_name: string;
    remaining: number;
    due_date: string | null;
    status: string;
}

const MONTHS_ES = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

// ── Iconos de categoría ───────────────────────────────────────────────────────
export const TX_CATEGORY_META: Record<string, { icon: string; color: string }> = {
    'Arriendo':          { icon: '🏠', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300' },
    'Servicios':         { icon: '💡', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300' },
    'Alimentación':      { icon: '🍽️', color: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300' },
    'Transporte':        { icon: '🚗', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300' },
    'Salud':             { icon: '🏥', color: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300' },
    'Entretenimiento':   { icon: '🎬', color: 'bg-pink-100 text-pink-800 dark:bg-pink-900/40 dark:text-pink-300' },
    'Educación':         { icon: '📚', color: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300' },
    'Viajes':            { icon: '✈️', color: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/40 dark:text-cyan-300' },
    'Tecnología':        { icon: '💻', color: 'bg-slate-100 text-slate-800 dark:bg-slate-900/40 dark:text-slate-300' },
    'Deudas':            { icon: '💳', color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300' },
    'Otros':             { icon: '📦', color: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300' },
    'Nómina':            { icon: '💼', color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300' },
    'Transferencia':     { icon: '💸', color: 'bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300' },
    'Freelance':         { icon: '💻', color: 'bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300' },
    'Arriendo recibido': { icon: '🏠', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300' },
    'Otro ingreso':      { icon: '📥', color: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300' },
};

export const ALL_EXPENSE_CATEGORIES = [
    'Servicios públicos', 'Arriendo', 'Viajes', 'Tecnología', 'Deudas',
    'Alimentación', 'Transporte', 'Salud', 'Otros gastos'
];

export const ALL_INCOME_CATEGORIES = [
    'Nómina', 'Transferencia', 'Freelance', 'Arriendo recibido', 'Otro ingreso'
];

export const ALL_TX_CATEGORIES = [...ALL_INCOME_CATEGORIES, ...ALL_EXPENSE_CATEGORIES];

@Component({
    selector: 'app-transaction-list',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [CommonModule, RouterModule, FormsModule, CurrencyCopPipe, BankLogoComponent],
    templateUrl: './transaction-list.component.html',
})
export class TransactionListComponent implements OnInit {
    private readonly txService = inject(TransactionService);
    private readonly accountService = inject(AccountService);
    private readonly confirmDialog = inject(ConfirmDialogService);
    private readonly supabase = inject(SupabaseService);

    // ── Estado de filtros ──────────────────────────────────────────────────────
    readonly selectedYear     = signal<number>(new Date().getFullYear());
    readonly selectedMonth    = signal<number>(new Date().getMonth());
    readonly selectedType     = signal<TransactionType | null>(null);
    readonly selectedCategory = signal<string>('');

    // ── Del servicio ───────────────────────────────────────────────────────────
    readonly transactions = computed(() => this.txService.transactions());
    readonly isLoading    = computed(() => this.txService.isLoading());
    readonly totalIncome  = computed(() => this.txService.totalIncome());
    readonly totalExpense = computed(() => this.txService.totalExpense());
    readonly balance      = computed(() => this.txService.balance());

    readonly weddingPendingLoading  = signal(false);
    readonly weddingPendingExpenses = signal<WeddingPendingExpense[]>([]);
    readonly weddingPendingCount    = computed(() => this.weddingPendingExpenses().length);

    // ── Helpers de UI ──────────────────────────────────────────────────────────
    readonly MONTHS         = MONTHS_ES;
    readonly YEARS          = this.buildYears();
    readonly ALL_CATEGORIES = ALL_TX_CATEGORIES;
    readonly TransactionType = TransactionType;

    async ngOnInit(): Promise<void> {
        await Promise.all([
            this.accountService.loadAccounts(),
            this.reload(),
            this.loadWeddingPending(),
        ]);
    }

    async reload(): Promise<void> {
        const filters: TransactionFilters = {
            year:     this.selectedYear(),
            month:    this.selectedMonth(),
            type:     this.selectedType(),
            category: this.selectedCategory() ? this.selectedCategory() as CategoryType : null,
        };
        await this.txService.loadTransactions(filters);
    }

    selectType(type: TransactionType | null): void {
        this.selectedType.set(type);
        void this.reload();
    }

    async onFilterChange(): Promise<void> {
        await this.reload();
    }

    async delete(tx: Transaction): Promise<void> {
        const confirmed = await this.confirmDialog.confirm({
            title:        'Eliminar transacción',
            message:      `¿Eliminar "${tx.concept}" por ${tx.amount.toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })}? Esta acción no se puede deshacer.`,
            type:         'danger',
            confirmLabel: 'Eliminar',
            cancelLabel:  'Cancelar',
        });
        if (!confirmed) return;
        await this.txService.deleteTransaction(tx.id);
    }

    getCategoryMeta(category: string): { icon: string; color: string } {
        return TX_CATEGORY_META[category] ?? { icon: '📦', color: 'bg-gray-100 text-gray-800' };
    }

    formatDate(dateStr: string): string {
        const d = new Date(dateStr + 'T12:00:00');
        return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
    }

    getAccountName(tx: Transaction): string {
        return (tx as unknown as { account?: { name: string } }).account?.name ?? 'Sin cuenta';
    }

    getAccountSlug(tx: Transaction): string {
        return (tx as unknown as { account?: { bank_slug?: string } }).account?.bank_slug ?? '';
    }

    getAccountId(tx: Transaction): string {
        return (tx as unknown as { account_id?: string }).account_id ?? '';
    }

    getEditRoute(tx: Transaction): string[] {
        const type = tx.type === TransactionType.Income ? 'income' : 'expense';
        return ['/transactions', type, tx.id, 'edit'];
    }

    async loadWeddingPending(): Promise<void> {
        this.weddingPendingLoading.set(true);
        try {
            const { data: budgets, error: budgetError } = await this.supabase.client
                .from('wedding_budgets')
                .select('id, status, event_date')
                .in('status', ['planning', 'in_progress'])
                .order('event_date', { ascending: true })
                .limit(1);

            if (budgetError) throw budgetError;

            const budgetId = (budgets ?? [])[0]?.id as string | undefined;
            if (!budgetId) {
                this.weddingPendingExpenses.set([]);
                return;
            }

            const { data: expenses, error: expenseError } = await this.supabase.client
                .from('wedding_expenses')
                .select('id, provider_name, amount, paid_amount, due_date, status')
                .eq('wedding_budget_id', budgetId)
                .in('status', ['pending', 'partial']);

            if (expenseError) throw expenseError;

            const normalized = ((expenses ?? []) as Array<Record<string, unknown>>)
                .map((row) => {
                    const amount = Number((row as any).amount ?? 0);
                    const paid   = Number((row as any).paid_amount ?? 0);
                    return {
                        id:            String((row as any).id),
                        provider_name: String((row as any).provider_name ?? ''),
                        remaining:     Math.max(0, amount - paid),
                        due_date:      ((row as any).due_date ?? null) as string | null,
                        status:        String((row as any).status ?? ''),
                    } satisfies WeddingPendingExpense;
                })
                .sort((a, b) => {
                    const ad = a.due_date ? new Date(a.due_date).getTime() : Number.POSITIVE_INFINITY;
                    const bd = b.due_date ? new Date(b.due_date).getTime() : Number.POSITIVE_INFINITY;
                    return ad - bd;
                })
                .slice(0, 5);

            this.weddingPendingExpenses.set(normalized);
        } catch (err) {
            console.error('[TransactionList] Error cargando pendientes de boda:', err);
            this.weddingPendingExpenses.set([]);
        } finally {
            this.weddingPendingLoading.set(false);
        }
    }

    private buildYears(): number[] {
        const cur = new Date().getFullYear();
        return [cur - 1, cur, cur + 1];
    }
}
