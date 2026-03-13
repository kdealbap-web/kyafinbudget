import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './reset-password.component.html'
})
export class ResetPasswordComponent {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);

  resetForm = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]]
  });

  isLoading = signal(false);
  errorMessage = signal('');
  successMessage = signal('');
  sent = signal(false);

  async onSubmit() {
    this.errorMessage.set('');

    if (this.resetForm.invalid) {
      this.resetForm.markAllAsTouched();
      return;
    }

    this.isLoading.set(true);

    try {
      const email = this.resetForm.getRawValue().email;
      const ok = await this.authService.resetPassword(email);

      if (!ok) {
        this.errorMessage.set(
          this.authService.errorMessage() ?? 'No se pudo enviar el enlace. Verifica tu correo.'
        );
        return;
      }

      this.sent.set(true);
    } catch (error: any) {
      this.errorMessage.set(error?.message || 'Ocurrió un error inesperado al enviar el correo.');
    } finally {
      this.isLoading.set(false);
    }
  }
}
