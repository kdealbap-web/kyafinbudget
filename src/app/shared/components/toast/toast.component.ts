import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastMessage {
  id: number;
  type: ToastType;
  message: string;
}

@Component({
  selector: 'app-toast',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './toast.component.html',
})
export class ToastComponent {
  toasts = signal<ToastMessage[]>([]);
  private counter = 0;

  show(message: string, type: ToastType = 'info'): void {
    const id = ++this.counter;
    this.toasts.update((prev) => [...prev, { id, type, message }]);
    setTimeout(() => this.dismiss(id), 3500);
  }

  success(message: string): void { this.show(message, 'success'); }
  error(message: string): void   { this.show(message, 'error'); }
  info(message: string): void    { this.show(message, 'info'); }
  warning(message: string): void { this.show(message, 'warning'); }

  dismiss(id: number): void {
    this.toasts.update((prev) => prev.filter((t) => t.id !== id));
  }

  iconFor(type: ToastType): string {
    const map: Record<ToastType, string> = {
      success: '✓',
      error: '✕',
      info: 'ℹ',
      warning: '⚠',
    };
    return map[type];
  }

  classFor(type: ToastType): string {
    const map: Record<ToastType, string> = {
      success: 'bg-emerald-600 text-white',
      error:   'bg-red-600 text-white',
      info:    'bg-blue-700 text-white',
      warning: 'bg-amber-500 text-white',
    };
    return map[type];
  }

  iconBgFor(type: ToastType): string {
    const map: Record<ToastType, string> = {
      success: 'bg-emerald-500',
      error:   'bg-red-500',
      info:    'bg-blue-600',
      warning: 'bg-amber-400',
    };
    return map[type];
  }
}
