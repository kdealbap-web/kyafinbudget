export enum DebtType {
  Personal = 'personal',
  Household = 'household',
  BankLoan = 'bank_loan',
  CreditCard = 'credit_card'
}

export enum DebtStatus {
  Active = 'active',
  Paid = 'paid',
  Overdue = 'overdue'
}

export interface Debt {
  id: string;
  user_id: string;
  portfolio_id?: string | null;
  name: string;
  description?: string | null;
  type: DebtType;
  total_amount: number;
  paid_amount: number;
  remaining_amount: number;
  interest_rate: number;
  due_date?: string | null;
  status: DebtStatus;
  creditor?: string | null;
  account_id?: string | null;
  is_shared: boolean;
  created_at?: string;
  updated_at?: string;
  account?: {
    id: string;
    name: string;
    bank_slug?: string | null;
  } | null;
}
