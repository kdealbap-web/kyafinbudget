import { Pipe, PipeTransform } from '@angular/core';

/**
 * Formatea un número como moneda colombiana: $ 2.000.000
 * Uso: {{ amount | currencyCop }}
 */
@Pipe({ name: 'currencyCop', standalone: true, pure: true })
export class CurrencyCopPipe implements PipeTransform {
  private static readonly fmt = new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });

  transform(value: number | null | undefined): string {
    if (value === null || value === undefined || isNaN(value as number)) {
      return '$ 0';
    }
    const num = Number(value);
    // Intl devuelve "COP 2.000.000" en algunos locales; lo normalizamos a "$ 2.000.000"
    return CurrencyCopPipe.fmt
      .format(num)
      .replace('COP', '$')
      .replace(/\s+/g, ' ')
      .trim();
  }
}
