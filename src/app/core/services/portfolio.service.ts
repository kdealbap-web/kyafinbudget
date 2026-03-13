import { Injectable, inject, signal } from '@angular/core';
import { Portfolio, PortfolioType } from '../../domain/models/portfolio.model';
import { SupabaseService } from './supabase.service';

const PORTFOLIOS_TABLE = 'portfolios';

@Injectable({ providedIn: 'root' })
export class PortfolioService {
    private readonly supabase = inject(SupabaseService);

    readonly portfolios = signal<Portfolio[]>([]);
    readonly isLoading = signal<boolean>(false);

    /**
     * Carga los portafolios visibles para el usuario autenticado.
     */
    async loadPortfolios(): Promise<void> {
        this.isLoading.set(true);
        try {
            const { data, error } = await this.supabase.client
                .from(PORTFOLIOS_TABLE)
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            this.portfolios.set((data ?? []) as unknown as Portfolio[]);
        } catch (err) {
            console.error('[PortfolioService] Error cargando portafolios:', err);
            this.portfolios.set([]);
        } finally {
            this.isLoading.set(false);
        }
    }

    /**
     * Crea un portafolio y actualiza el estado local.
     */
    async createPortfolio(
        name: string,
        type: PortfolioType,
        partnerId?: string
    ): Promise<Portfolio | null> {
        const userId = this.supabase.currentUser()?.id;
        if (!userId) return null;

        this.isLoading.set(true);
        try {
            const { data, error } = await this.supabase.client
                .from(PORTFOLIOS_TABLE)
                .insert({
                    name: name.trim(),
                    type,
                    owner_id: userId,
                    partner_id: partnerId ?? null,
                })
                .select('*')
                .single();

            if (error) throw error;

            const created = data as unknown as Portfolio;
            this.portfolios.update((current) => [created, ...current]);
            return created;
        } catch (err) {
            console.error('[PortfolioService] Error creando portafolio:', err);
            return null;
        } finally {
            this.isLoading.set(false);
        }
    }

    /**
     * Retorna los portafolios del tipo indicado.
     */
    getByType(type: PortfolioType): Portfolio[] {
        return this.portfolios().filter((portfolio) => portfolio.type === type);
    }
}
