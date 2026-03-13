import {
    ChangeDetectionStrategy,
    Component,
    inject,
    signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
    selector: 'app-login',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [CommonModule, FormsModule, RouterModule],
    templateUrl: './login.component.html',
})
export class LoginComponent {
    private readonly authService = inject(AuthService);

    readonly email = signal('');
    readonly password = signal('');
    readonly showPassword = signal(false);
    readonly isLoading = signal(false);
    readonly errorMessage = signal('');
    readonly submitted = signal(false);

    get emailError(): string | null {
        if (!this.submitted()) return null;
        const v = this.email().trim();
        if (!v) return 'El correo es obligatorio.';
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return 'Ingresa un correo válido.';
        return null;
    }

    get passwordError(): string | null {
        if (!this.submitted()) return null;
        if (!this.password()) return 'La contraseña es obligatoria.';
        return null;
    }

    async onSubmit(): Promise<void> {
        this.submitted.set(true);
        if (this.emailError || this.passwordError) return;

        this.isLoading.set(true);
        this.errorMessage.set('');
        try {
            // signIn valida credenciales, cierra sesión, envía OTP,
            // guarda mfa_email en sessionStorage y navega a /auth/mfa
            const ok = await this.authService.signIn(
                this.email().trim(),
                this.password()
            );
            if (!ok) {
                this.errorMessage.set(
                    this.authService.errorMessage() ?? 'Correo o contraseña incorrectos.'
                );
            }
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Error inesperado. Intenta nuevamente.';
            this.errorMessage.set(msg);
        } finally {
            this.isLoading.set(false);
        }
    }
}
