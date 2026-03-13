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

  // ── Estado ────────────────────────────────────────────────────────────────
  readonly allUsers = signal<Profile[]>([]);
  readonly searchQuery = signal('');
  readonly isLoading = signal(false);
  // ── Crear usuario (solo superadmin) ───────────────────────────────────────
  readonly isCreateOpen = signal(false);
  readonly isCreating = signal(false);
  readonly newUserFullName = signal('');
  readonly newUserEmail = signal('');
  readonly newUserRole = signal<AppRole>(AppRole.User);
  readonly newUserPartnerId = signal('');

  // ── Constantes de UI ──────────────────────────────────────────────────────
  readonly AppRole = AppRole;
  readonly allRoles = Object.values(AppRole);
  readonly getRoleLabel = getRoleLabel;

  // ── Filtro local por búsqueda ─────────────────────────────────────────────
  readonly users = computed(() => {
    const q = this.searchQuery().trim().toLowerCase();
    if (!q) return this.allUsers();
    return this.allUsers().filter(u =>
      u.full_name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q)
    );
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
    const newRole = (event.target as HTMLSelectElement).value as AppRole;
    if (newRole === user.role) return;

    const confirmed = await this.confirmDialog.confirm({
      title: 'Cambiar rol',
      message: `¿Cambiar el rol de "${user.full_name}" a ${getRoleLabel(newRole)}? Este cambio afecta sus permisos de acceso.`,
      type: 'warning',
      confirmLabel: 'Cambiar rol',
      cancelLabel: 'Cancelar',
    });

    if (!confirmed) {
      // Revertir el select visualmente
      (event.target as HTMLSelectElement).value = user.role;
      return;
    }

    this.progressBar.start();
    const old = { ...user };
    try {
      const { error } = await this.supabase.client
        .from('profiles')
        .update({ role: newRole })
        .eq('id', user.id);
      if (error) throw error;

      await this.audit.logAction('UPDATE', 'profiles', user.id,
        old as unknown as Record<string, unknown>, { role: newRole });

      this.allUsers.update(list =>
        list.map(u => u.id === user.id ? { ...u, role: newRole } : u)
      );
      this.toast.success(`Rol actualizado a ${getRoleLabel(newRole)}.`);
      this.progressBar.complete();
    } catch {
      this.progressBar.error();
      this.toast.error('Error al cambiar el rol.');
      (event.target as HTMLSelectElement).value = user.role;
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
    try {
      const { error } = await this.supabase.client
        .from('profiles')
        .update({ is_active: !user.is_active })
        .eq('id', user.id);
      if (error) throw error;

      this.allUsers.update(list =>
        list.map(u => u.id === user.id ? { ...u, is_active: !u.is_active } : u)
      );
      this.toast.success(user.is_active ? 'Usuario desactivado.' : 'Usuario activado.');
      this.progressBar.complete();
    } catch {
      this.progressBar.error();
      this.toast.error('Error al cambiar el estado del usuario.');
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
      const { data, error } = await this.supabase.client.functions.invoke('admin-create-user', {
        body: {
          email,
          full_name: fullName,
          role,
          partner_id: role === AppRole.Partner ? (partnerId || null) : null,
        },
      });

      if (error) throw error;

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
      const message = e?.message ? String(e.message) : 'No se pudo crear el usuario.';
      this.toast.error(message);
    } finally {
      this.isCreating.set(false);
    }
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



