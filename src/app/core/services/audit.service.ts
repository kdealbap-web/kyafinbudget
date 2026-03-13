import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';

export type AuditAction = 'INSERT' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'LOGOUT' | 'IMPORT';

/** Registra acciones del usuario en la tabla `audit_logs` */
@Injectable({ providedIn: 'root' })
export class AuditService {
    private readonly supabase = inject(SupabaseService);

    /**
     * Registra una acción de auditoría en la base de datos.
     * @param action Tipo de acción realizada
     * @param tableName Tabla afectada
     * @param recordId ID del registro afectado
     * @param oldData Datos anteriores (para UPDATE/DELETE)
     * @param newData Datos nuevos (para INSERT/UPDATE)
     */
    async logAction(
        action: AuditAction,
        tableName: string,
        recordId: string,
        oldData?: Record<string, unknown>,
        newData?: Record<string, unknown>
    ): Promise<void> {
        const userId = this.supabase.currentUser()?.id;
        if (!userId) return;

        try {
            await this.supabase.client.from('audit_logs').insert({
                user_id: userId,
                action,
                table_name: tableName,
                record_id: recordId,
                old_data: oldData ?? null,
                new_data: newData ?? null,
            });
        } catch (err) {
            // No interrumpir la operación principal si el log falla
            console.warn('[AuditService] Failed to log action:', err);
        }
    }
}
