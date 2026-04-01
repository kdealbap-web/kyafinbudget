import { Routes } from '@angular/router';

export const WEDDING_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./wedding-dashboard/wedding-dashboard.component').then(
        (m) => m.WeddingDashboardComponent
      ),
  },
];
