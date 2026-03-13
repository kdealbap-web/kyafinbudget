import { Injectable } from '@angular/core';
import { ToastComponent, ToastType } from './toast.component';
@Injectable({ providedIn: 'root' })
export class ToastService {
  private toast?: ToastComponent;

  register(toast: ToastComponent): void {
    this.toast = toast;
  }

  show(message: string, type: ToastType = 'info'): void {
    this.toast?.show(message, type);
  }

  success(message: string): void { this.toast?.success(message); }
  error(message: string): void   { this.toast?.error(message); }
  info(message: string): void    { this.toast?.info(message); }
  warning(message: string): void { this.toast?.warning(message); }
}
