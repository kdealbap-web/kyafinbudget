import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface ConfirmDialogOptions {
  title: string;
  message: string;
  type?: 'danger' | 'warning' | 'info';
  confirmLabel?: string;
  cancelLabel?: string;
}

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './confirm-dialog.component.html',
})
export class ConfirmDialogComponent {
  isVisible = signal(false);
  options = signal<ConfirmDialogOptions>({
    title: '',
    message: '',
    type: 'info',
    confirmLabel: 'Confirmar',
    cancelLabel: 'Cancelar',
  });

  private resolvePromise?: (value: boolean) => void;

  open(opts: ConfirmDialogOptions): Promise<boolean> {
    this.options.set({
      confirmLabel: 'Confirmar',
      cancelLabel: 'Cancelar',
      type: 'info',
      ...opts,
    });
    this.isVisible.set(true);
    return new Promise<boolean>((resolve) => {
      this.resolvePromise = resolve;
    });
  }

  confirm(): void {
    this.isVisible.set(false);
    this.resolvePromise?.(true);
  }

  cancel(): void {
    this.isVisible.set(false);
    this.resolvePromise?.(false);
  }

  onOverlayClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).id === 'confirm-overlay') {
      this.cancel();
    }
  }

  get iconConfig(): { bg: string; icon: string } {
    const t = this.options().type;
    if (t === 'danger') return { bg: 'bg-red-100 dark:bg-red-900/30', icon: '🗑️' };
    if (t === 'warning') return { bg: 'bg-amber-100 dark:bg-amber-900/30', icon: '⚠️' };
    return { bg: 'bg-blue-100 dark:bg-blue-900/30', icon: 'ℹ️' };
  }

  get confirmBtnClass(): string {
    const t = this.options().type;
    if (t === 'danger') return 'f360-btn-danger';
    if (t === 'warning') return 'f360-btn-primary bg-amber-500 hover:bg-amber-600';
    return 'f360-btn-primary';
  }
}
