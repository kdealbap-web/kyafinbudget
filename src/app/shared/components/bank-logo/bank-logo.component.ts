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

  private readonly PNG_SLUGS = new Set([
    'bancolombia',
    'nequi',
    'nu',
    'bbva',
    'davivienda',
    'banco-bogota',
    'banco-falabella',
    'banco-occidente',
    'rappicard',
  ]);

  private readonly SVG_SLUGS = new Set(['efectivo']);

  private applySlugAliases(slug: string): string {
    const aliases: Record<string, string> = {
      'banco-de-bogota': 'banco-bogota',
      'bancobogota': 'banco-bogota',
      'bancodebogota': 'banco-bogota',
      'banco-de-occidente': 'banco-occidente',
      'bancodeoccidente': 'banco-occidente',
      'bancooccidente': 'banco-occidente',
    };

    return aliases[slug] ?? slug;
  }

  private normalizeSlug(value: string): string {
    const last = value.split('/').pop() ?? value;
    const noExt = last.replace(/\.(png|svg)$/i, '');
    const normalized = noExt
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/_/g, '-')
      .replace(/[^a-z0-9-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '');

    return this.applySlugAliases(normalized);
  }

  readonly normalizedSlug = computed(() => {
    const rawSlug = (this.slug() ?? '').trim();
    const source = rawSlug || (this.name() ?? '').trim();
    return source ? this.normalizeSlug(source) : '';
  });

  readonly imagePath = computed(() => {
    const slug = this.normalizedSlug();
    if (!slug) return '';

    const isSvg = this.SVG_SLUGS.has(slug);
    const isKnown = isSvg || this.PNG_SLUGS.has(slug);
    if (!isKnown) return '';

    const ext = isSvg ? 'svg' : 'png';
    return `assets/img/banks/${slug}.${ext}`;
  });

  readonly sizeClass = computed(() =>
    ({
      sm: 'w-8 h-8',
      md: 'w-11 h-11',
      lg: 'w-14 h-14',
    }[this.size()])
  );

  readonly imageClass = computed(() =>
    ({
      sm: 'w-6 h-6',
      md: 'w-9 h-9',
      lg: 'w-12 h-12',
    }[this.size()])
  );

  readonly textSizeClass = computed(() =>
    ({
      sm: 'text-sm',
      md: 'text-lg',
      lg: 'text-2xl',
    }[this.size()])
  );

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
