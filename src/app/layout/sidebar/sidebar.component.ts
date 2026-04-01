import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule, NgSwitch, NgSwitchCase, NgSwitchDefault } from '@angular/common';
import { NavigationEnd, Router, RouterModule } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map } from 'rxjs/operators';
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
  `]
})
export class SidebarComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  readonly supabase = inject(SupabaseService);

  isOpen = signal(false);
  userProfile = signal<Profile | null>(null);

  private readonly routerUrl = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map(event => event.urlAfterRedirects)
    ),
    { initialValue: this.router.url }
  );

  currentRoute = computed(() => this.routerUrl());

  isAdmin   = computed(() => this.supabase.userRole() === AppRole.SuperAdmin);
  isPartner = computed(() => this.supabase.userRole() === AppRole.Partner);
  isUser    = computed(() => this.supabase.userRole() === AppRole.User);
  canSeeFinance = computed(() => this.isAdmin() || this.isPartner());

  roleLabel = computed(() => {
    const r = this.supabase.userRole();
    if (r === AppRole.SuperAdmin) return 'Admin';
    if (r === AppRole.Partner)    return 'Pareja';
    return 'Usuario';
  });

  userInitial = computed(() =>
    (this.userProfile()?.full_name?.charAt(0) ?? 'U').toUpperCase()
  );

  // ── Nav items ──────────────────────────────────
  mainNavItems = signal<NavItem[]>([
    { path: '/dashboard',    label: 'Dashboard',       icon: 'dashboard', exact: true },
    { path: '/transactions', label: 'Transacciones',   icon: 'transactions' },
  ]);

  financeNavItems = signal<NavItem[]>([
    { path: '/accounts',  label: 'Mis Cuentas',       icon: 'accounts' },
    { path: '/scheduled', label: 'Pagos Programados', icon: 'scheduled' },
    { path: '/debts',     label: 'Mis Deudas',        icon: 'debts' },
    { path: '/wedding',   label: 'Matrimonio',      icon: 'wedding' },
    { path: '/import',    label: 'Importar Excel',    icon: 'import' },
  ]);

  adminNavItems = signal<NavItem[]>([
    { path: '/admin/users', label: 'Usuarios',   icon: 'users' },
    { path: '/admin/audit', label: 'Auditoría',  icon: 'audit' },
  ]);

  bottomNavItems = signal<NavItem[]>([
    { path: '/dashboard',    label: 'Inicio',   icon: 'dashboard' },
    { path: '/transactions', label: 'Gastos',   icon: 'transactions' },
    { path: '/wedding',      label: 'Boda',     icon: 'wedding' },
    { path: '/accounts',     label: 'Cuentas',  icon: 'accounts' },
    { path: '/scheduled',    label: 'Pagos',    icon: 'scheduled' },
  ]);

  async ngOnInit(): Promise<void> {
    await this.loadUserProfile();
  }

  async loadUserProfile(): Promise<void> {
    const userId = this.supabase.currentUser()?.id;
    if (!userId) { this.userProfile.set(null); return; }
    try {
      const { data, error } = await this.supabase.client
        .from('profiles').select('*').eq('id', userId).single();
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

  closeSidebar():  void { this.isOpen.set(false); }
  toggleSidebar(): void { this.isOpen.update(v => !v); }

  isActive(path: string): boolean {
    const route = this.currentRoute();
    if (!route) return false;
    return route === path || route.startsWith(path + '/');
  }

  async logout(): Promise<void> {
    await this.authService.signOut();
  }
}

