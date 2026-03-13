/** Roles disponibles en la aplicación */
export enum AppRole {
    SuperAdmin = 'superadmin',
    Partner = 'partner',
    User = 'user',
}

/** Perfil de usuario almacenado en la tabla `profiles` */
export interface Profile {
    readonly id: string;
    full_name: string;
    email: string;
    role: AppRole;
    partner_id: string | null;
    avatar_url: string | null;
    is_active: boolean;
    created_at?: string;
    updated_at?: string;
}

/** Verifica si el perfil tiene rol superadmin */
export function isAdmin(profile: Profile): boolean {
    return profile.role === AppRole.SuperAdmin;
}

/** Verifica si el perfil tiene rol partner o superior */
export function isPartnerOrAdmin(profile: Profile): boolean {
    return profile.role === AppRole.Partner || profile.role === AppRole.SuperAdmin;
}

/** Retorna el nombre de display del rol */
export function getRoleLabel(role: AppRole): string {
    const labels: Record<AppRole, string> = {
        [AppRole.SuperAdmin]: 'Super Admin',
        [AppRole.Partner]: 'Partner',
        [AppRole.User]: 'Usuario',
    };
    return labels[role];
}
