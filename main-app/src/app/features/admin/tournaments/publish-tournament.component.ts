import { Component, inject, signal, input } from '@angular/core';
import { TournamentService } from '../../../core/services/tournament.service';

@Component({
  selector: 'app-publish-tournament',
  standalone: true,
  template: `
    <div class="bg-white rounded-2xl shadow-sm p-6">
      <h2 class="text-xl font-semibold text-gray-900 mb-2">Publication du tournoi</h2>
      <p class="text-gray-500 text-sm mb-4">
        Publiez le tournoi pour permettre aux joueurs de s'inscrire. Le statut passera de
        <strong>Brouillon</strong> à <strong>Inscriptions ouvertes</strong>.
      </p>

      @if (!showConfirm() && !participationLink()) {
        <button
          (click)="requestConfirm()"
          [disabled]="loading()"
          class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Publier le tournoi
        </button>
      }

      @if (showConfirm() && !participationLink()) {
        <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
          <p class="text-sm text-yellow-800 font-medium mb-3">
            Confirmer la publication ? Cette action ouvrira les inscriptions.
          </p>
          <div class="flex gap-3">
            <button
              (click)="confirm()"
              [disabled]="loading()"
              class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
            >
              @if (loading()) {
                Publication en cours…
              } @else {
                Confirmer
              }
            </button>
            <button
              (click)="cancel()"
              [disabled]="loading()"
              class="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
            >
              Annuler
            </button>
          </div>
        </div>
      }

      @if (participationLink()) {
        <div class="bg-green-50 border border-green-200 rounded-lg p-4">
          <p class="text-sm text-green-700 font-medium mb-1">
            Tournoi publié ! Lien de participation :
          </p>
          <p class="text-sm text-green-600 break-all font-mono">{{ participationLink() }}</p>
          <p class="text-xs text-green-500 mt-2">
            Partagez ce lien avec les joueurs pour qu'ils puissent s'inscrire.
          </p>
        </div>
      }

      @if (error()) {
        <div class="mt-4 bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">
          {{ error() }}
        </div>
      }
    </div>
  `,
})
export class PublishTournamentComponent {
  readonly tournamentId = input.required<string>();

  private readonly tournamentService = inject(TournamentService);

  readonly loading = signal(false);
  readonly showConfirm = signal(false);
  readonly participationLink = signal('');
  readonly error = signal<string | null>(null);

  requestConfirm(): void {
    this.showConfirm.set(true);
    this.error.set(null);
  }

  cancel(): void {
    this.showConfirm.set(false);
  }

  async confirm(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);

    try {
      const token = await this.tournamentService.publishTournament(this.tournamentId());
      const origin = window.location.origin;
      this.participationLink.set(`${origin}/tournament/${token}/register`);
      this.showConfirm.set(false);
    } catch {
      this.error.set('Impossible de publier le tournoi. Veuillez réessayer.');
    } finally {
      this.loading.set(false);
    }
  }
}
