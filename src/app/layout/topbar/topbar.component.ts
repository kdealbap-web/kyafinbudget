import { DOCUMENT } from '@angular/common';
import {
  Component,
  EventEmitter,
  HostListener,
  OnInit,
  Output,
  computed,
  inject,
  signal,
} from '@angular/core';
import { NavigationEnd, Router, RouterModule } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map } from 'rxjs/operators';
import { SupabaseService } from '../../core/services/supabase.service';

// Mapa de rutas → nombre legible
const ROUTE_NAMES: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/transactions': 'Transacciones',
  '/transactions/new': 'Nueva Transacción',
  '/accounts': 'Mis Cuentas',
  '/scheduled': 'Pagos Programados',
  '/scheduled/new': 'Nuevo Pago',
  '/debts': 'Mis Deudas',
  '/wedding': 'Gastos de Boda',
  '/import': 'Importar Excel',
  '/admin/users': 'Usuarios',
  '/admin/audit': 'Auditoría',
  '/profile': 'Mi Perfil',
  '/settings': 'Configuración',
};

@Component({
  selector: 'app-topbar',
  standalone: true,
  imports: [RouterModule],
  templateUrl: './topbar.component.html',
})
export class TopbarComponent implements OnInit {
  private readonly document = inject(DOCUMENT);
  private readonly supabase = inject(SupabaseService);
  private readonly router = inject(Router);

  // Emite al layout para abrir el sidebar en mobile
  @Output() menuToggle = new EventEmitter<void>();

  readonly isDark = signal(false);
  readonly showUserMenu = signal(false);
  readonly notificationCount = signal<number>(0);
  readonly weddingPendingCount = signal<number>(0);

  readonly userProfile = computed(() => this.supabase.userProfile());

  private readonly routerUrl = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map((event) => event.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );

  readonly currentPathName = computed(() => {
    const url = this.routerUrl() ?? '/';
    // Buscar en mapa exacto primero
    const exact = ROUTE_NAMES[url];
    if (exact) return exact;
    // Buscar prefijo más largo
    const match = Object.keys(ROUTE_NAMES)
      .filter((k) => url.startsWith(k))
      .sort((a, b) => b.length - a.length)[0];
    if (match) return ROUTE_NAMES[match];
    // Fallback: capitalizar último segmento
    const segments = url.split('/').filter(Boolean);
    if (!segments.length) return 'Dashboard';
    const last = segments[segments.length - 1];
    return last.charAt(0).toUpperCase() + last.slice(1).replace(/-/g, ' ');
  });

  readonly greeting = computed(() => {
    const hour = new Date().getHours();
    let greet = 'Buenos días';
    if (hour >= 12 && hour < 19) greet = 'Buenas tardes';
    else if (hour >= 19 || hour < 5) greet = 'Buenas noches';
    const name = this.userProfile()?.full_name?.split(' ')?.[0] ?? '';
    return name ? `${greet}, ${name}` : greet;
  });

  readonly userInitial = computed(() =>
    (this.userProfile()?.full_name?.charAt(0) ?? 'U').toUpperCase(),
  );

  ngOnInit(): void {
    if (typeof localStorage !== 'undefined' && typeof window !== 'undefined') {
      const saved =
        localStorage.getItem('f360-theme') ?? localStorage.getItem('theme');
      if (saved === 'dark') {
        this.isDark.set(true);
        document.documentElement.classList.add('dark');
      } else {
        this.isDark.set(false);
        document.documentElement.classList.remove('dark');
      }
    }

    void this.loadWeddingPendingCount();
  }

  toggleTheme(): void {
    this.isDark.update((v) => !v);
    this.applyTheme();
  }

  private applyTheme(): void {
    const root = this.document.documentElement;
    if (this.isDark()) {
      root.classList.add('dark');
      localStorage.setItem('f360-theme', 'dark');
      localStorage.setItem('theme', 'dark');
    } else {
      root.classList.remove('dark');
      localStorage.setItem('f360-theme', 'light');
      localStorage.setItem('theme', 'light');
    }
  }

  onMenuToggle(): void {
    this.menuToggle.emit();
  }

  toggleUserMenu(): void {
    this.showUserMenu.update((v) => !v);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (
      !(event.target as HTMLElement).closest('.user-menu-container') &&
      this.showUserMenu()
    ) {
      this.showUserMenu.set(false);
    }
  }

  private async loadWeddingPendingCount(): Promise<void> {
    const userId = this.supabase.currentUser()?.id;
    if (!userId) {
      this.weddingPendingCount.set(0);
      return;
    }

    try {
      const { data: budgets, error: budgetError } = await this.supabase.client
        .from('wedding_budgets')
        .select('id, status, event_date')
        .in('status', ['planning', 'in_progress'])
        .order('event_date', { ascending: true })
        .limit(1);

      if (budgetError) throw budgetError;

      const activeBudget = (budgets ?? [])[0] as { id: string } | undefined;
      if (!activeBudget?.id) {
        this.weddingPendingCount.set(0);
        return;
      }

      const { count, error: expenseError } = await this.supabase.client
        .from('wedding_expenses')
        .select('id', { count: 'exact', head: true })
        .eq('wedding_budget_id', activeBudget.id)
        .in('status', ['pending', 'partial']);

      if (expenseError) throw expenseError;
      this.weddingPendingCount.set(count ?? 0);
    } catch (err) {
      console.error('Error cargando pendientes de boda:', err);
      this.weddingPendingCount.set(0);
    }
  }

  async logout(): Promise<void> {
    this.showUserMenu.set(false);
    await this.supabase.client.auth.signOut();
    void this.router.navigate(['/auth/login']);
  }
}
