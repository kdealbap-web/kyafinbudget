import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
  computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { RouterModule } from '@angular/router';

import { SupabaseService } from '../../../core/services/supabase.service';
import { ToastService } from '../../../shared/services/toast.service';
import { ProgressBarService } from '../../../shared/services/progress-bar.service';
import { AppRole } from '../../../domain/models/profile.model';

function passwordMatchValidator(control: AbstractControl): ValidationErrors | null {
  const pw = control.get('password')?.value;
  const cpw = control.get('confirmPassword')?.value;
  return pw === cpw ? null : { passwordMismatch: true };
}

@Component({
  selector: 'app-register',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './register.component.html',
})
export class RegisterComponent {
  private readonly fb = inject(FormBuilder);
  private readonly supabase = inject(SupabaseService);
  private readonly toast = inject(ToastService);
  private readonly progressBar = inject(ProgressBarService);

  readonly showPassword = signal(false);
  readonly showConfirmPassword = signal(false);
  readonly isLoading = signal(false);
  readonly registered = signal(false);

  readonly form = this.fb.group(
    {
      fullName: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(60)]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(8), Validators.maxLength(50)]],
      confirmPassword: ['', Validators.required],
    },
    { validators: passwordMatchValidator }
  );

  passwordStrength = computed(() => {
    const pw = this.form.get('password')?.value ?? '';
    if (pw.length === 0) return 0;
    let score = 0;
    if (pw.length >= 8) score++;
    if (/[A-Z]/.test(pw)) score++;
    if (/[0-9]/.test(pw)) score++;
    if (/[^A-Za-z0-9]/.test(pw)) score++;
    return score;
  });

  async onSubmit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { fullName, email, password } = this.form.value;
    this.isLoading.set(true);
    this.progressBar.start();

    try {
      // 1. Crear cuenta en Supabase Auth
      const { data, error } = await this.supabase.client.auth.signUp({
        email: email!,
        password: password!,
        options: { data: { full_name: fullName! } },
      });

      if (error) throw error;

      const user = data.user;
      if (!user) throw new Error('No se pudo crear el usuario.');

      // 2. Insertar en tabla profiles
      const { error: profileError } = await this.supabase.client
        .from('profiles')
        .insert({
          id: user.id,
          full_name: fullName!,
          email: email!,
          role: AppRole.User,
          is_active: true,
        });

      if (profileError) throw profileError;

      this.progressBar.complete();
      this.toast.success('¡Cuenta creada! Revisa tu email para confirmar el acceso.');
      this.registered.set(true);
    } catch (err: unknown) {
      this.progressBar.error();
      const msg = err instanceof Error ? err.message : 'Error al crear la cuenta. Intenta nuevamente.';
      this.toast.error(msg);
    } finally {
      this.isLoading.set(false);
    }
  }

  getError(field: string): string | null {
    const ctrl = this.form.get(field);
    if (!ctrl?.invalid || !ctrl?.touched) return null;
    if (ctrl.errors?.['required']) return 'Este campo es obligatorio.';
    if (ctrl.errors?.['email']) return 'Ingresa un correo válido.';
    if (ctrl.errors?.['minlength']) return `Mínimo ${ctrl.errors['minlength'].requiredLength} caracteres.`;
    if (ctrl.errors?.['maxlength']) return 'Has superado el límite de caracteres.';
    if (this.form.errors?.['passwordMismatch'] && field === 'confirmPassword')
      return 'Las contraseñas no coinciden.';
    return null;
  }
}
