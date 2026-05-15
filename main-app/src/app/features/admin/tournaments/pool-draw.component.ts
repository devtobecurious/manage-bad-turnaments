import { Component, inject, signal, computed, input, OnInit } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { TournamentService } from '../../../core/services/tournament.service';
import { RegistrationService } from '../../../core/services/registration.service';
import { PoolService } from '../../../core/services/pool.service';
import { PlayerService } from '../../../core/services/player.service';
import { Pool } from '../../../core/models/pool.model';
import {
  GameType,
  GAME_TYPES,
  GAME_TYPE_LABELS,
} from '../../../core/models/registration.model';
import { Player } from '../../../core/models/player.model';
import { Tournament } from '../../../core/models/tournament.model';

@Component({
  selector: 'app-pool-draw',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="max-w-4xl mx-auto p-6 space-y-6">
      <!-- Header -->
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-bold text-gray-900">Tirage des poules</h1>
          @if (tournament()) {
            <p class="text-sm text-gray-500 mt-1">{{ tournament()!.name }}</p>
          }
        </div>
        <a
          [routerLink]="['/admin/tournaments', tournamentId(), 'registrations']"
          class="text-sm text-indigo-600 hover:text-indigo-800"
        >
          Retour aux inscrits
        </a>
      </div>

      <!-- Error banner -->
      @if (globalError()) {
        <div class="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">
          {{ globalError() }}
        </div>
      }

      <!-- Tournament not in correct status warning -->
      @if (tournament() && !canDraw()) {
        <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p class="text-sm text-yellow-800 font-medium">
            Le tirage des poules n'est disponible que lorsque les inscriptions sont clôturées.
          </p>
          <p class="text-xs text-yellow-600 mt-1">Statut actuel : {{ tournament()!.status }}</p>
        </div>
      }

      @if (canDraw()) {
        <!-- Game type tabs -->
        <div class="flex gap-1 border-b border-gray-200 overflow-x-auto">
          @for (type of configuredGameTypes(); track type) {
            <button
              (click)="selectTab(type)"
              class="px-4 py-2 text-sm font-medium rounded-t-lg transition-colors whitespace-nowrap"
              [class.bg-indigo-600]="activeTab() === type"
              [class.text-white]="activeTab() === type"
              [class.text-gray-600]="activeTab() !== type"
              [class.hover:bg-gray-100]="activeTab() !== type"
            >
              {{ gameTypeLabels[type] }}
              @if (isTabLocked(type)) {
                <span class="ml-1 text-xs">&#10003;</span>
              }
            </button>
          }
        </div>

        @if (configuredGameTypes().length === 0) {
          <div class="bg-gray-50 rounded-lg p-6 text-center">
            <p class="text-gray-500">Aucun type de jeu configuré pour ce tournoi.</p>
          </div>
        }

        @if (activeTab() && configuredGameTypes().length > 0) {
          <div class="bg-white rounded-2xl shadow-sm p-6 space-y-4">
            <div class="flex items-center justify-between">
              <h2 class="text-lg font-semibold text-gray-900">
                {{ gameTypeLabels[activeTab()!] }}
              </h2>
              @if (isTabLocked(activeTab()!)) {
                <span class="px-3 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full">
                  Poules validées
                </span>
              }
            </div>

            <!-- Participant count info -->
            <p class="text-sm text-gray-500">
              <span class="font-semibold text-gray-800">{{ currentParticipantCount() }}</span>
              participant{{ currentParticipantCount() > 1 ? 's' : '' }} inscrit{{ currentParticipantCount() > 1 ? 's' : '' }}
              — {{ poolCountForTab() }} poule{{ poolCountForTab() > 1 ? 's' : '' }} configurée{{ poolCountForTab() > 1 ? 's' : '' }}
            </p>

            <!-- Draw actions (only when not locked) -->
            @if (!isTabLocked(activeTab()!)) {
              <div class="flex gap-3 flex-wrap">
                <button
                  (click)="drawPools()"
                  [disabled]="drawing() || locking()"
                  class="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  @if (drawing()) {
                    Tirage en cours…
                  } @else if (currentPools().length > 0) {
                    Relancer le tirage
                  } @else {
                    Lancer le tirage
                  }
                </button>

                @if (currentPools().length > 0) {
                  <button
                    (click)="validatePools()"
                    [disabled]="drawing() || locking()"
                    class="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    @if (locking()) {
                      Validation en cours…
                    } @else {
                      Valider les poules
                    }
                  </button>
                }
              </div>
            }

            @if (drawError()) {
              <p class="text-sm text-red-600">{{ drawError() }}</p>
            }

            <!-- Pools display -->
            @if (currentPools().length > 0) {
              <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
                @for (pool of currentPools(); track pool.poolNumber) {
                  <div class="border border-gray-200 rounded-xl p-4">
                    <div class="flex items-center justify-between mb-3">
                      <h3 class="text-sm font-semibold text-gray-800">
                        Poule {{ pool.poolNumber }}
                      </h3>
                      <span class="text-xs text-gray-400">{{ pool.memberIds.length }} participant{{ pool.memberIds.length > 1 ? 's' : '' }}</span>
                    </div>
                    <ul class="space-y-1">
                      @for (playerId of pool.memberIds; track playerId) {
                        <li class="text-sm text-gray-700 flex items-center gap-2">
                          <span class="w-1.5 h-1.5 bg-indigo-400 rounded-full flex-shrink-0"></span>
                          {{ playerName(playerId) }}
                        </li>
                      }
                    </ul>
                  </div>
                }
              </div>
            } @else if (!drawing()) {
              <div class="text-center py-8 text-gray-400 text-sm">
                Aucune poule générée. Cliquez sur "Lancer le tirage" pour commencer.
              </div>
            }
          </div>
        }
      }
    </div>
  `,
})
export class PoolDrawComponent implements OnInit {
  readonly tournamentId = input.required<string>();

  private readonly tournamentService = inject(TournamentService);
  private readonly registrationService = inject(RegistrationService);
  private readonly poolService = inject(PoolService);
  private readonly playerService = inject(PlayerService);

  readonly gameTypeLabels = GAME_TYPE_LABELS;

  readonly tournament = signal<Tournament | null>(null);
  readonly activeTab = signal<GameType | null>(null);
  readonly drawing = signal(false);
  readonly locking = signal(false);
  readonly drawError = signal<string | null>(null);
  readonly globalError = signal<string | null>(null);

  /** In-memory pools for the current draw (before or after saving) */
  readonly currentPools = signal<Pool[]>([]);

  /** Tracks which game types have been locked */
  readonly lockedGameTypes = signal<Set<GameType>>(new Set());

  private readonly allPlayers = toSignal(this.playerService.getPlayers(), { initialValue: [] as Player[] });

  /** Participant IDs per game type, loaded from registrations */
  private readonly participantsByType = signal<Record<string, string[]>>({});

  readonly canDraw = computed(() => {
    const t = this.tournament();
    return t?.status === 'Inscriptions clôturées' || t?.status === 'En cours';
  });

  readonly configuredGameTypes = computed((): GameType[] => {
    const t = this.tournament();
    if (!t?.poolConfig) return [];
    return t.poolConfig.map((c) => c.gameType as GameType);
  });

  readonly currentParticipantCount = computed(() => {
    const tab = this.activeTab();
    if (!tab) return 0;
    return (this.participantsByType()[tab] ?? []).length;
  });

  readonly poolCountForTab = computed(() => {
    const tab = this.activeTab();
    if (!tab || !this.tournament()?.poolConfig) return 0;
    const config = this.tournament()!.poolConfig!.find((c) => c.gameType === tab);
    return config?.poolCount ?? 0;
  });

  async ngOnInit(): Promise<void> {
    try {
      const t = await this.tournamentService.getTournament(this.tournamentId());
      this.tournament.set(t);

      if (t && t.gameTypes && t.gameTypes.length > 0) {
        // Load registrations per game type
        for (const gameType of GAME_TYPES) {
          if (t.gameTypes.includes(gameType as any)) {
            this.registrationService.getRegistrations(this.tournamentId(), gameType).subscribe(
              (regs) => {
                this.participantsByType.update((current) => ({
                  ...current,
                  [gameType]: regs.map((r) => r.playerId),
                }));
              }
            );
          }
        }

        // Set default tab to first configured game type
        if (t.poolConfig && t.poolConfig.length > 0) {
          this.activeTab.set(t.poolConfig[0].gameType as GameType);
        }

        // Load existing pools and locked state
        await this.loadExistingPoolsAndLockedState(t);
      }
    } catch {
      this.globalError.set('Impossible de charger le tournoi.');
    }
  }

  private async loadExistingPoolsAndLockedState(tournament: Tournament): Promise<void> {
    if (!tournament.poolConfig) return;

    const lockedSet = new Set<GameType>();

    for (const config of tournament.poolConfig) {
      const gameType = config.gameType as GameType;
      this.poolService.getPools(this.tournamentId(), gameType).subscribe((pools) => {
        const anyLocked = pools.some((p) => p.locked);
        if (anyLocked) {
          this.lockedGameTypes.update((s) => {
            const next = new Set(s);
            next.add(gameType);
            return next;
          });
        }
        // If this is the current active tab and it's not locked, show existing pools
        if (gameType === this.activeTab() && !anyLocked && pools.length > 0) {
          this.currentPools.set(pools);
        }
      });
    }
  }

  selectTab(gameType: GameType): void {
    this.activeTab.set(gameType);
    this.drawError.set(null);
    this.currentPools.set([]);

    // Load existing pools for this tab if available
    this.poolService.getPools(this.tournamentId(), gameType).subscribe((pools) => {
      if (pools.length > 0) {
        this.currentPools.set(pools);
      }
    });
  }

  isTabLocked(gameType: GameType): boolean {
    return this.lockedGameTypes().has(gameType);
  }

  async drawPools(): Promise<void> {
    const tab = this.activeTab();
    if (!tab) return;

    const participants = this.participantsByType()[tab] ?? [];
    const poolCount = this.poolCountForTab();

    if (poolCount <= 0) {
      this.drawError.set('Le nombre de poules n\'est pas configuré pour ce type de jeu.');
      return;
    }

    this.drawing.set(true);
    this.drawError.set(null);

    try {
      const generatedPools = this.poolService.generatePools(
        this.tournamentId(),
        tab,
        poolCount,
        participants
      );

      // Save to Firestore immediately to persist the draw
      const saved = await this.poolService.savePools(generatedPools);
      this.currentPools.set(saved);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Impossible de générer les poules.';
      this.drawError.set(message);
    } finally {
      this.drawing.set(false);
    }
  }

  async validatePools(): Promise<void> {
    const tab = this.activeTab();
    if (!tab) return;

    this.locking.set(true);
    this.drawError.set(null);

    try {
      await this.poolService.lockPools(this.tournamentId(), tab);

      this.lockedGameTypes.update((s) => {
        const next = new Set(s);
        next.add(tab);
        return next;
      });

      // Reload tournament to check if status changed
      const updated = await this.tournamentService.getTournament(this.tournamentId());
      if (updated) {
        this.tournament.set(updated);
      }
    } catch {
      this.drawError.set('Impossible de valider les poules. Veuillez réessayer.');
    } finally {
      this.locking.set(false);
    }
  }

  playerName(playerId: string): string {
    const player = this.allPlayers().find((p) => p.id === playerId);
    return player ? `${player.lastName} ${player.firstName}` : playerId;
  }
}
