import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-progress-bar',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (visible()) {
      <div
        class="fixed top-0 left-0 z-[9999] h-[3px] transition-all duration-300 ease-out"
        [class.opacity-0]="hiding()"
        [style.width.%]="progress()"
        [style.background]="'linear-gradient(90deg, #1E40AF 0%, #3B82F6 60%, #60A5FA 100%)'"
        [style.box-shadow]="'0 0 8px rgba(59,130,246,0.6)'"
      ></div>
    }
  `,
})
export class ProgressBarComponent {
  visible = signal(false);
  hiding = signal(false);
  progress = signal(0);

  private timer?: ReturnType<typeof setInterval>;
  private hideTimer?: ReturnType<typeof setTimeout>;

  start(): void {
    // Limpiar estado anterior
    this.clearTimers();
    this.hiding.set(false);
    this.progress.set(0);
    this.visible.set(true);

    // Auto-avance hasta 85%
    this.timer = setInterval(() => {
      const current = this.progress();
      if (current < 85) {
        const increment = current < 30 ? 6 : current < 60 ? 3 : 1;
        this.progress.set(Math.min(current + increment, 85));
      }
    }, 200);
  }

  complete(): void {
    this.clearTimers();
    this.progress.set(100);

    this.hideTimer = setTimeout(() => {
      this.hiding.set(true);
      setTimeout(() => {
        this.visible.set(false);
        this.progress.set(0);
        this.hiding.set(false);
      }, 350);
    }, 300);
  }

  error(): void {
    this.clearTimers();
    this.progress.set(100);
    // Barra roja momentánea
    this.hideTimer = setTimeout(() => {
      this.visible.set(false);
      this.progress.set(0);
    }, 600);
  }

  private clearTimers(): void {
    if (this.timer) clearInterval(this.timer);
    if (this.hideTimer) clearTimeout(this.hideTimer);
  }
}
