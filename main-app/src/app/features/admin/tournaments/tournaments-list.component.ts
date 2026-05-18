import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { TournamentService } from '../../../core/services/tournament.service';
import { Tournament, TournamentStatus } from '../../../core/models/tournament.model';

@Component({
  selector: 'app-tournaments-list',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div>
      <div class="flex justify-between items-center mb-6">
        <h2 class="text-xl font-semibold text-gray-900">Tournois</h2>
        <a
          routerLink="/admin/tournaments/new"
          class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
        >
          Créer un tournoi
        </a>
      </div>

      @if (tournaments() === undefined) {
        <p class="text-gray-500 text-sm">Chargement…</p>
      } @else if (tournaments()!.length === 0) {
        <div class="bg-white rounded-2xl shadow-sm p-8 text-center">
          <p class="text-gray-500">Aucun tournoi créé pour l'instant.</p>
        </div>
      } @else {
        <div class="flex flex-col gap-4">
          @for (tournament of tournaments(); track tournament.id) {
            <div class="bg-white rounded-2xl shadow-sm p-5">
              <div class="flex justify-between items-start mb-3">
                <div>
                  <h3 class="text-base font-semibold text-gray-900">{{ tournament.name }}</h3>
                  <p class="text-sm text-gray-500 mt-0.5">{{ tournament.date }}</p>
                </div>
                <span [class]="statusBadgeClass(tournament.status)">
                  {{ tournament.status }}
                </span>
              </div>

              @if (tournament.gameTypes && tournament.gameTypes.length > 0) {
                <div class="flex flex-wrap gap-1.5 mb-3">
                  @for (gt of tournament.gameTypes; track gt) {
                    <span class="px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-600 font-medium">
                      {{ gt }}
                    </span>
                  }
                </div>
              }

              <div class="flex flex-wrap gap-3 mt-3 pt-3 border-t border-gray-100">
                @if (tournament.status === 'Brouillon') {
                  <a
                    [routerLink]="['/admin/tournaments', tournament.id, 'pool-config']"
                    class="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline"
                  >
                    Configurer les poules
                  </a>
                  <a
                    [routerLink]="['/admin/tournaments', tournament.id, 'publish']"
                    class="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline"
                  >
                    Publier
                  </a>
                }
                @if (tournament.status === 'Inscriptions ouvertes') {
                  <a
                    [routerLink]="['/admin/tournaments', tournament.id, 'registrations']"
                    class="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline"
                  >
                    Inscriptions
                  </a>
                  <a
                    [routerLink]="['/admin/tournaments', tournament.id, 'close']"
                    class="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline"
                  >
                    Clôturer les inscriptions
                  </a>
                }
                @if (tournament.status === 'Inscriptions clôturées') {
                  <a
                    [routerLink]="['/admin/tournaments', tournament.id, 'pairing']"
                    class="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline"
                  >
                    Appariement
                  </a>
                  <a
                    [routerLink]="['/admin/tournaments', tournament.id, 'pool-draw']"
                    class="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline"
                  >
                    Tirage des poules
                  </a>
                }
                @if (tournament.status === 'Terminé') {
                  <a
                    [routerLink]="['/admin/tournaments', tournament.id, 'bracket']"
                    class="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline"
                  >
                    Tableau final
                  </a>
                }
              </div>
            </div>
          }
        </div>
      }
    </div>
  `,
})
export class TournamentsListComponent {
  private readonly tournamentService = inject(TournamentService);

  readonly tournaments = toSignal(this.tournamentService.getTournaments());

  statusBadgeClass(status: TournamentStatus): string {
    const base = 'px-2.5 py-0.5 text-xs font-semibold rounded-full';
    switch (status) {
      case 'Brouillon':
        return `${base} bg-gray-100 text-gray-600`;
      case 'Inscriptions ouvertes':
        return `${base} bg-green-100 text-green-700`;
      case 'Inscriptions clôturées':
        return `${base} bg-yellow-100 text-yellow-700`;
      case 'En cours':
        return `${base} bg-blue-100 text-blue-700`;
      case 'Terminé':
        return `${base} bg-purple-100 text-purple-700`;
      default:
        return `${base} bg-gray-100 text-gray-600`;
    }
  }
}
