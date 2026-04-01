export enum WeddingExpensePaymentMethod {
  Cash = 'cash',
  Transfer = 'transfer',
  Card = 'card',
  Check = 'check',
}

export interface WeddingExpensePayment {
  id: string;
  expense_id: string;
  amount: number;
  payment_method: WeddingExpensePaymentMethod;
  payment_date: string;
  reference_number?: string | null;
  notes?: string | null;
  created_at?: string;
  created_by: string;
}
