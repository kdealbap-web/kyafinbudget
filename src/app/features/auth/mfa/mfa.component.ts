import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-mfa',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, RouterModule],
  templateUrl: './mfa.component.html',
})
export class MfaComponent implements OnInit, OnDestroy {
  readonly authService = inject(AuthService);

  readonly digits = signal<string[]>(['', '', '', '', '', '', '', '']);
  readonly countdown = signal(60);
  readonly canResend = signal(false);
  readonly email = signal('');
  readonly errorMessage = signal<string | null>(null);
  readonly isLoading = signal(false);
  readonly shake = signal(false);

  private timer?: ReturnType<typeof setInterval>;

  ngOnInit(): void {
    const saved = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('mfa_email') ?? '' : '';
    this.email.set(saved);
    this.startCountdown();
  }

  ngOnDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  onInput(index: number, event: Event): void {
    const input = event.target as HTMLInputElement;
    const value = input.value.replace(/\D/g, '').slice(-1);
    input.value = value;

    const updated = [...this.digits()];
    updated[index] = value;
    this.digits.set(updated);

    if (value && index < 7) {
      const next = document.getElementById(`otp-${index + 1}`);
      (next as HTMLInputElement | null)?.focus();
    }

    if (updated.every(d => d !== '')) {
      void this.onSubmit();
    }
  }

  onKeyDown(index: number, event: KeyboardEvent): void {
    if (event.key === 'Backspace') {
      const updated = [...this.digits()];
      if (!updated[index] && index > 0) {
        updated[index - 1] = '';
        this.digits.set(updated);
        const prev = document.getElementById(`otp-${index - 1}`);
        (prev as HTMLInputElement | null)?.focus();
      } else {
        updated[index] = '';
        this.digits.set(updated);
      }
    }
  }

  onPaste(event: ClipboardEvent): void {
    event.preventDefault();
    const text = event.clipboardData?.getData('text').replace(/\D/g, '').slice(0, 8) ?? '';
    const updated = ['', '', '', '', '', '', '', ''];
    text.split('').forEach((c, i) => { updated[i] = c; });
    this.digits.set(updated);

    const lastIdx = Math.min(text.length - 1, 7);
    const input = document.getElementById(`otp-${lastIdx}`);
    (input as HTMLInputElement | null)?.focus();

    if (updated.every(d => d !== '')) void this.onSubmit();
  }

  async onSubmit(): Promise<void> {
    const token = this.digits().join('');
    if (token.length < 8 || this.isLoading()) return;

    this.isLoading.set(true);
    this.errorMessage.set(null);

    const ok = await this.authService.verifyOTP(this.email(), token);
    this.isLoading.set(false);

    if (ok) return;

    // Shake y limpiar en error
    this.triggerShake();
    const serviceError = (
      this.authService as unknown as { errorMessage?: () => string | null }
    ).errorMessage?.();
    this.errorMessage.set(serviceError ?? 'Código inválido o expirado. Inténtalo de nuevo.');
    this.digits.set(['', '', '', '', '', '', '', '']);
    setTimeout(() => {
      (document.getElementById('otp-0') as HTMLInputElement | null)?.focus();
    }, 50);
  }

  async resendCode(): Promise<void> {
    if (!this.canResend()) return;
    try {
      await this.authService.sendEmailOTP(this.email());
      this.countdown.set(60);
      this.canResend.set(false);
      this.digits.set(['', '', '', '', '', '', '', '']);
      this.errorMessage.set(null);
      this.startCountdown();
    } catch {
      // Error controlado en AuthService
    }
  }

  isComplete = (): boolean => this.digits().every(d => d !== '');

  maskedEmail(): string {
    const e = this.email();
    if (!e.includes('@')) return e;
    const [user, domain] = e.split('@');
    const visible = user.slice(0, 3);
    const masked = '*'.repeat(Math.max(0, user.length - 3));
    return `${visible}${masked}@${domain}`;
  }

  private startCountdown(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = setInterval(() => {
      const current = this.countdown();
      if (current <= 1) {
        clearInterval(this.timer);
        this.countdown.set(0);
        this.canResend.set(true);
      } else {
        this.countdown.set(current - 1);
      }
    }, 1000);
  }

  private triggerShake(): void {
    this.shake.set(true);
    setTimeout(() => this.shake.set(false), 600);
  }
}
