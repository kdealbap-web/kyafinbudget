import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { roleGuard } from './core/guards/role.guard';
import { AppRole } from './domain/models/profile.model';

export const routes: Routes = [
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },

  // ── Auth (sin guard) ────────────────────────
  {
    path: 'auth',
    children: [
      {
        path: 'login',
        loadComponent: () =>
          import('./features/auth/login/login.component').then(m => m.LoginComponent),
      },
      {
        path: 'register',
        loadComponent: () =>
          import('./features/auth/register/register.component').then(m => m.RegisterComponent),
      },
      {
        path: 'callback',
        loadComponent: () =>
          import('./features/auth/callback/auth-callback.component').then(m => m.AuthCallbackComponent),
      },
      {
        path: 'reset-password',
        loadComponent: () =>
          import('./features/auth/reset-password/reset-password.component').then(m => m.ResetPasswordComponent),
      },
    ],
  },

  // ── App Shell (protegido) ───────────────────
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./app-shell.component').then(m => m.AppShellComponent),
    children: [

      // Dashboard
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/dashboard/dashboard.component').then(m => m.DashboardComponent),
      },

      // ── Transacciones ──────────────────────
      {
        path: 'transactions',
        children: [
          {
            path: '',
            loadComponent: () =>
              import('./features/transactions/transaction-list/transaction-list.component')
                .then(m => m.TransactionListComponent),
          },
          // Paso 1: Selector de tipo
          {
            path: 'new',
            loadComponent: () =>
              import('./features/transactions/type-selector/transaction-type-selector.component')
                .then(m => m.TransactionTypeSelectorComponent),
          },
          // Paso 2a: Formulario ingreso (nuevo)
          {
            path: 'new/income',
            loadComponent: () =>
              import('./features/transactions/income-form/income-form.component')
                .then(m => m.IncomeFormComponent),
          },
          // Paso 2b: Formulario gasto (nuevo)
          {
            path: 'new/expense',
            loadComponent: () =>
              import('./features/transactions/expense-form/expense-form.component')
                .then(m => m.ExpenseFormComponent),
          },
          // Edición de ingreso
          {
            path: 'income/:id/edit',
            loadComponent: () =>
              import('./features/transactions/income-form/income-form.component')
                .then(m => m.IncomeFormComponent),
          },
          // Edición de gasto
          {
            path: 'expense/:id/edit',
            loadComponent: () =>
              import('./features/transactions/expense-form/expense-form.component')
                .then(m => m.ExpenseFormComponent),
          },
          // Ruta genérica edición (fallback al expense form)
          {
            path: ':id/edit',
            loadComponent: () =>
              import('./features/transactions/expense-form/expense-form.component')
                .then(m => m.ExpenseFormComponent),
          },
        ],
      },

      // ── Cuentas ────────────────────────────
      {
        path: 'accounts',
        loadComponent: () =>
          import('./features/accounts/accounts.component').then(m => m.AccountsComponent),
      },

      // ── Pagos programados ──────────────────
      {
        path: 'scheduled',
        children: [
          {
            path: '',
            loadComponent: () =>
              import('./features/scheduled/scheduled-list/scheduled-list.component')
                .then(m => m.ScheduledListComponent),
          },
          {
            path: 'new',
            loadComponent: () =>
              import('./features/scheduled/scheduled-form/scheduled-form.component')
                .then(m => m.ScheduledFormComponent),
          },
          {
            path: ':id/edit',
            loadComponent: () =>
              import('./features/scheduled/scheduled-form/scheduled-form.component')
                .then(m => m.ScheduledFormComponent),
          },
        ],
      },


      // ── Boda ─────────────────────────────
      {
        path: 'wedding',
        loadChildren: () =>
          import('./features/wedding/wedding.routes').then(m => m.WEDDING_ROUTES),
      },
      // ── Deudas ─────────────────────────────
      {
        path: 'debts',
        loadComponent: () =>
          import('./features/debts/debts.component').then(m => m.DebtsComponent),
      },


      // ── Perfil ─────────────────────────────
      {
        path: 'profile',
        loadComponent: () =>
          import('./features/profile/profile.component').then(m => m.ProfileComponent),
      },

      // ── Configuración ───────────────────────
      {
        path: 'settings',
        loadComponent: () =>
          import('./features/settings/settings.component').then(m => m.SettingsComponent),
      },

      // ── Importar ───────────────────────────
      {
        path: 'import',
        canActivate: [roleGuard(AppRole.SuperAdmin, AppRole.Partner)],
        loadComponent: () =>
          import('./features/import-excel/import-excel.component').then(m => m.ImportExcelComponent),
      },

      // ── Admin ──────────────────────────────
      {
        path: 'admin',
        canActivate: [roleGuard(AppRole.SuperAdmin)],
        children: [
          { path: '', redirectTo: 'users', pathMatch: 'full' },
          {
            path: 'users',
            loadComponent: () =>
              import('./features/admin/user-list/user-list.component').then(m => m.UserListComponent),
          },
          {
            path: 'audit',
            loadComponent: () =>
              import('./features/admin/audit-log/audit-log.component').then(m => m.AuditLogComponent),
          },
        ],
      },
    ],
  },

  { path: '**', redirectTo: 'dashboard' },
];

