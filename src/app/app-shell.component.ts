import { AfterViewInit, Component, ViewChild, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { SidebarComponent } from './layout/sidebar/sidebar.component';
import { TopbarComponent } from './layout/topbar/topbar.component';
import { ToastComponent } from './shared/components/toast/toast.component';
import { LoadingSpinnerComponent } from './shared/components/loading-spinner/loading-spinner.component';
import { ConfirmDialogComponent } from './shared/components/confirm-dialog/confirm-dialog.component';
import { ProgressBarComponent } from './shared/components/progress-bar/progress-bar.component';
import { ConfirmDialogService } from './shared/services/confirm-dialog.service';
import { ProgressBarService } from './shared/services/progress-bar.service';

/**
 * Shell layout component que envuelve todas las rutas protegidas.
 * Contiene: sidebar + topbar + router-outlet + overlays globales.
 */
@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [
    RouterModule,
    SidebarComponent,
    TopbarComponent,
    ToastComponent,
    LoadingSpinnerComponent,
    ConfirmDialogComponent,
    ProgressBarComponent,
  ],
  template: `
    <div class="flex h-screen overflow-hidden bg-paper dark:bg-gray-950">
      <!-- Sidebar: recibe referencia para que el topbar pueda hacer toggle -->
      <app-sidebar #sidebar></app-sidebar>

      <div class="flex-1 flex flex-col min-w-0 overflow-hidden">
        <!-- (menuToggle) conectado directamente al sidebar -->
        <app-topbar (menuToggle)="sidebar.toggleSidebar()"></app-topbar>
         <main class="flex-1 overflow-y-auto bg-paper dark:bg-gray-950">
          <router-outlet></router-outlet>
        </main>
      </div>
    </div>

    <app-progress-bar></app-progress-bar>
    <app-confirm-dialog></app-confirm-dialog>
    <app-toast></app-toast>
    <app-loading-spinner></app-loading-spinner>
  `,
})
export class AppShellComponent implements AfterViewInit {
  private readonly confirmDialogService = inject(ConfirmDialogService);
  private readonly progressBarService = inject(ProgressBarService);

  @ViewChild(ConfirmDialogComponent)
  private confirmDialog?: ConfirmDialogComponent;

  @ViewChild(ProgressBarComponent)
  private progressBar?: ProgressBarComponent;

  ngAfterViewInit(): void {
    if (this.confirmDialog) {
      this.confirmDialogService.register(this.confirmDialog);
    }
    if (this.progressBar) {
      this.progressBarService.register(this.progressBar);
    }
  }
}
