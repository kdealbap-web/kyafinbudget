import { Component, OnInit, inject } from '@angular/core';

import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-auth-callback',
  standalone: true,
  imports: [],
  template: `
    <div class="min-h-screen flex items-center justify-center bg-gray-50">
      <div class="text-center">
        <div
          class="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"
        ></div>
        <p class="text-gray-600 font-medium">Verificando tu cuenta...</p>
        <p class="text-gray-400 text-sm mt-1">Seras redirigido en un momento</p>
      </div>
    </div>
  `,
})
export class AuthCallbackComponent implements OnInit {
  private readonly authService = inject(AuthService);

  async ngOnInit(): Promise<void> {
    await this.authService.handleAuthCallback();
  }
}
