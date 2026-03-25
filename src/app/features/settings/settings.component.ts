import { DOCUMENT, CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

import { SupabaseService } from '../../core/services/supabase.service';
import { ConfirmDialogService } from '../../shared/services/confirm-dialog.service';
import { ProgressBarService } from '../../shared/services/progress-bar.service';
import { ToastService } from '../../shared/services/toast.service';

type Theme = 'light' | 'dark';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './settings.component.html',
})
export class SettingsComponent {
  private readonly document = inject(DOCUMENT);
  private readonly router = inject(Router);
  private readonly supabase = inject(SupabaseService);
  private readonly confirmDialog = inject(ConfirmDialogService);
  private readonly progressBar = inject(ProgressBarService);
  private readonly toast = inject(ToastService);

  readonly profile = computed(() => this.supabase.userProfile());
  readonly email = computed(() => this.profile()?.email ?? this.supabase.currentUser()?.email ?? '');

  readonly theme = signal<Theme>('light');
  readonly isBusy = signal(false);

  constructor() {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem('f360-theme') as Theme | null;
      this.theme.set(saved === 'dark' ? 'dark' : 'light');
    }
  }

  setTheme(value: Theme): void {
    this.theme.set(value);
    const root = this.document.documentElement;

    if (value === 'dark') {
      root.classList.add('dark');
      if (typeof localStorage !== 'undefined') localStorage.setItem('f360-theme', 'dark');
      if (typeof localStorage !== 'undefined') localStorage.setItem('theme', 'dark');
      this.toast.info('Modo oscuro activado.');
    } else {
      root.classList.remove('dark');
      if (typeof localStorage !== 'undefined') localStorage.setItem('f360-theme', 'light');
      if (typeof localStorage !== 'undefined') localStorage.setItem('theme', 'light');
      this.toast.info('Modo claro activado.');
    }
  }

  async sendPasswordReset(): Promise<void> {
    const email = this.email();
    if (!email) {
      this.toast.error('No se pudo identificar tu correo.');
      return;
    }

    const ok = await this.confirmDialog.confirm({
      title: 'Restablecer contraseña',
      message: 'Te enviaremos un correo con un enlace para restablecer tu contraseña.',
      type: 'warning',
      confirmLabel: 'Enviar correo',
      cancelLabel: 'Cancelar',
    });

    if (!ok) return;

    this.isBusy.set(true);
    this.progressBar.start();

    try {
      const redirectTo = typeof window !== 'undefined'
        ? `${window.location.origin}/auth/reset-password`
        : undefined;
      const { error } = await this.supabase.client.auth.resetPasswordForEmail(
        email,
        redirectTo ? { redirectTo } : undefined,
      );
      if (error) throw error;

      this.toast.success('Correo enviado. Revisa tu bandeja de entrada.');
      this.progressBar.complete();
    } catch (e: any) {
      this.progressBar.error();
      this.toast.error(e?.message ? `No se pudo enviar: ${e.message}` : 'No se pudo enviar el correo.');
    } finally {
      this.isBusy.set(false);
    }
  }

  async logout(): Promise<void> {
    const ok = await this.confirmDialog.confirm({
      title: 'Cerrar sesión',
      message: '¿Quieres cerrar tu sesión ahora?',
      type: 'info',
      confirmLabel: 'Cerrar sesión',
      cancelLabel: 'Cancelar',
    });

    if (!ok) return;

    this.isBusy.set(true);
    this.progressBar.start();

    try {
      const { error } = await this.supabase.client.auth.signOut();
      if (error) throw error;
      this.progressBar.complete();
      void this.router.navigate(['/auth/login']);
    } catch (e: any) {
      this.progressBar.error();
      this.toast.error(e?.message ? `No se pudo cerrar sesión: ${e.message}` : 'No se pudo cerrar sesión.');
    } finally {
      this.isBusy.set(false);
    }
  }
}
