import { Pipe, PipeTransform } from '@angular/core';

/**
 * Transforma una fecha ISO en texto relativo.
 * Uso: {{ transaction.date | relativeDate }}
 * Salida: "hoy", "ayer", "hace 3 días", "hace 2 semanas"
 */
@Pipe({ name: 'relativeDate', standalone: true, pure: true })
export class RelativeDatePipe implements PipeTransform {
    transform(value: string | Date | null | undefined): string {
        if (!value) return '';

        const date = typeof value === 'string' ? new Date(value) : value;
        if (isNaN(date.getTime())) return '';

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const target = new Date(date);
        target.setHours(0, 0, 0, 0);

        const diffMs = today.getTime() - target.getTime();
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        if (diffDays === 0) return 'hoy';
        if (diffDays === 1) return 'ayer';
        if (diffDays < 7) return `hace ${diffDays} días`;
        if (diffDays < 14) return 'hace 1 semana';
        if (diffDays < 30) return `hace ${Math.floor(diffDays / 7)} semanas`;
        if (diffDays < 60) return 'hace 1 mes';
        if (diffDays < 365) return `hace ${Math.floor(diffDays / 30)} meses`;
        return `hace ${Math.floor(diffDays / 365)} año(s)`;
    }
}
