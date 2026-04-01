import { WeddingExpenseCategory } from './wedding-expense-category.model';
import { WeddingExpensePayment } from './wedding-expense-payment.model';
import { WeddingExpenseAttachment } from './wedding-expense-attachment.model';

export enum WeddingExpenseStatus {
  Pending = 'pending',
  Partial = 'partial',
  Paid = 'paid',
  Cancelled = 'cancelled',
}

export interface WeddingExpense {
  id: string;
  wedding_budget_id: string;
  category_id: string;
  provider_name: string;
  description?: string | null;
  amount: number;
  paid_amount: number;
  remaining: number;
  status: WeddingExpenseStatus;
  notes?: string | null;
  website_url?: string | null;
  instagram_profile?: string | null;
  contact_phone?: string | null;
  contact_email?: string | null;
  due_date?: string | null;
  account_id?: string | null;
  created_at?: string;
  updated_at?: string;
  created_by: string;
  category?: WeddingExpenseCategory | null;
  payments?: WeddingExpensePayment[];
  attachments?: WeddingExpenseAttachment[];
}
