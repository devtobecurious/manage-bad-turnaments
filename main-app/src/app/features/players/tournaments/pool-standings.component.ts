import {
  Component,
  inject,
  signal,
  computed,
  input,
  OnInit,
  OnDestroy,
} from '@angular/core';
import { Subscription, combineLatest, firstValueFrom } from 'rxjs';
import { StandingsService } from '../../../core/services/standings.service';
import { MatchService } from '../../../core/services/match.service';
import { TournamentService } from '../../../core/services/tournament.service';
import { PoolService } from '../../../core/services/pool.service';
import { PoolStanding } from '../../../core/models/standings.model';
import { Match } from '../../../core/models/match.model';
import { Pool } from '../../../core/models/pool.model';
import { Tournament } from '../../../core/models/tournament.model';

@Component({
  selector: 'app-pool-standings',
  standalone: true,
  template: `
    <div class="min-h-screen bg-gray-50 p-4">
      <div class="max-w-3xl mx-auto space-y-6">

        @if (loading()) {
          <div class="text-center text-gray-500 py-12">Chargement…</div>
        } @else if (error()) {
          <div class="bg-red-50 border border-red-200 rounded-xl p-6 text-red-700 text-sm">
            {{ error() }}
          </div>
        } @else {
          <!-- Header -->
          <div>
            <h1 class="text-2xl font-bold text-gray-900">Classement de la poule</h1>
            <p class="text-sm text-gray-500 mt-1">
              Tournoi : {{ tournament()?.name ?? tournamentId() }} —
              Poule {{ pool()?.poolNumber ?? poolId() }}
            </p>
          </div>

          <!-- Standings table -->
          <div class="bg-white rounded-2xl shadow-sm overflow-hidden">
            <div class="px-4 py-3 border-b border-gray-100">
              <h2 class="text-base font-semibold text-gray-900">Classement en temps réel</h2>
              @if (qualifiersPerPool() > 0) {
                <p class="text-xs text-gray-500 mt-0.5">
                  Les {{ qualifiersPerPool() }} premier{{ qualifiersPerPool() > 1 ? 's' : '' }}
                  se qualifient pour la phase finale
                </p>
              }
            </div>

            @if (standings().length === 0) {
              <div class="px-4 py-8 text-center text-gray-400 text-sm">
                Aucun classement disponible pour le moment.
              </div>
            } @else {
              <div class="overflow-x-auto">
                <table class="w-full text-sm">
                  <thead>
                    <tr class="border-b border-gray-100 bg-gray-50">
                      <th class="text-left px-4 py-3 font-medium text-gray-600 w-10">#</th>
                      <th class="text-left px-4 py-3 font-medium text-gray-600">Joueur</th>
                      <th class="text-center px-3 py-3 font-medium text-gray-600">V</th>
                      <th class="text-center px-3 py-3 font-medium text-gray-600">D</th>
                      <th class="text-center px-3 py-3 font-medium text-gray-600">Pts</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (standing of rankedStandings(); track standing.participantId) {
                      <tr
                        class="border-b border-gray-50 last:border-0 transition-colors"
                        [class.bg-green-50]="standing.qualified"
                        [class.hover:bg-green-100]="standing.qualified"
                        [class.hover:bg-gray-50]="!standing.qualified"
                      >
                        <td class="px-4 py-3 font-semibold" [class.text-green-700]="standing.qualified" [class.text-gray-700]="!standing.qualified">
                          @if (standing.qualified) {
                            <span class="inline-flex items-center justify-center w-6 h-6 rounded-full bg-green-100 text-green-700 text-xs font-bold">
                              {{ standing.rank }}
                            </span>
                          } @else {
                            {{ standing.rank }}
                          }
                        </td>
                        <td class="px-4 py-3" [class.font-medium]="standing.qualified" [class.text-green-800]="standing.qualified" [class.text-gray-800]="!standing.qualified">
                          {{ standing.name }}
                          @if (standing.qualified) {
                            <span class="ml-2 text-xs text-green-600 font-normal">Qualifié</span>
                          }
                        </td>
                        <td class="px-3 py-3 text-center text-gray-700">{{ standing.victories }}</td>
                        <td class="px-3 py-3 text-center text-gray-700">{{ standing.defeats }}</td>
                        <td class="px-3 py-3 text-center font-semibold" [class.text-green-700]="standing.qualified" [class.text-gray-900]="!standing.qualified">
                          {{ standing.totalPoints }}
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            }
          </div>

          <!-- Played matches -->
          @if (playedMatches().length > 0) {
            <div class="bg-white rounded-2xl shadow-sm overflow-hidden">
              <div class="px-4 py-3 border-b border-gray-100">
                <h2 class="text-base font-semibold text-gray-900">
                  Matchs joués
                  <span class="ml-2 text-xs font-normal text-gray-400">({{ playedMatches().length }})</span>
                </h2>
              </div>
              <div class="divide-y divide-gray-50">
                @for (match of playedMatches(); track match.id) {
                  <div class="px-4 py-3 flex items-center justify-between gap-4">
                    <div class="flex items-center gap-3 flex-1 min-w-0">
                      <span
                        class="text-sm truncate flex-1 text-right"
                        [class.font-semibold]="match.winnerId === match.participantA.id"
                        [class.text-indigo-700]="match.winnerId === match.participantA.id"
                        [class.text-gray-600]="match.winnerId !== match.participantA.id"
                      >
                        {{ match.participantA.name }}
                      </span>

                      @if (match.forfeitParticipantId) {
                        <span class="text-xs text-orange-600 font-medium shrink-0 px-2">Forfait</span>
                      } @else if (match.sets && match.sets.length > 0) {
                        <div class="flex flex-col items-center gap-0.5 shrink-0">
                          @for (set of match.sets; track $index) {
                            <span class="text-xs font-mono text-gray-600 bg-gray-50 px-1.5 py-0.5 rounded">
                              {{ set.a }}-{{ set.b }}
                            </span>
                          }
                        </div>
                      } @else {
                        <span class="text-gray-400 text-xs font-semibold shrink-0">VS</span>
                      }

                      <span
                        class="text-sm truncate flex-1"
                        [class.font-semibold]="match.winnerId === match.participantB.id"
                        [class.text-indigo-700]="match.winnerId === match.participantB.id"
                        [class.text-gray-600]="match.winnerId !== match.participantB.id"
                      >
                        {{ match.participantB.name }}
                      </span>
                    </div>
                    <span class="px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full shrink-0">
                      Joué
                    </span>
                  </div>
                }
              </div>
            </div>
          }

          <!-- Upcoming matches -->
          @if (pendingMatches().length > 0) {
            <div class="bg-white rounded-2xl shadow-sm overflow-hidden">
              <div class="px-4 py-3 border-b border-gray-100">
                <h2 class="text-base font-semibold text-gray-900">
                  Matchs à venir
                  <span class="ml-2 text-xs font-normal text-gray-400">({{ pendingMatches().length }})</span>
                </h2>
              </div>
              <div class="divide-y divide-gray-50">
                @for (match of pendingMatches(); track match.id) {
                  <div class="px-4 py-3 flex items-center justify-between gap-4">
                    <div class="flex items-center gap-3 flex-1 min-w-0">
                      <span class="text-sm text-gray-800 truncate flex-1 text-right">
                        {{ match.participantA.name }}
                      </span>
                      <span class="text-gray-400 text-xs font-semibold shrink-0">VS</span>
                      <span class="text-sm text-gray-800 truncate flex-1">
                        {{ match.participantB.name }}
                      </span>
                    </div>
                    <span class="px-2 py-1 bg-yellow-100 text-yellow-700 text-xs font-medium rounded-full shrink-0">
                      À jouer
                    </span>
                  </div>
                }
              </div>
            </div>
          }
        }
      </div>
    </div>
  `,
})
export class PoolStandingsComponent implements OnInit, OnDestroy {
  readonly playerId = input<string>();
  readonly tournamentId = input.required<string>();
  readonly poolId = input.required<string>();

  private readonly standingsService = inject(StandingsService);
  private readonly matchService = inject(MatchService);
  private readonly tournamentService = inject(TournamentService);
  private readonly poolService = inject(PoolService);

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  readonly standings = signal<PoolStanding[]>([]);
  readonly matches = signal<Match[]>([]);
  readonly tournament = signal<Tournament | null>(null);
  readonly pool = signal<Pool | null>(null);

  readonly qualifiersPerPool = computed<number>(() => {
    const t = this.tournament();
    const p = this.pool();
    if (!t || !p || !t.poolConfig) return 0;
    const config = t.poolConfig.find((c) => c.gameType === p.gameType);
    return config?.qualifiersPerPool ?? 0;
  });

  readonly rankedStandings = computed<PoolStanding[]>(() => {
    const q = this.qualifiersPerPool();
    return this.standings()
      .slice()
      .sort((a, b) => a.rank - b.rank)
      .map((s) => ({ ...s, qualified: q > 0 && s.rank <= q }));
  });

  readonly playedMatches = computed<Match[]>(() =>
    this.matches().filter((m) => m.status === 'played')
  );

  readonly pendingMatches = computed<Match[]>(() =>
    this.matches().filter((m) => m.status === 'pending')
  );

  private subscription: Subscription | null = null;

  async ngOnInit(): Promise<void> {
    const tournamentId = this.tournamentId();
    const poolId = this.poolId();

    try {
      // Load tournament and pool data (for qualifiersPerPool and pool number)
      const [tournament, allPools] = await Promise.all([
        this.tournamentService.getTournament(tournamentId),
        firstValueFrom(this.poolService.getPools(tournamentId)),
      ]);
      const pools = allPools.find((p) => p.id === poolId) ?? null;

      this.tournament.set(tournament);
      this.pool.set(pools);

      // Subscribe to real-time standings and matches
      this.subscription = combineLatest([
        this.standingsService.getPoolStandings(tournamentId, poolId),
        this.matchService.getMatchesForPool(tournamentId, poolId),
      ]).subscribe({
        next: ([standings, matches]) => {
          this.standings.set(standings);
          this.matches.set(matches);
          this.loading.set(false);
        },
        error: () => {
          this.error.set('Impossible de charger les données de la poule.');
          this.loading.set(false);
        },
      });
    } catch {
      this.error.set('Impossible de charger les données de la poule.');
      this.loading.set(false);
    }
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
  }
}
