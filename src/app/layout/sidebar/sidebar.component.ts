import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule, NgSwitch, NgSwitchCase, NgSwitchDefault } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { SupabaseService } from '../../core/services/supabase.service';
import { AppRole, Profile } from '../../domain/models/profile.model';

interface NavItem {
  path: string;
  label: string;
  icon: string;
  exact?: boolean;
  badge?: string;
}

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterModule, NgSwitch, NgSwitchCase, NgSwitchDefault],
  templateUrl: './sidebar.component.html',
  styles: [`
    /* ── Nav item base ── */
    :host ::ng-deep .nav-item {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 9px 12px;
      border-radius: 10px;
      margin-bottom: 2px;
      font-size: 13.5px;
      font-weight: 500;
      color: #6B7280;
      transition: all 0.15s ease;
      text-decoration: none;
      position: relative;
    }

    :host-context(.dark) ::ng-deep .nav-item {
      color: #9CA3AF;
    }

    :host ::ng-deep .nav-item:hover {
      background-color: #F9FAFB;
      color: #111827;
    }

    :host-context(.dark) ::ng-deep .nav-item:hover {
      background-color: #111827;
      color: #F9FAFB;
    }

    /* Estado activo con borde izquierdo */
    :host ::ng-deep .nav-item.active-nav-item {
      background-color: #EFF6FF;
      color: #1D4ED8;
      font-weight: 600;
    }

    :host ::ng-deep .nav-item.active-nav-item::before {
      content: '';
      position: absolute;
      left: 0;
      top: 50%;
      transform: translateY(-50%);
      width: 3px;
      height: 20px;
      background: linear-gradient(180deg, #3B82F6, #1D4ED8);
      border-radius: 0 3px 3px 0;
    }

    :host-context(.dark) ::ng-deep .nav-item.active-nav-item {
      background-color: rgba(29, 78, 216, 0.15);
      color: #93C5FD;
    }

    :host-context(.dark) ::ng-deep .nav-item.active-nav-item::before {
      background: linear-gradient(180deg, #60A5FA, #3B82F6);
    }

    /* Iconos nav */
    :host ::ng-deep .nav-icon {
      width: 18px;
      height: 18px;
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    :host ::ng-deep .nav-icon svg {
      width: 18px;
      height: 18px;
    }

    :host ::ng-deep .nav-label {
      flex: 1;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    /* ── Bottom nav ── */
    :host ::ng-deep .bottom-nav-item {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 3px;
      padding: 4px 12px;
      border-radius: 10px;
      color: #9CA3AF;
      text-decoration: none;
      transition: all 0.15s ease;
      min-width: 56px;
    }

    :host-context(.dark) ::ng-deep .bottom-nav-item {
      color: #6B7280;
    }

    :host ::ng-deep .bottom-nav-item.bottom-nav-active {
      color: #1D4ED8;
    }

    :host-context(.dark) ::ng-deep .bottom-nav-item.bottom-nav-active {
      color: #60A5FA;
    }

    :host ::ng-deep .bottom-nav-icon {
      width: 22px;
      height: 22px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    :host ::ng-deep .bottom-nav-icon svg {
      width: 22px;
      height: 22px;
    }

    :host ::ng-deep .bottom-nav-label {
      font-size: 10px;
      font-weight: 600;
      letter-spacing: 0.01em;
    }

    /* Scrollbar invisible en nav */
    :host ::ng-deep nav.scrollbar-none {
      scrollbar-width: none;
    }
    :host ::ng-deep nav.scrollbar-none::-webkit-scrollbar {
      display: none;
    }
  `],
})
export class SidebarComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly supabase = inject(SupabaseService);

  readonly isOpen = signal(false);
  readonly userProfile = signal<Profile | null>(null);

  readonly isAdmin = computed(() => this.supabase.userRole() === AppRole.SuperAdmin);
  readonly isPartner = computed(() => this.supabase.userRole() === AppRole.Partner);
  readonly isUser = computed(() => this.supabase.userRole() === AppRole.User);
  readonly canSeeFinance = computed(() => {
    const role = this.supabase.userRole();
    return role === AppRole.SuperAdmin || role === AppRole.Partner;
  });

  readonly roleLabel = computed(() => {
    const role = this.supabase.userRole();
    if (role === AppRole.SuperAdmin) return 'Admin';
    if (role === AppRole.Partner) return 'Pareja';
    return 'Usuario';
  });

  readonly userInitial = computed(() =>
    (this.userProfile()?.full_name?.charAt(0) ?? 'U').toUpperCase(),
  );

  readonly mainNavItems = signal<NavItem[]>([
    { path: '/dashboard', label: 'Dashboard', icon: 'dashboard', exact: true },
    { path: '/transactions', label: 'Transacciones', icon: 'transactions' },
  ]);

  readonly financeNavItems = signal<NavItem[]>([
    { path: '/accounts', label: 'Mis Cuentas', icon: 'accounts' },
    { path: '/scheduled', label: 'Pagos Programados', icon: 'scheduled' },
    { path: '/debts', label: 'Mis Deudas', icon: 'debts' },
    { path: '/wedding', label: 'Matrimonio', icon: 'wedding' },
    { path: '/import', label: 'Importar Excel', icon: 'import' },
  ]);

  readonly adminNavItems = signal<NavItem[]>([
    { path: '/admin/users', label: 'Usuarios', icon: 'users' },
    { path: '/admin/audit', label: 'Auditoría', icon: 'audit' },
  ]);

  readonly bottomNavItems = signal<NavItem[]>([
    { path: '/dashboard', label: 'Inicio', icon: 'dashboard' },
    { path: '/transactions', label: 'Gastos', icon: 'transactions' },
    { path: '/wedding', label: 'Boda', icon: 'wedding' },
    { path: '/accounts', label: 'Cuentas', icon: 'accounts' },
  ]);

  async ngOnInit(): Promise<void> {
    await this.loadUserProfile();
  }

  private async loadUserProfile(): Promise<void> {
    const userId = this.supabase.currentUser()?.id;
    if (!userId) {
      this.userProfile.set(null);
      return;
    }

    try {
      const { data, error } = await this.supabase.client
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) throw error;
      this.userProfile.set(data as Profile);
    } catch {
      this.userProfile.set(this.supabase.userProfile());
    }
  }

  canAccess(path: string): boolean {
    if (path.startsWith('/admin/')) return this.isAdmin();
    if (['/import', '/scheduled', '/debts', '/wedding'].includes(path)) return this.canSeeFinance();
    return true;
  }

  closeSidebar(): void {
    this.isOpen.set(false);
  }

  toggleSidebar(): void {
    this.isOpen.update((v) => !v);
  }

  async logout(): Promise<void> {
    await this.authService.signOut();
  }
}


