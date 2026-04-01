export interface WeddingExpenseCategory {
  id: string;
  name: string;
  description?: string | null;
  estimated_budget?: number | null;
  color?: string | null;
  icon?: string | null;
  sort_order?: number | null;
  created_at?: string;
}
