export enum AccountType {
  Checking = 'checking',
  Savings = 'savings',
  Cash = 'cash',
  CreditCard = 'credit_card',
  Digital = 'digital'
}

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  [AccountType.Checking]: 'Cuenta Corriente',
  [AccountType.Savings]: 'Cuenta de Ahorros',
  [AccountType.Cash]: 'Efectivo',
  [AccountType.CreditCard]: 'Tarjeta de Credito',
  [AccountType.Digital]: 'Billetera Digital'
};

export const ACCOUNT_TYPE_ICONS: Record<AccountType, string> = {
  [AccountType.Checking]: '🏦',
  [AccountType.Savings]: '💰',
  [AccountType.Cash]: '💵',
  [AccountType.CreditCard]: '💳',
  [AccountType.Digital]: '📱'
};

export interface Account {
  id: string;
  user_id: string;
  name: string;
  type: AccountType;
  bank_name?: string | null;
  bank_slug?: string | null;
  balance: number;
  currency: string;
  color: string;
  icon: string;
  is_active: boolean;
  is_shared: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface BankCatalog {
  id: string;
  name: string;
  slug: string;
  logo_url?: string | null;
  color: string;
  country: string;
}
