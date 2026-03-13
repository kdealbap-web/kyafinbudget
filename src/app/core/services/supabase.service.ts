import { Injectable, signal, computed } from '@angular/core';
import { createClient, SupabaseClient, User, Session } from '@supabase/supabase-js';
import { environment } from '../../../enviroments/enviroment';
import { Profile, AppRole } from '../../domain/models/profile.model';

@Injectable({ providedIn: 'root' })
export class SupabaseService {
    readonly client: SupabaseClient = createClient(
        environment.supabaseUrl,
        environment.supabaseAnonKey
    );

    // ─── Signals de estado global ─────────────────────────────────────
    readonly currentUser = signal<User | null>(null);
    readonly userProfile = signal<Profile | null>(null);
    readonly isLoading = signal<boolean>(false);

    readonly userRole = computed<AppRole | null>(
        () => this.userProfile()?.role ?? null
    );

    readonly isAuthenticated = computed<boolean>(
        () => this.currentUser() !== null
    );

    constructor() {
        this.initAuthListener();
    }

    // ─── Suscripción a cambios de sesión ──────────────────────────────
    private initAuthListener(): void {
        this.client.auth.getSession().then(({ data }) => {
            this.currentUser.set(data.session?.user ?? null);
            if (data.session?.user) {
                this.loadProfile(data.session.user.id);
            }
        });

        this.client.auth.onAuthStateChange((_event, session) => {
            this.currentUser.set(session?.user ?? null);
            if (session?.user) {
                this.loadProfile(session.user.id);
            } else {
                this.userProfile.set(null);
            }
        });
    }

    // ─── Carga el perfil del usuario logueado ─────────────────────────
    private async loadProfile(userId: string): Promise<void> {
        try {
            const { data, error } = await this.client
                .from('profiles')
                .select('*')
                .eq('id', userId)
                .single();

            if (error) throw error;
            this.userProfile.set(data as Profile);
        } catch {
            this.userProfile.set(null);
        }
    }

    // ─── CRUD Genéricos ───────────────────────────────────────────────

    /**
     * Selecciona registros de una tabla con filtros opcionales.
     * @param table Nombre de la tabla
     * @param query Función para encadenar filtros de Supabase
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async select<T>(table: string, query?: (q: any) => any): Promise<T[]> {
        this.isLoading.set(true);
        try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            let q: any = this.client.from(table).select('*');
            if (query) q = query(q);
            const { data, error } = await q;
            if (error) throw error;
            return (data ?? []) as T[];
        } finally {
            this.isLoading.set(false);
        }
    }

    /**
     * Inserta uno o varios registros en una tabla.
     */
    async insert<T>(table: string, records: Partial<T> | Partial<T>[]): Promise<T[]> {
        this.isLoading.set(true);
        try {
            const { data, error } = await this.client
                .from(table)
                .insert(records as never)
                .select();
            if (error) throw error;
            return (data ?? []) as T[];
        } finally {
            this.isLoading.set(false);
        }
    }

    /**
     * Actualiza registros que coincidan con un filtro.
     */
    async update<T>(
        table: string,
        id: string,
        changes: Partial<T>
    ): Promise<T | null> {
        this.isLoading.set(true);
        try {
            const { data, error } = await this.client
                .from(table)
                .update(changes as never)
                .eq('id', id)
                .select()
                .single();
            if (error) throw error;
            return data as T;
        } finally {
            this.isLoading.set(false);
        }
    }

    /**
     * Elimina un registro por su ID.
     */
    async delete(table: string, id: string): Promise<void> {
        this.isLoading.set(true);
        try {
            const { error } = await this.client
                .from(table)
                .delete()
                .eq('id', id);
            if (error) throw error;
        } finally {
            this.isLoading.set(false);
        }
    }

    // ─── Storage ──────────────────────────────────────────────────────

    /**
     * Sube un recibo (imagen) al bucket de Supabase Storage.
     * @returns URL pública del archivo subido
     */
    async uploadReceipt(file: File, userId: string): Promise<string> {
        const ext = file.name.split('.').pop() ?? 'jpg';
        const fileName = `${userId}/${Date.now()}.${ext}`;

        const { error } = await this.client.storage
            .from('receipts')
            .upload(fileName, file, { upsert: false });

        if (error) throw new Error(`Error al subir recibo: ${error.message}`);

        const { data } = this.client.storage
            .from('receipts')
            .getPublicUrl(fileName);

        return data.publicUrl;
    }

    /** Retorna la sesión activa actual */
    async getSession(): Promise<Session | null> {
        const { data } = await this.client.auth.getSession();
        return data.session;
    }

    /** Fuerza la recarga del perfil y retorna el rol actual */
    async loadUserRole(userId: string): Promise<AppRole | null> {
        await this.loadProfile(userId);
        return this.userRole();
    }
}

