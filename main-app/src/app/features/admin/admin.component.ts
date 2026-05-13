import { Component, inject } from '@angular/core';
import { Router, RouterLink, RouterOutlet } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [RouterLink, RouterOutlet],
  template: `
    <div class="min-h-screen bg-gray-50">
      <header class="bg-white shadow-sm">
        <div class="max-w-6xl mx-auto px-8 py-4 flex justify-between items-center">
          <h1 class="text-2xl font-bold text-gray-900">Administration</h1>
          <div class="flex items-center gap-4">
            <span class="text-sm text-gray-600">{{ authService.currentUser()?.displayName }}</span>
            <button
              (click)="signOut()"
              class="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm"
            >
              Se déconnecter
            </button>
          </div>
        </div>
        <nav class="max-w-6xl mx-auto px-8 pb-3 flex gap-4">
          <a
            routerLink="/admin/players"
            class="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline"
          >
            Membres
          </a>
        </nav>
      </header>
      <main class="max-w-6xl mx-auto px-8 py-6">
        <router-outlet />
      </main>
    </div>
  `,
})
export class AdminComponent {
  readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  async signOut(): Promise<void> {
    await this.authService.signOut();
    await this.router.navigate(['/login']);
  }
}
