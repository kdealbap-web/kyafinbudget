import { Component, inject, ChangeDetectionStrategy } from '@angular/core';

import { SupabaseService } from '../../../core/services/supabase.service';

@Component({
  selector: 'app-loading-spinner',
  standalone: true,
  imports: [],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (supabase.isLoading()) {
      <div
        class="fixed inset-0 z-50 flex items-center justify-center
               bg-black/40 backdrop-blur-sm"
        role="status"
        aria-label="Cargando..."
      >
        <div class="flex flex-col items-center gap-4">
          <div
            class="w-14 h-14 rounded-full border-4 border-white/20
                      border-t-blue-400 animate-spin"
          ></div>
          <p class="text-white text-sm font-medium tracking-wide">Cargando...</p>
        </div>
      </div>
    }
  `,
})
export class LoadingSpinnerComponent {
  readonly supabase = inject(SupabaseService);
}
