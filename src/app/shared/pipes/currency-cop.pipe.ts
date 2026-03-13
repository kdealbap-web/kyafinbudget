import { Pipe, PipeTransform } from '@angular/core';

/**
 * Formatea un número como moneda colombiana: $ 1.250.000
 * Uso: {{ amount | currencyCop }}
 */
@Pipe({ name: 'currencyCop', standalone: true, pure: true })
export class CurrencyCopPipe implements PipeTransform {
    transform(value: number | null | undefined): string {
        if (value === null || value === undefined || isNaN(value)) return '$ 0';

        const formatted = Math.abs(value)
            .toFixed(0)
            .replace(/\B(?=(\d{3})+(?!\d))/g, '.');

        return value < 0 ? `- $ ${formatted}` : `$ ${formatted}`;
    }
}
