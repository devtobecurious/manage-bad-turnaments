import { Component, inject, signal, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PlayerService, RegisterPlayerData } from '../../../core/services/player.service';
import { InviteService } from '../../../core/services/invite.service';
import { AuthService } from '../../../core/services/auth.service';
import { Player, Gender } from '../../../core/models/player.model';

@Component({
  selector: 'app-player-form',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="bg-white rounded-xl shadow p-6">
      <h2 class="text-xl font-semibold text-gray-800 mb-4">Ajouter un joueur</h2>

      @if (createdPlayer()) {
        <div class="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
          <p class="text-green-800 font-medium mb-2">Joueur créé avec succès !</p>
          <p class="text-sm text-gray-600 mb-2">Lien d'invitation :</p>
          <div class="flex items-center gap-2">
            <input
              type="text"
              readonly
              [value]="inviteLink()"
              class="flex-1 text-sm bg-gray-100 border border-gray-300 rounded px-3 py-2 text-gray-700"
            />
            <button
              (click)="copyLink()"
              class="px-3 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
            >
              {{ copied() ? 'Copié !' : 'Copier' }}
            </button>
          </div>
          <button
            (click)="resetForm()"
            class="mt-3 text-sm text-blue-600 hover:underline"
          >
            Ajouter un autre joueur
          </button>
        </div>
      } @else {
        <form (ngSubmit)="onSubmit()" #playerForm="ngForm" novalidate>
          <div class="mb-4">
            <label for="firstName" class="block text-sm font-medium text-gray-700 mb-1">
              Prénom <span class="text-red-500">*</span>
            </label>
            <input
              id="firstName"
              name="firstName"
              type="text"
              [(ngModel)]="formData.firstName"
              required
              class="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Prénom du joueur"
            />
          </div>

          <div class="mb-4">
            <label for="lastName" class="block text-sm font-medium text-gray-700 mb-1">
              Nom <span class="text-red-500">*</span>
            </label>
            <input
              id="lastName"
              name="lastName"
              type="text"
              [(ngModel)]="formData.lastName"
              required
              class="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Nom du joueur"
            />
          </div>

          <div class="mb-6">
            <span class="block text-sm font-medium text-gray-700 mb-2">
              Genre <span class="text-red-500">*</span>
            </span>
            <div class="flex gap-6">
              <label class="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="gender"
                  value="homme"
                  [(ngModel)]="formData.gender"
                  required
                  class="w-4 h-4 text-blue-600"
                />
                <span class="text-gray-700">Homme</span>
              </label>
              <label class="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="gender"
                  value="femme"
                  [(ngModel)]="formData.gender"
                  required
                  class="w-4 h-4 text-blue-600"
                />
                <span class="text-gray-700">Femme</span>
              </label>
            </div>
          </div>

          @if (errorMessage()) {
            <p class="mb-4 text-sm text-red-600">{{ errorMessage() }}</p>
          }

          <button
            type="submit"
            [disabled]="isSubmitting() || !playerForm.valid"
            class="w-full py-2 px-4 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {{ isSubmitting() ? 'Création en cours...' : 'Créer le joueur' }}
          </button>
        </form>
      }
    </div>
  `,
})
export class PlayerFormComponent {
  private readonly playerService = inject(PlayerService);
  private readonly inviteService = inject(InviteService);
  private readonly authService = inject(AuthService);

  readonly playerCreated = output<Player>();

  formData: RegisterPlayerData = {
    firstName: '',
    lastName: '',
    gender: 'homme' as Gender,
  };

  readonly createdPlayer = signal<Player | null>(null);
  readonly inviteLink = signal<string>('');
  readonly isSubmitting = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly copied = signal(false);

  async onSubmit(): Promise<void> {
    if (!this.formData.firstName || !this.formData.lastName || !this.formData.gender) {
      return;
    }

    this.isSubmitting.set(true);
    this.errorMessage.set(null);

    try {
      const player = await this.playerService.registerPlayer(this.formData);
      const adminUid = this.authService.currentUser()?.uid ?? 'admin';
      const invite = await this.inviteService.createInvite(adminUid);
      const link = `${window.location.origin}/register/${invite.token}`;
      this.inviteLink.set(link);
      this.createdPlayer.set(player);
      this.playerCreated.emit(player);
    } catch {
      this.errorMessage.set('Une erreur est survenue lors de la création du joueur.');
    } finally {
      this.isSubmitting.set(false);
    }
  }

  async copyLink(): Promise<void> {
    const link = this.inviteLink();
    if (!link) return;

    await navigator.clipboard.writeText(link);
    this.copied.set(true);
    setTimeout(() => this.copied.set(false), 2000);
  }

  resetForm(): void {
    this.formData = { firstName: '', lastName: '', gender: 'homme' };
    this.createdPlayer.set(null);
    this.inviteLink.set('');
    this.errorMessage.set(null);
    this.copied.set(false);
  }
}
