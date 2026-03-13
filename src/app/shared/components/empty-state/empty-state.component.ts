import { Component, Input, ChangeDetectionStrategy } from '@angular/core';

@Component({
  selector: 'app-empty-state',
  standalone: true,
  imports: [],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col items-center justify-center py-16 px-6 text-center">
      <div class="text-6xl mb-4 opacity-60">{{ icon }}</div>
      <h3 class="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">
        {{ title }}
      </h3>
      <p class="text-sm text-gray-500 dark:text-gray-400 max-w-xs leading-relaxed">
        {{ description }}
      </p>
      <ng-content></ng-content>
    </div>
  `,
})
export class EmptyStateComponent {
  @Input() icon = '📭';
  @Input() title = 'Sin resultados';
  @Input() description = 'No hay datos para mostrar. Intenta ajustar los filtros.';
}
