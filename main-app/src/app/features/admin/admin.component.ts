import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterOutlet } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { InviteService } from '../../core/services/invite.service';

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
        <div class="bg-white rounded-2xl shadow-sm p-6 mb-6">
          <h2 class="text-xl font-semibold text-gray-900 mb-2">Invitations joueurs</h2>
          <p class="text-gray-500 text-sm mb-4">
            Générez un lien d'invitation global pour permettre aux joueurs de s'inscrire au club.
          </p>

          <button
            (click)="generateInviteLink()"
            [disabled]="inviteLoading()"
            class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            @if (inviteLoading()) {
              Génération…
            } @else {
              Générer un lien d'invitation
            }
          </button>

          @if (inviteLink()) {
            <div class="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p class="text-sm text-blue-700 font-medium mb-1">Lien d'invitation :</p>
              <p class="text-sm text-blue-600 break-all">{{ inviteLink() }}</p>
            </div>
          }

          @if (inviteError()) {
            <div class="mt-4 bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">
              {{ inviteError() }}
            </div>
          }
        </div>
        <router-outlet />
      </main>
    </div>
  `,
})
export class AdminComponent {
  readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly inviteService = inject(InviteService);

  readonly inviteLoading = signal(false);
  readonly inviteLink = signal('');
  readonly inviteError = signal<string | null>(null);

  async signOut(): Promise<void> {
    await this.authService.signOut();
    await this.router.navigate(['/login']);
  }

  async generateInviteLink(): Promise<void> {
    const adminUid = this.authService.currentUser()?.uid;
    if (!adminUid) {
      return;
    }

    this.inviteLoading.set(true);
    this.inviteError.set(null);

    try {
      const invite = await this.inviteService.createInvite(adminUid);
      const origin = window.location.origin;
      this.inviteLink.set(`${origin}/register/${invite.token}`);
    } catch {
      this.inviteError.set("Impossible de générer le lien d'invitation.");
    } finally {
      this.inviteLoading.set(false);
    }
  }
}
