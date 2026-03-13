import { Injectable } from '@angular/core';
import { ConfirmDialogComponent, ConfirmDialogOptions } from '../components/confirm-dialog/confirm-dialog.component';

@Injectable({ providedIn: 'root' })
export class ConfirmDialogService {
  private dialog?: ConfirmDialogComponent;

  register(dialog: ConfirmDialogComponent): void {
    this.dialog = dialog;
  }

  confirm(options: ConfirmDialogOptions): Promise<boolean> {
    if (!this.dialog) {
      console.warn('[ConfirmDialogService] No hay diálogo registrado.');
      return Promise.resolve(false);
    }
    return this.dialog.open(options);
  }
}
