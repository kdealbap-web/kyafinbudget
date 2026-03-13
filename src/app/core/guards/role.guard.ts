import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { SupabaseService } from '../services/supabase.service';
import { AppRole } from '../../domain/models/profile.model';

/**
 * Factory que retorna un guard funcional para roles específicos.
 * Redirige al dashboard si el usuario no tiene el rol requerido.
 *
 * @param roles Roles permitidos para acceder a la ruta
 * @example canActivate: [authGuard, roleGuard(AppRole.SuperAdmin)]
 */
export function roleGuard(...roles: AppRole[]): CanActivateFn {
    return async () => {
        const supabase = inject(SupabaseService);
        const router = inject(Router);

        const profile = supabase.userProfile();

        if (!profile) {
            router.navigate(['/auth/login']);
            return false;
        }

        if (!roles.includes(profile.role)) {
            router.navigate(['/dashboard']);
            return false;
        }

        return true;
    };
}
