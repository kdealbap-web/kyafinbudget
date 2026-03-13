import {
  ChangeDetectionStrategy,
  Component,
  OnChanges,
  computed,
  input,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-bank-logo',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './bank-logo.component.html',
})
export class BankLogoComponent implements OnChanges {
  slug = input<string>('');
  name = input<string>('');
  color = input<string>('#64748B');
  size = input<'sm' | 'md' | 'lg'>('md');

  readonly hasError = signal(false);

  private normalizeSlug(value: string): string {
    const last = value.split('/').pop() ?? value;
    const noExt = last.replace(/\.png$/i, '');
    return noExt
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/_/g, '-')
      .replace(/[^a-z0-9-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  readonly imagePath = computed(() => {
    const raw = (this.slug() ?? '').trim();
    const slug = raw ? this.normalizeSlug(raw) : '';
    return slug ? `assets/img/banks/${slug}.png` : '';
  });

  // Fondo con opacidad 15% del color del banco
  readonly bgColor = computed(() => {
    const hex = this.color();
    if (!hex || hex.length < 7) return 'rgba(100,116,139,0.15)';
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    if ([r, g, b].some(Number.isNaN)) return 'rgba(100,116,139,0.15)';
    return `rgba(${r},${g},${b},0.15)`;
  });

  readonly containerBg = computed(() => {
    const solid = this.color() || '#64748B';
    if (!this.imagePath()) return solid;
    return this.hasError() ? solid : this.bgColor();
  });

  // Resetear error al cambiar de banco
  ngOnChanges(): void {
    this.hasError.set(false);
  }

  onImageError(): void {
    this.hasError.set(true);
  }
}