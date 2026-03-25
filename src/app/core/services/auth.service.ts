import { Injectable, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { User } from '@supabase/supabase-js';
import { SupabaseService } from './supabase.service';
import { AppRole } from '../../domain/models/profile.model';

@Injectable({ providedIn: 'root' })
export class AuthService {
    private readonly supabase = inject(SupabaseService);
    private readonly router = inject(Router);

    readonly isLoading = signal(false);
    readonly errorMessage = signal<string | null>(null);
    readonly successMessage = signal<string | null>(null);

    // REGISTRO

    /**
     * Registra un nuevo usuario.
     * Supabase envia email de confirmacion automaticamente.
     * Despues de confirmar, el trigger crea el perfil.
     */
    async signUp(
        email: string,
        password: string,
        fullName: string
    ): Promise<boolean> {
        this.isLoading.set(true);
        this.errorMessage.set(null);
        try {
            const { data, error } = await this.supabase.client.auth.signUp({
                email,
                password,
                options: {
                    data: { full_name: fullName },
                    emailRedirectTo: typeof window !== 'undefined' ? `${window.location.origin}/auth/callback` : '',
                },
            });

            if (error) throw error;

            if (data.user && !data.session) {
                this.successMessage.set(
                    `Hemos enviado un enlace de confirmacion a ${email}. Revisa tu bandeja de entrada.`
                );
                return true;
            }

            return true;
        } catch (err: unknown) {
            this.errorMessage.set(this.parseError(err));
            return false;
        } finally {
            this.isLoading.set(false);
        }
    }

    // LOGIN (SIN MFA)

    /**
     * Login con usuario y contraseña.
     */
    async signIn(
        email: string,
        password: string
    ): Promise<boolean> {
        this.isLoading.set(true);
        this.errorMessage.set(null);
        try {
            const { data, error } = await this.supabase.client
                .auth.signInWithPassword({ email, password });

            if (error) throw error;

            if (!data.session?.user) {
                this.errorMessage.set('No se pudo iniciar sesión. Intenta de nuevo.');
                return false;
            }

            if (typeof sessionStorage !== 'undefined') {
                sessionStorage.removeItem('mfa_pending');
                sessionStorage.removeItem('mfa_email');
            }

            await this.ensureProfile(data.session.user);
            await this.supabase.loadUserRole(data.session.user.id);

            await this.router.navigate(['/dashboard']);
            return true;
        } catch (err: unknown) {
            this.errorMessage.set(this.parseError(err));
            return false;
        } finally {
            this.isLoading.set(false);
        }
    }
    /**
     * Envía OTP de 6 dígitos al correo.
     * shouldCreateUser: false → solo usuarios existentes.
     */
    async sendEmailOTP(email: string): Promise<void> {
        const { error } = await this.supabase.client
            .auth.signInWithOtp({
                email,
                options: {
                    shouldCreateUser: false,
                    emailRedirectTo: undefined,
                },
            });
        if (error) throw error;
    }

    /**
     * Verifica el OTP ingresado por el usuario.
     */
    async verifyOTP(email: string, token: string): Promise<boolean> {
        this.isLoading.set(true);
        this.errorMessage.set(null);
        try {
            const { data, error } = await this.supabase.client
                .auth.verifyOtp({
                    email,
                    token,
                    type: 'magiclink',
                });

            if (error) throw error;

            if (data.session) {
                if (typeof sessionStorage !== 'undefined') {
                    sessionStorage.removeItem('mfa_pending');
                    sessionStorage.removeItem('mfa_email');
                }

                await this.supabase.loadUserRole(data.session.user.id);
                await this.ensureProfile(data.session.user);

                await this.router.navigate(['/dashboard']);
                return true;
            }

            return false;
        } catch (err: unknown) {
            this.errorMessage.set(this.parseError(err));
            return false;
        } finally {
            this.isLoading.set(false);
        }
    }

    // CALLBACK

    /**
     * Maneja el redirect despues de confirmar el email.
     * Crea el perfil en la tabla profiles si no existe.
     */
    async handleAuthCallback(): Promise<void> {
        try {
            const {
                data: { session },
            } = await this.supabase.client.auth.getSession();

            if (!session?.user) {
                await this.router.navigate(['/auth/login']);
                return;
            }

            await this.ensureProfile(session.user);
            await this.router.navigate(['/dashboard']);
        } catch (err) {
            console.error('Error en callback de auth:', err);
            await this.router.navigate(['/auth/login']);
        }
    }

    // RESET PASSWORD

    async resetPassword(email: string): Promise<boolean> {
        this.isLoading.set(true);
        this.errorMessage.set(null);
        try {
            const { error } = await this.supabase.client.auth
                .resetPasswordForEmail(email, {
                    redirectTo: typeof window !== 'undefined' ? `${window.location.origin}/auth/callback` : '',
                });
            if (error) throw error;
            this.successMessage.set(
                'Te enviamos un enlace para restablecer tu contrasena.'
            );
            return true;
        } catch (err: unknown) {
            this.errorMessage.set(this.parseError(err));
            return false;
        } finally {
            this.isLoading.set(false);
        }
    }

    // SIGN OUT

    async signOut(): Promise<void> {
        await this.supabase.client.auth.signOut();
        if (typeof sessionStorage !== 'undefined') sessionStorage.clear();
        await this.router.navigate(['/auth/login']);
    }

    // HELPERS

    private async ensureProfile(user: User): Promise<void> {
        try {
            const { data } = await this.supabase.client
                .from('profiles')
                .select('id')
                .eq('id', user.id)
                .maybeSingle();

            if (!data) {
                await this.supabase.client
                    .from('profiles')
                    .insert({
                        id: user.id,
                        full_name: user.user_metadata?.['full_name']
                            ?? user.email?.split('@')[0]
                            ?? 'Usuario',
                        email: user.email ?? '',
                        role: AppRole.User,
                        is_active: true,
                    });
            }
        } catch (err) {
            console.error('Error verificando perfil:', err);
        }
    }

    private parseError(err: unknown): string {
        if (err instanceof Error) {
            const msg = err.message.toLowerCase();
            if (msg.includes('invalid login'))
                return 'Correo o contrasena incorrectos.';
            if (msg.includes('email not confirmed'))
                return 'Debes confirmar tu correo antes de ingresar.';
            if (msg.includes('user already registered'))
                return 'Este correo ya esta registrado.';
            if (msg.includes('password'))
                return 'La contrasena debe tener minimo 6 caracteres.';
            if (msg.includes('token'))
                return 'El codigo ingresado es incorrecto o ha expirado.';
            if (msg.includes('rate limit'))
                return 'Demasiados intentos. Espera unos minutos.';
            return err.message;
        }
        return 'Ocurrio un error inesperado. Intenta de nuevo.';
    }
}
