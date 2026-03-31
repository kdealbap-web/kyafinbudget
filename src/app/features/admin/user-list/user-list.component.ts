import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { SupabaseService } from '../../../core/services/supabase.service';
import { AuditService } from '../../../core/services/audit.service';
import { ToastService } from '../../../shared/services/toast.service';
import { ProgressBarService } from '../../../shared/services/progress-bar.service';
import { ConfirmDialogService } from '../../../shared/services/confirm-dialog.service';
import { Profile, AppRole, getRoleLabel } from '../../../domain/models/profile.model';

@Component({
  selector: 'app-user-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule],
  templateUrl: './user-list.component.html',
})
export class UserListComponent implements OnInit {
  private readonly supabase = inject(SupabaseService);
  private readonly audit = inject(AuditService);
  private readonly toast = inject(ToastService);
  private readonly progressBar = inject(ProgressBarService);
  private readonly confirmDialog = inject(ConfirmDialogService);
  private readonly router = inject(Router);

  // ── Estado ────────────────────────────────────────────────────────────────
  readonly allUsers = signal<Profile[]>([]);
  readonly searchQuery = signal('');
  readonly roleFilter = signal<AppRole | 'all'>('all');
  readonly isLoading = signal(false);
  // ── Crear usuario (solo superadmin) ───────────────────────────────────────
  readonly isCreateOpen = signal(false);
  readonly isCreating = signal(false);
  readonly newUserFullName = signal('');
  readonly newUserEmail = signal('');
  readonly newUserRole = signal<AppRole>(AppRole.User);
  readonly newUserPartnerId = signal('');
  // ── Cambio a Partner (partner_id) ───────────────────────────────────────
  readonly isPartnerRoleOpen = signal(false);
  readonly partnerRoleUser = signal<Profile | null>(null);
  readonly partnerRolePartnerId = signal('');
  readonly isPartnerRoleSaving = signal(false);

  // ── Constantes de UI ──────────────────────────────────────────────────────
  readonly AppRole = AppRole;
  readonly allRoles = Object.values(AppRole);
  readonly getRoleLabel = getRoleLabel;

  // ── Filtro local por búsqueda ─────────────────────────────────────────────
  readonly users = computed(() => {
    const q = this.searchQuery().trim().toLowerCase();
    const role = this.roleFilter();

    return this.allUsers().filter(u => {
      const matchesQuery = !q
        || u.full_name.toLowerCase().includes(q)
        || u.email.toLowerCase().includes(q);
      const matchesRole = role === 'all' || u.role === role;
      return matchesQuery && matchesRole;
    });
  });


  // ── Stats ─────────────────────────────────────────────────────────────────
  readonly statsTotal = computed(() => this.allUsers().length);
  readonly statsActive = computed(() => this.allUsers().filter(u => u.is_active).length);
  readonly statsByRole = computed(() => {
    const counts: Record<AppRole, number> = {
      [AppRole.SuperAdmin]: 0,
      [AppRole.Partner]: 0,
      [AppRole.User]: 0,
    };
    this.allUsers().forEach(u => counts[u.role]++);
    return counts;
  });

  // ── Carga ─────────────────────────────────────────────────────────────────
  async ngOnInit(): Promise<void> {
    await this.loadUsers();
  }

  async loadUsers(): Promise<void> {
    this.progressBar.start();
    this.isLoading.set(true);
    try {
      // Usamos profiles_admin_view que bypasea la RLS de user-only
      // Si la vista no existe, fallback a profiles (superadmin ve todo via policy)
      const { data, error } = await this.supabase.client
        .from('profiles')
        .select('*')
        .order('full_name');

      if (error) throw error;

      this.allUsers.set((data ?? []) as Profile[]);
      this.progressBar.complete();
    } catch {
      this.progressBar.error();
      this.toast.error('Error al cargar los usuarios.');
    } finally {
      this.isLoading.set(false);
    }
  }

  // ── Cambiar rol ───────────────────────────────────────────────────────────
  async changeRole(user: Profile, event: Event): Promise<void> {
    const selectEl = event.target as HTMLSelectElement;
    const newRole = selectEl.value as AppRole;
    if (newRole === user.role) return;

    if (newRole === AppRole.Partner && !user.partner_id) {
      this.openPartnerRoleModal(user);
      // Revertir el select hasta que se complete la asignación
      selectEl.value = user.role;
      return;
    }

    const confirmed = await this.confirmDialog.confirm({
      title: 'Cambiar rol',
      message: `¿Cambiar el rol de "${user.full_name}" a ${getRoleLabel(newRole)}? Este cambio afecta sus permisos de acceso.`,
      type: 'warning',
      confirmLabel: 'Cambiar rol',
      cancelLabel: 'Cancelar',
    });

    if (!confirmed) {
      selectEl.value = user.role;
      return;
    }

    this.progressBar.start();
    const old = { ...user };
    try {
      const updated = await this.adminUpdateUser({
        id: user.id,
        role: newRole,
        partner_id: newRole === AppRole.Partner ? (user.partner_id ?? null) : null,
      });

      await this.audit.logAction('UPDATE', 'profiles', user.id,
        old as unknown as Record<string, unknown>, { role: updated.role, partner_id: updated.partner_id });

      this.allUsers.update(list =>
        list.map(u => u.id === user.id ? updated : u)
      );
      this.toast.success(`Rol actualizado a ${getRoleLabel(updated.role)}.`);
      this.progressBar.complete();
    } catch (e: any) {
      this.progressBar.error();
      const msg = e?.message ? String(e.message) : '';
      this.toast.error(msg ? `No se pudo cambiar el rol: ${msg}` : 'Error al cambiar el rol.');
      selectEl.value = user.role;
    }
  }
  // ── Toggle activo/inactivo ────────────────────────────────────────────────
  async toggleActive(user: Profile): Promise<void> {
    const action = user.is_active ? 'desactivar' : 'activar';
    const confirmed = await this.confirmDialog.confirm({
      title: user.is_active ? 'Desactivar usuario' : 'Activar usuario',
      message: `¿Deseas ${action} a "${user.full_name}"?`,
      type: user.is_active ? 'danger' : 'warning',
      confirmLabel: user.is_active ? 'Desactivar' : 'Activar',
      cancelLabel: 'Cancelar',
    });
    if (!confirmed) return;

    this.progressBar.start();
    const old = { ...user };
    try {
      const updated = await this.adminUpdateUser({
        id: user.id,
        is_active: !user.is_active,
      });

      await this.audit.logAction('UPDATE', 'profiles', user.id,
        old as unknown as Record<string, unknown>, { is_active: updated.is_active });

      this.allUsers.update(list =>
        list.map(u => u.id === user.id ? updated : u)
      );
      this.toast.success(updated.is_active ? 'Usuario activado.' : 'Usuario desactivado.');
      this.progressBar.complete();
    } catch (e: any) {
      this.progressBar.error();
      const msg = e?.message ? String(e.message) : '';
      this.toast.error(msg ? `No se pudo cambiar el estado: ${msg}` : 'Error al cambiar el estado del usuario.');
    }
  }
  openCreateModal(): void {
    this.newUserFullName.set('');
    this.newUserEmail.set('');
    this.newUserRole.set(AppRole.User);
    this.newUserPartnerId.set('');
    this.isCreateOpen.set(true);
  }

  closeCreateModal(): void {
    this.isCreateOpen.set(false);
  }

  async createUser(): Promise<void> {
    const fullName = this.newUserFullName().trim();
    const email = this.newUserEmail().trim().toLowerCase();
    const role = this.newUserRole();
    const partnerId = this.newUserPartnerId().trim();

    if (this.isCreating()) return;
    if (!fullName || fullName.length < 2) {
      this.toast.error('Ingresa el nombre completo del usuario.');
      return;
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      this.toast.error('Ingresa un correo válido.');
      return;
    }

    const confirmed = await this.confirmDialog.confirm({
      title: 'Crear usuario',
      message: `Se enviará una invitación a ${email} para activar su cuenta.`,
      type: 'info',
      confirmLabel: 'Crear usuario',
      cancelLabel: 'Cancelar',
    });

    if (!confirmed) return;

    this.isCreating.set(true);
    this.progressBar.start();

    try {
      const isInvalidJwt = (err: any): boolean => {
        const msg = String(err?.message ?? '').toLowerCase();
        const status = err?.context?.status ?? err?.status;
        return status === 401 || msg.includes('invalid jwt');
      };

      const { data: sessionData, error: sessionError } = await this.supabase.client.auth.getSession();
      if (sessionError) throw sessionError;
      if (!sessionData.session?.access_token) {
        throw new Error('Tu sesión expiró. Inicia sesión de nuevo.');
      }

      const accessToken = sessionData.session.access_token;
      if (!accessToken || !accessToken.startsWith('eyJ')) {
        throw new Error('Sesión inválida. Inicia sesión de nuevo.');
      }

      const functions = this.supabase.client.functions;
      functions.setAuth(accessToken);

      const invokeCreate = async () => {
        const { data, error } = await functions.invoke('admin-create-user', {
          body: {
            email,
            full_name: fullName,
            role,
            partner_id: role === AppRole.Partner ? (partnerId || null) : null,
          },
        });
        if (error) throw error;
        return data;
      };

      let data: any;
      try {
        data = await invokeCreate();
      } catch (err: any) {
        if (!isInvalidJwt(err)) throw err;

        // Reintento único: refresca sesión y vuelve a invocar
        const { data: retrySession, error: retryError } = await this.supabase.client.auth.refreshSession();
        if (retryError) throw err;
        const retryToken = retrySession.session?.access_token ?? '';
        if (!retryToken) throw err;
        functions.setAuth(retryToken);
        data = await invokeCreate();
      }


      const createdId = (data as { id?: string } | null)?.id ?? '';
      await this.audit.logAction('INSERT', 'profiles', createdId || email, undefined, {
        full_name: fullName,
        email,
        role,
        partner_id: role === AppRole.Partner ? (partnerId || null) : null,
      });

      this.toast.success('Usuario creado. Se envió la invitación por correo.');
      this.progressBar.complete();
      this.closeCreateModal();
      await this.loadUsers();
    } catch (e: any) {
      this.progressBar.error();
      const rawMessage = e?.message ? String(e.message) : '';
      const status = e?.context?.status ?? e?.status;
      const isInvalidJwt = status === 401 || rawMessage.toLowerCase().includes('invalid jwt');
      if (isInvalidJwt) {
        const goToLogin = await this.confirmDialog.confirm({
          title: 'Sesión expirada',
          message: 'Tu sesión ya no es válida. ¿Quieres iniciar sesión de nuevo?',
          type: 'warning',
          confirmLabel: 'Ir al inicio de sesión',
          cancelLabel: 'Cancelar',
        });

        if (goToLogin) {
          await this.supabase.client.auth.signOut();
          this.router.navigate(['/auth/login']);
        }
      }
      const message = isInvalidJwt
        ? 'Tu sesión expiró o no es válida. Inicia sesión de nuevo.'
        : (rawMessage || 'No se pudo crear el usuario.');
      this.toast.error(message);
    } finally {
      this.isCreating.set(false);
    }
  }

  openPartnerRoleModal(user: Profile): void {
    this.partnerRoleUser.set(user);
    this.partnerRolePartnerId.set(user.partner_id ?? '');
    this.isPartnerRoleOpen.set(true);
  }

  closePartnerRoleModal(): void {
    this.isPartnerRoleOpen.set(false);
    this.partnerRoleUser.set(null);
    this.partnerRolePartnerId.set('');
  }

  async savePartnerRole(): Promise<void> {
    const user = this.partnerRoleUser();
    if (!user) return;
    if (this.isPartnerRoleSaving()) return;

    const partnerId = this.partnerRolePartnerId().trim();
    this.isPartnerRoleSaving.set(true);
    this.progressBar.start();
    const old = { ...user };
    try {
      const isAlreadyPartner = user.role === AppRole.Partner;
      const updated = await this.adminUpdateUser(
        isAlreadyPartner
          ? { id: user.id, partner_id: partnerId || null }
          : { id: user.id, role: AppRole.Partner, partner_id: partnerId || null }
      );

      await this.audit.logAction('UPDATE', 'profiles', user.id,
        old as unknown as Record<string, unknown>,
        isAlreadyPartner
          ? { partner_id: updated.partner_id }
          : { role: updated.role, partner_id: updated.partner_id }
      );

      this.allUsers.update(list =>
        list.map(u => u.id === user.id ? updated : u)
      );
      this.toast.success(isAlreadyPartner ? 'Partner ID actualizado.' : 'Rol actualizado a Partner.');
      this.progressBar.complete();
      this.closePartnerRoleModal();
    } catch (e: any) {
      this.progressBar.error();
      const msg = e?.message ? String(e.message) : '';
      this.toast.error(msg ? `No se pudo actualizar: ${msg}` : 'No se pudo actualizar el usuario.');
    } finally {
      this.isPartnerRoleSaving.set(false);
    }
  }

  private isInvalidJwtError(err: any): boolean {
    const msg = String(err?.message ?? '').toLowerCase();
    const status = err?.context?.status ?? err?.status;
    return status === 401 || msg.includes('invalid jwt');
  }

  private async invokeAdminFunction<T>(name: string, body: Record<string, unknown>): Promise<T> {
    const { data: sessionData, error: sessionError } = await this.supabase.client.auth.getSession();
    if (sessionError) throw sessionError;
    const accessToken = sessionData.session?.access_token ?? '';
    if (!accessToken) throw new Error('Tu sesión expiró. Inicia sesión de nuevo.');

    const functions = this.supabase.client.functions;
    functions.setAuth(accessToken);

    const invoke = async (): Promise<T> => {
      const { data, error } = await functions.invoke(name, { body });
      if (error) throw error;
      return data as T;
    };

    try {
      return await invoke();
    } catch (err: any) {
      if (!this.isInvalidJwtError(err)) throw err;
      const { data: retrySession, error: retryError } = await this.supabase.client.auth.refreshSession();
      if (retryError) throw err;
      const retryToken = retrySession.session?.access_token ?? '';
      if (!retryToken) throw err;
      functions.setAuth(retryToken);
      return await invoke();
    }
  }

  private async adminUpdateUser(payload: { id: string; role?: AppRole; partner_id?: string | null; is_active?: boolean }): Promise<Profile> {
    const data = await this.invokeAdminFunction<{ profile?: Profile }>('admin-update-user', payload);
    const profile = (data as { profile?: Profile } | null)?.profile;
    if (!profile) throw new Error('Respuesta inválida del servidor.');
    return profile;
  }
  // ── Helpers de UI ─────────────────────────────────────────────────────────
  getInitials(name: string): string {
    return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
  }

  getRoleBadgeClass(role: AppRole): string {
    const map: Record<AppRole, string> = {
      [AppRole.SuperAdmin]: 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300',
      [AppRole.Partner]: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
      [AppRole.User]: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
    };
    return map[role] ?? map[AppRole.User];
  }

  getAvatarBg(role: AppRole): string {
    const map: Record<AppRole, string> = {
      [AppRole.SuperAdmin]: 'bg-purple-500',
      [AppRole.Partner]: 'bg-blue-500',
      [AppRole.User]: 'bg-gray-500',
    };
    return map[role] ?? 'bg-gray-500';
  }

  formatDate(dateStr?: string): string {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
  }
}

