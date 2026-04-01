export enum WeddingBudgetStatus {
  Planning = 'planning',
  InProgress = 'in_progress',
  Completed = 'completed',
  Cancelled = 'cancelled',
}

export interface WeddingBudget {
  id: string;
  user_id: string;
  partner_id?: string | null;
  event_name: string;
  event_date: string;
  total_budget: number;
  total_spent: number;
  total_pending: number;
  remaining: number;
  status: WeddingBudgetStatus;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
}
