import { Injectable, computed, inject, signal } from '@angular/core';
import { Account, AccountType, BankCatalog } from '../../domain/models/account.model';
import { SupabaseService } from './supabase.service';

@Injectable({ providedIn: 'root' })
export class AccountService {
  private supabase = inject(SupabaseService);

  accounts = signal<Account[]>([]);
  bankCatalog = signal<BankCatalog[]>([]);
  isLoading = signal(false);

  totalBalance = computed(() =>
    this.accounts()
      .filter((a) => a.is_active && a.type !== AccountType.CreditCard)
      .reduce((sum, a) => sum + Number(a.balance), 0)
  );

  balanceByType = computed(() => {
    const result: Record<string, number> = {};
    this.accounts()
      .filter((a) => a.is_active)
      .forEach((a) => {
        result[a.type] = (result[a.type] ?? 0) + Number(a.balance);
      });
    return result;
  });

  async loadAccounts(): Promise<void> {
    this.isLoading.set(true);
    try {
      const { data, error } = await this.supabase.client
        .from('accounts')
        .select('*')
        .eq('is_active', true)
        .order('type');
      if (error) throw error;
      this.accounts.set((data ?? []) as Account[]);
    } catch (err) {
      console.error('Error cargando cuentas:', err);
      this.accounts.set([]);
    } finally {
      this.isLoading.set(false);
    }
  }

  async refreshAccounts(): Promise<void> {
    await this.loadAccounts();
  }

  async loadBankCatalog(): Promise<void> {
    try {
      const { data, error } = await this.supabase.client
        .from('bank_catalog')
        .select('id, name, slug, logo_url, color, country')
        .eq('country', 'CO')
        .order('name');
      if (error) throw error;
      this.bankCatalog.set((data ?? []) as BankCatalog[]);
    } catch (err) {
      console.error('Error cargando catalogo de bancos:', err);
      this.bankCatalog.set([]);
    }
  }

  async createAccount(
    payload: Omit<Account, 'id' | 'created_at' | 'updated_at'>
  ): Promise<Account | null> {
    try {
      const userId = this.supabase.currentUser()?.id;
      if (!userId) throw new Error('Sin autenticacion');
      const { data, error } = await this.supabase.client
        .from('accounts')
        .insert({ ...payload, user_id: userId })
        .select()
        .single();
      if (error) throw error;
      await this.loadAccounts();
      return data as Account;
    } catch (err) {
      console.error('Error creando cuenta:', err);
      return null;
    }
  }

  async deleteAccount(id: string): Promise<boolean> {
    try {
      const { error } = await this.supabase.client
        .from('accounts')
        .update({ is_active: false })
        .eq('id', id);
      if (error) throw error;
      await this.loadAccounts();
      return true;
    } catch (err) {
      console.error('Error eliminando cuenta:', err);
      return false;
    }
  }
}
