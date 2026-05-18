import { Component, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { PlayerService } from '../../../core/services/player.service';
import { StatsService } from '../../../core/services/stats.service';
import { Player } from '../../../core/models/player.model';
import { PlayerStats } from '../../../core/models/stats.model';
import { GAME_TYPE_LABELS } from '../../../core/models/registration.model';

@Component({
  selector: 'app-player-profile',
  standalone: true,
  imports: [RouterLink],
  template: `
    <header class="bg-white shadow-sm mb-6">
      <div class="max-w-2xl mx-auto px-4 py-3 flex justify-between items-center">
        <span class="font-bold text-gray-900">BadTournoi</span>
        <a [routerLink]="['/player', playerId, 'tournaments']" class="text-sm text-blue-600 hover:text-blue-800 font-medium">Mes tournois</a>
      </div>
    </header>
    <div class="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div class="bg-white rounded-2xl shadow-lg p-8 w-full max-w-2xl">
        @if (loading()) {
          <div class="text-center text-gray-500">Chargement…</div>
        } @else if (!player()) {
          <div class="text-center">
            <h1 class="text-xl font-bold text-gray-900 mb-2">Profil introuvable</h1>
            <p class="text-gray-500">Ce lien de profil est invalide.</p>
          </div>
        } @else {
          <div>
            <!-- Player identity -->
            <h1 class="text-2xl font-bold text-gray-900 mb-1">
              {{ player()!.firstName }} {{ player()!.lastName }}
            </h1>
            <p class="text-gray-500 mb-4 capitalize">{{ player()!.gender }}</p>
            <div class="bg-gray-50 rounded-lg p-4 mb-6">
              <p class="text-xs text-gray-400">Votre lien personnel :</p>
              <p class="text-sm text-blue-600 break-all mt-1">{{ personalLink() }}</p>
            </div>

            <!-- Statistics section -->
            @if (stats()) {
              <div class="space-y-6">
                <!-- Global stats -->
                <div>
                  <h2 class="text-lg font-semibold text-gray-800 mb-3">Bilan global</h2>
                  <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <div class="bg-blue-50 rounded-lg p-3 text-center">
                      <p class="text-2xl font-bold text-blue-700">{{ stats()!.global.played }}</p>
                      <p class="text-xs text-gray-500 mt-1">Matchs joués</p>
                    </div>
                    <div class="bg-green-50 rounded-lg p-3 text-center">
                      <p class="text-2xl font-bold text-green-700">{{ stats()!.global.wins }}</p>
                      <p class="text-xs text-gray-500 mt-1">Victoires</p>
                    </div>
                    <div class="bg-red-50 rounded-lg p-3 text-center">
                      <p class="text-2xl font-bold text-red-700">{{ stats()!.global.losses }}</p>
                      <p class="text-xs text-gray-500 mt-1">Défaites</p>
                    </div>
                    <div class="bg-purple-50 rounded-lg p-3 text-center">
                      <p class="text-2xl font-bold text-purple-700">{{ stats()!.global.winRate }}%</p>
                      <p class="text-xs text-gray-500 mt-1">% victoires</p>
                    </div>
                  </div>
                </div>

                <!-- Stats by game type -->
                @if (stats()!.byGameType.length > 0) {
                  <div>
                    <h2 class="text-lg font-semibold text-gray-800 mb-3">Par type de jeu</h2>
                    <div class="space-y-2">
                      @for (gt of stats()!.byGameType; track gt.gameType) {
                        <div class="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-3">
                          <span class="text-sm font-medium text-gray-700">{{ gameTypeLabel(gt.gameType) }}</span>
                          <div class="flex gap-4 text-sm text-gray-600">
                            <span>{{ gt.played }} joués</span>
                            <span class="text-green-600 font-medium">{{ gt.wins }}V</span>
                            <span class="text-red-600 font-medium">{{ gt.losses }}D</span>
                            <span class="text-purple-600 font-medium">{{ gt.winRate }}%</span>
                          </div>
                        </div>
                      }
                    </div>
                  </div>
                }

                <!-- Tournament history -->
                @if (stats()!.tournaments.length > 0) {
                  <div>
                    <h2 class="text-lg font-semibold text-gray-800 mb-3">Historique des tournois</h2>
                    <div class="space-y-2">
                      @for (t of stats()!.tournaments; track t.tournamentId) {
                        <div class="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-3">
                          <div>
                            <p class="text-sm font-medium text-gray-800">{{ t.name }}</p>
                            <p class="text-xs text-gray-400 mt-0.5">{{ t.date }}</p>
                          </div>
                          <div class="flex items-center gap-2">
                            <span class="text-xs text-gray-400 capitalize">{{ t.phase }}</span>
                            <span
                              class="inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold"
                              [class]="rankBadgeClass(t.finalRank)"
                            >
                              {{ t.finalRank }}
                            </span>
                          </div>
                        </div>
                      }
                    </div>
                  </div>
                } @else if (stats()!.global.played === 0) {
                  <div class="text-center text-gray-400 py-4 text-sm">
                    Aucun tournoi joué pour le moment.
                  </div>
                }
              </div>
            }
          </div>
        }
      </div>
    </div>
  `,
})
export class PlayerProfileComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly playerService = inject(PlayerService);
  private readonly statsService = inject(StatsService);

  playerId = '';

  readonly loading = signal(true);
  readonly player = signal<Player | null>(null);
  readonly personalLink = signal('');
  readonly stats = signal<PlayerStats | null>(null);

  private statsSubscription?: Subscription;

  async ngOnInit(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('id') ?? '';
    this.playerId = id;

    if (!id) {
      this.loading.set(false);
      return;
    }

    const foundPlayer = await this.playerService.getPlayer(id);
    this.player.set(foundPlayer);
    this.personalLink.set(`${window.location.origin}/player/${id}`);
    this.loading.set(false);

    if (foundPlayer) {
      this.statsSubscription = this.statsService.getPlayerStats(id).subscribe((playerStats) => {
        this.stats.set(playerStats);
      });
    }
  }

  ngOnDestroy(): void {
    this.statsSubscription?.unsubscribe();
  }

  gameTypeLabel(gameType: string): string {
    return GAME_TYPE_LABELS[gameType as keyof typeof GAME_TYPE_LABELS] ?? gameType;
  }

  rankBadgeClass(rank: number): string {
    if (rank === 1) return 'bg-yellow-400 text-yellow-900';
    if (rank === 2) return 'bg-gray-300 text-gray-700';
    if (rank === 3) return 'bg-amber-600 text-white';
    return 'bg-gray-100 text-gray-600';
  }
}
