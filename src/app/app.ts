import { Component, ViewChild, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';

import { ConfirmDialogComponent } from './shared/components/confirm-dialog/confirm-dialog.component';
import { ProgressBarComponent } from './shared/components/progress-bar/progress-bar.component';
import { ToastComponent } from './shared/components/toast/toast.component';

import { ConfirmDialogService } from './shared/services/confirm-dialog.service';
import { ProgressBarService } from './shared/services/progress-bar.service';
import { ToastService } from './shared/services/toast.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    RouterOutlet,
    CommonModule,
    ConfirmDialogComponent,
    ProgressBarComponent,
    ToastComponent,
  ],
  templateUrl: './app.component.html',
})
export class AppComponent implements OnInit {
  @ViewChild('confirmDialog') confirmDialogRef!: ConfirmDialogComponent;
  @ViewChild('progressBar') progressBarRef!: ProgressBarComponent;
  @ViewChild('toast') toastRef!: ToastComponent;

  constructor(
    private confirmDialogService: ConfirmDialogService,
    private progressBarService: ProgressBarService,
    private toastService: ToastService,
  ) { }

  ngOnInit(): void {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;

    const saved = localStorage.getItem('f360-theme');
    if (saved === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      // Si es 'light' o no hay nada guardado → modo claro por defecto
      document.documentElement.classList.remove('dark');
      if (!saved) localStorage.setItem('f360-theme', 'light');
    }
  }

  ngAfterViewInit(): void {
    this.confirmDialogService.register(this.confirmDialogRef);
    this.progressBarService.register(this.progressBarRef);
    this.toastService.register(this.toastRef);
  }
}
