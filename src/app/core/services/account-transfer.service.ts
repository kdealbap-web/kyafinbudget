import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { ProgressBarService } from '../../shared/services/progress-bar.service';
import { ToastService } from '../../shared/services/toast.service';

export interface CreateAccountTransferPayload {
  from_account: string;
  to_account: string;
  amount: number;
  description?: string | null;
  date: string;
}

@Injectable({ providedIn: 'root' })
export class AccountTransferService {
  private readonly supabase = inject(SupabaseService);
  private readonly progressBar = inject(ProgressBarService);
  private readonly toast = inject(ToastService);

  async createTransfer(payload: CreateAccountTransferPayload): Promise<boolean> {
    const userId = this.supabase.currentUser()?.id;
    if (!userId) return false;

    this.progressBar.start();
    try {
      const { error } = await this.supabase.client
        .from('account_transfers')
        .insert({
          user_id: userId,
          from_account: payload.from_account,
          to_account: payload.to_account,
          amount: Number(payload.amount ?? 0),
          description: payload.description?.trim() || null,
          date: payload.date,
        });

      if (error) throw error;

      this.progressBar.complete();
      this.toast.success('Traslado realizado');
      return true;
    } catch (err) {
      console.error('[AccountTransferService] Error creando traslado:', err);
      this.progressBar.error();
      this.toast.error('Error al realizar el traslado');
      return false;
    }
  }
}
