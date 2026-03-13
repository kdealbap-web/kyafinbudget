/** Tipo de transacción */
export enum TransactionType {
    Income = 'income',
    Expense = 'expense',
}

/** Categorías reales del negocio */
export enum CategoryType {
    Rent = 'Arriendo',
    Utilities = 'Servicios',
    Food = 'Alimentación',
    Transport = 'Transporte',
    Health = 'Salud',
    Entertainment = 'Entretenimiento',
    Education = 'Educación',
    Other = 'Otros',
}

/** Íconos asociados a cada categoría (Heroicons / emoji) */
export const CATEGORY_ICONS: Record<CategoryType, string> = {
    [CategoryType.Rent]: '🏠',
    [CategoryType.Utilities]: '💡',
    [CategoryType.Food]: '🍽️',
    [CategoryType.Transport]: '🚗',
    [CategoryType.Health]: '🏥',
    [CategoryType.Entertainment]: '🎬',
    [CategoryType.Education]: '📚',
    [CategoryType.Other]: '📦',
};

/** Colores Tailwind para badges de categoría */
export const CATEGORY_COLORS: Record<CategoryType, string> = {
    [CategoryType.Rent]: 'bg-purple-100 text-purple-800',
    [CategoryType.Utilities]: 'bg-yellow-100 text-yellow-800',
    [CategoryType.Food]: 'bg-green-100 text-green-800',
    [CategoryType.Transport]: 'bg-blue-100 text-blue-800',
    [CategoryType.Health]: 'bg-red-100 text-red-800',
    [CategoryType.Entertainment]: 'bg-pink-100 text-pink-800',
    [CategoryType.Education]: 'bg-indigo-100 text-indigo-800',
    [CategoryType.Other]: 'bg-gray-100 text-gray-800',
};

/** Lista ordenada de todas las categorías */
export const ALL_CATEGORIES: CategoryType[] = Object.values(CategoryType);

/** Transacción financiera almacenada en la tabla `transactions` */
export interface Transaction {
    readonly id: string;
    portfolio_id: string;
    user_id: string;
    concept: string;
    amount: number;
    type: TransactionType;
    category: CategoryType;
    notes: string | null;
    receipt_url: string | null;
    date: string;
    is_scheduled: boolean;
    created_at?: string;
    updated_at?: string;
}

/** Filtros para consultar transacciones */
export interface TransactionFilters {
    type?: TransactionType;
    category?: CategoryType;
    portfolio_id?: string;
    date_from?: string;
    date_to?: string;
    search?: string;
    page?: number;
    page_size?: number;
}

/** Estadística de categoría para el dashboard */
export interface CategoryStat {
    category: CategoryType;
    total: number;
    percentage: number;
    count: number;
}
