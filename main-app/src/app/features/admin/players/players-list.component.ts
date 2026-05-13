import { Component, inject, signal, computed, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { PlayerService } from '../../../core/services/player.service';
import { Player, Gender } from '../../../core/models/player.model';

@Component({
  selector: 'app-players-list',
  standalone: true,
  template: `
    <div class="p-6">
      <h2 class="text-2xl font-bold text-gray-900 mb-6">Liste des membres</h2>

      <!-- Filters -->
      <div class="flex flex-wrap gap-4 mb-6">
        <div class="flex items-center gap-2">
          <label for="gender-filter" class="text-sm font-medium text-gray-700">
            Genre :
          </label>
          <select
            id="gender-filter"
            [value]="genderFilter()"
            (change)="onGenderFilterChange($event)"
            class="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Tous</option>
            <option value="homme">Masculin</option>
            <option value="femme">Féminin</option>
          </select>
        </div>

        <div class="flex items-center gap-2">
          <label for="sort-order" class="text-sm font-medium text-gray-700">
            Tri par nom :
          </label>
          <select
            id="sort-order"
            [value]="sortDirection()"
            (change)="onSortDirectionChange($event)"
            class="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="asc">A → Z</option>
            <option value="desc">Z → A</option>
          </select>
        </div>
      </div>

      <!-- Table -->
      @if (filteredSortedPlayers().length === 0) {
        <p class="text-gray-500 italic">Aucun membre trouvé.</p>
      } @else {
        <div class="overflow-x-auto rounded-lg border border-gray-200">
          <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-gray-50">
              <tr>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Nom
                </th>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Prénom
                </th>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Genre
                </th>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Statut
                </th>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">
              @for (player of filteredSortedPlayers(); track player.id) {
                <tr
                  class="hover:bg-gray-50 transition-colors"
                  [class.opacity-50]="!player.active"
                >
                  <td class="px-4 py-3 text-sm text-gray-900">{{ player.lastName }}</td>
                  <td class="px-4 py-3 text-sm text-gray-900">{{ player.firstName }}</td>
                  <td class="px-4 py-3 text-sm text-gray-600">
                    {{ player.gender === 'homme' ? 'Masculin' : 'Féminin' }}
                  </td>
                  <td class="px-4 py-3">
                    @if (player.active) {
                      <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        Actif
                      </span>
                    } @else {
                      <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                        Désactivé
                      </span>
                    }
                  </td>
                  <td class="px-4 py-3 flex gap-2">
                    <button
                      (click)="viewProfile(player.id)"
                      class="text-sm text-blue-600 hover:text-blue-800 font-medium"
                    >
                      Voir profil
                    </button>
                    @if (player.active) {
                      <button
                        (click)="deactivate(player.id)"
                        class="text-sm text-red-600 hover:text-red-800 font-medium"
                      >
                        Désactiver
                      </button>
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </div>
  `,
})
export class PlayersListComponent implements OnInit, OnDestroy {
  private readonly playerService = inject(PlayerService);
  private readonly router = inject(Router);

  private readonly allPlayers = signal<Player[]>([]);
  readonly genderFilter = signal<Gender | ''>('');
  readonly sortDirection = signal<'asc' | 'desc'>('asc');


  readonly filteredSortedPlayers = computed(() => {
    let players = this.allPlayers();
    const gf = this.genderFilter();

    if (gf !== '') {
      players = players.filter((p) => p.gender === gf);
    }

    const dir = this.sortDirection();
    return [...players].sort((a, b) => {
      const cmp = a.lastName.localeCompare(b.lastName, 'fr', { sensitivity: 'base' });
      return dir === 'asc' ? cmp : -cmp;
    });
  });

  private subscription?: Subscription;

  ngOnInit(): void {
    this.subscription = this.playerService.getPlayers().subscribe((players) => {
      this.allPlayers.set(players);
    });
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
  }

  onGenderFilterChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value as Gender | '';
    this.genderFilter.set(value);
  }

  onSortDirectionChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value as 'asc' | 'desc';
    this.sortDirection.set(value);
  }

  viewProfile(playerId: string): void {
    this.router.navigate(['/admin/players', playerId]);
  }

  async deactivate(playerId: string): Promise<void> {
    await this.playerService.deactivatePlayer(playerId);
  }
}
