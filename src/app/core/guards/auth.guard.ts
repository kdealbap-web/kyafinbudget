import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { SupabaseService } from '../services/supabase.service';

export const authGuard: CanActivateFn = async () => {
    const supabase = inject(SupabaseService);
    const router = inject(Router);

    const {
        data: { session },
    } = await supabase.client.auth.getSession();

    if (!session) {
        await router.navigate(['/auth/login']);
        return false;
    }

    const mfaPending = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('mfa_pending') : null;
    if (mfaPending === 'true') {
        await router.navigate(['/auth/mfa']);
        return false;
    }

    return true;
};
