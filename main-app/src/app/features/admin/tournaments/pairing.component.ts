import {
  Component,
  inject,
  signal,
  computed,
  input,
  OnInit,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { PairingService } from '../../../core/services/pairing.service';
import { RegistrationService } from '../../../core/services/registration.service';
import { PlayerService } from '../../../core/services/player.service';
import { Pair } from '../../../core/models/pairing.model';
import {
  GameType,
  DOUBLE_GAME_TYPES,
  GAME_TYPE_LABELS,
} from '../../../core/models/registration.model';
import { Player } from '../../../core/models/player.model';

interface PairWithIndex extends Pair {
  index: number;
}

@Component({
  selector: 'app-pairing',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="bg-white rounded-2xl shadow-sm p-6">
      <h2 class="text-xl font-semibold text-gray-900 mb-6">Formation des paires</h2>

      <!-- Tabs — doubles only -->
      <div class="flex gap-1 border-b border-gray-200 mb-6 overflow-x-auto">
        @for (type of doubleGameTypes; track type) {
          <button
            (click)="selectTab(type)"
            class="px-4 py-2 text-sm font-medium rounded-t-lg transition-colors whitespace-nowrap"
            [class.bg-indigo-600]="activeTab() === type"
            [class.text-white]="activeTab() === type"
            [class.text-gray-600]="activeTab() !== type"
            [class.hover:text-gray-900]="activeTab() !== type"
            [class.hover:bg-gray-100]="activeTab() !== type"
          >
            {{ gameTypeLabels[type] }}
          </button>
        }
      </div>

      <!-- Odd-count blocking alert -->
      @if (oddCountError()) {
        <div class="mb-4 bg-red-50 border border-red-300 rounded-lg p-4 flex items-start gap-3">
          <span class="text-red-500 text-lg leading-none">&#9888;</span>
          <div>
            <p class="text-sm font-bold text-red-800">Blocage — Nombre impair d'inscrits</p>
            <p class="text-sm text-red-600">{{ oddCountError() }}</p>
            <p class="text-xs text-red-500 mt-1">Ajoutez ou retirez un inscrit avant de lancer le tirage.</p>
          </div>
        </div>
      }

      <!-- Already locked notice -->
      @if (arePairsLocked()) {
        <div class="mb-4 bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3">
          <span class="text-green-600 text-lg">&#10003;</span>
          <p class="text-sm font-medium text-green-800">
            Les paires sont validées et figées. Aucune modification n'est possible.
          </p>
        </div>
      }

      <!-- Error message -->
      @if (generalError()) {
        <div class="mb-4 bg-red-50 border border-red-200 rounded-lg p-3">
          <p class="text-sm text-red-600">{{ generalError() }}</p>
        </div>
      }

      <!-- Action buttons -->
      @if (!arePairsLocked()) {
        <div class="flex flex-wrap gap-3 mb-6">
          <button
            (click)="onGeneratePairs()"
            [disabled]="loading() || !!oddCountError()"
            class="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            @if (loading()) {
              Tirage en cours…
            } @else if (inMemoryPairs().length > 0) {
              Relancer le tirage
            } @else {
              Lancer le tirage aléatoire
            }
          </button>

          @if (inMemoryPairs().length > 0) {
            <button
              (click)="onSavePairs()"
              [disabled]="saving()"
              class="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              @if (saving()) {
                Enregistrement…
              } @else {
                Enregistrer les paires
              }
            </button>

            <button
              (click)="onLockPairs()"
              [disabled]="locking()"
              class="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              @if (locking()) {
                Validation…
              } @else {
                Valider et figer les paires
              }
            </button>
          }
        </div>
      }

      <!-- Pairs list -->
      @if (displayedPairs().length === 0 && !loading()) {
        <p class="text-sm text-gray-400 py-8 text-center">
          Aucune paire formée pour ce type de jeu.
          @if (!arePairsLocked() && !oddCountError()) {
            <br />Lancez le tirage aléatoire.
          }
        </p>
      }

      <div class="space-y-3">
        @for (pair of displayedPairs(); track pair.id || pair.index) {
          <div
            class="flex items-center gap-3 p-4 border rounded-xl transition-colors"
            [class.border-green-300]="pair.locked"
            [class.bg-green-50]="pair.locked"
            [class.border-gray-200]="!pair.locked"
            [class.bg-white]="!pair.locked"
          >
            <span class="text-sm font-semibold text-gray-400 w-6 text-center">
              {{ pair.index + 1 }}
            </span>

            @if (!pair.locked && editingPairIndex() === pair.index) {
              <!-- Editing mode: swap player selects -->
              <div class="flex flex-1 items-center gap-2 flex-wrap">
                <select
                  [ngModel]="editPlayer1()"
                  (ngModelChange)="editPlayer1.set($event)"
                  class="flex-1 border border-gray-300 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 min-w-0"
                >
                  @for (player of availablePlayers(); track player.id) {
                    <option [value]="player.id">{{ player.lastName }} {{ player.firstName }}</option>
                  }
                </select>
                <span class="text-gray-400 text-sm font-medium">vs</span>
                <select
                  [ngModel]="editPlayer2()"
                  (ngModelChange)="editPlayer2.set($event)"
                  class="flex-1 border border-gray-300 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 min-w-0"
                >
                  @for (player of availablePlayers(); track player.id) {
                    <option [value]="player.id">{{ player.lastName }} {{ player.firstName }}</option>
                  }
                </select>
                <button
                  (click)="onConfirmEdit(pair.index)"
                  class="px-3 py-1 text-xs font-medium text-green-700 border border-green-300 rounded-lg hover:bg-green-50 transition-colors"
                >
                  OK
                </button>
                <button
                  (click)="cancelEdit()"
                  class="px-3 py-1 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Annuler
                </button>
              </div>
            } @else {
              <!-- Display mode -->
              <div class="flex flex-1 items-center gap-2">
                <span class="flex-1 text-sm font-medium text-gray-900">{{ playerName(pair.player1Id) }}</span>
                <span class="text-gray-400 text-sm font-medium">vs</span>
                <span class="flex-1 text-sm font-medium text-gray-900">{{ playerName(pair.player2Id) }}</span>
              </div>

              @if (pair.locked) {
                <span class="text-xs text-green-600 font-medium">Figée</span>
              } @else {
                <button
                  (click)="startEdit(pair)"
                  class="px-3 py-1 text-xs font-medium text-indigo-600 border border-indigo-200 rounded-lg hover:bg-indigo-50 transition-colors"
                >
                  Modifier
                </button>
              }
            }
          </div>
        }
      </div>
    </div>
  `,
})
export class PairingComponent implements OnInit {
  readonly tournamentId = input.required<string>();

  private readonly pairingService = inject(PairingService);
  private readonly registrationService = inject(RegistrationService);
  private readonly playerService = inject(PlayerService);

  readonly doubleGameTypes = DOUBLE_GAME_TYPES;
  readonly gameTypeLabels = GAME_TYPE_LABELS;

  readonly activeTab = signal<GameType>('double-homme');

  /** In-memory pairs (draft — not yet saved to Firestore) */
  readonly inMemoryPairs = signal<Pair[]>([]);

  /** Pairs loaded from Firestore for the current tab */
  readonly savedPairs = signal<Pair[]>([]);

  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly locking = signal(false);
  readonly generalError = signal<string | null>(null);
  readonly oddCountError = signal<string | null>(null);

  /** Index of the pair currently being edited (-1 = none) */
  readonly editingPairIndex = signal(-1);
  readonly editPlayer1 = signal('');
  readonly editPlayer2 = signal('');

  private readonly allPlayers = toSignal(this.playerService.getPlayers(), {
    initialValue: [] as Player[],
  });

  /** Registrations count for the current tab, used to detect odd count before drawing */
  private registrationCounts = signal<Record<GameType, number>>({
    'simple-homme': 0,
    'simple-femme': 0,
    'double-homme': 0,
    'double-femme': 0,
    'double-mixte': 0,
  });

  private registrationPlayerIds = signal<Record<GameType, string[]>>({
    'simple-homme': [],
    'simple-femme': [],
    'double-homme': [],
    'double-femme': [],
    'double-mixte': [],
  });

  /** Are all saved pairs locked? */
  readonly arePairsLocked = computed(() => {
    const saved = this.savedPairs();
    return saved.length > 0 && saved.every((p) => p.locked);
  });

  /**
   * Displayed pairs: in-memory draft takes priority; falls back to saved Firestore pairs.
   * Each pair is augmented with a positional index for the template.
   */
  readonly displayedPairs = computed((): PairWithIndex[] => {
    const source = this.inMemoryPairs().length > 0 ? this.inMemoryPairs() : this.savedPairs();
    return source.map((p, i) => ({ ...p, index: i }));
  });

  readonly availablePlayers = computed(() => this.allPlayers().filter((p) => p.active));

  ngOnInit(): void {
    for (const gameType of DOUBLE_GAME_TYPES) {
      this.registrationService.getRegistrations(this.tournamentId(), gameType).subscribe((regs) => {
        this.registrationPlayerIds.update((current) => ({
          ...current,
          [gameType]: regs.map((r) => r.playerId),
        }));
        this.registrationCounts.update((current) => ({
          ...current,
          [gameType]: regs.length,
        }));
      });
    }

    // Load pairs for the initial tab
    this.loadPairsForCurrentTab();
  }

  private loadPairsForCurrentTab(): void {
    const tab = this.activeTab();
    this.pairingService.getPairs(this.tournamentId(), tab).subscribe((pairs) => {
      this.savedPairs.set(pairs);
    });
  }

  selectTab(gameType: GameType): void {
    this.activeTab.set(gameType);
    this.inMemoryPairs.set([]);
    this.generalError.set(null);
    this.oddCountError.set(null);
    this.editingPairIndex.set(-1);
    this.loadPairsForCurrentTab();
  }

  playerName(playerId: string): string {
    const player = this.allPlayers().find((p) => p.id === playerId);
    return player ? `${player.lastName} ${player.firstName}` : playerId;
  }

  onGeneratePairs(): void {
    const tab = this.activeTab();
    const playerIds = this.registrationPlayerIds()[tab];

    this.generalError.set(null);
    this.oddCountError.set(null);

    try {
      const pairs = this.pairingService.generatePairs(this.tournamentId(), tab, playerIds);
      this.inMemoryPairs.set(pairs);
      this.editingPairIndex.set(-1);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.oddCountError.set(message);
    }
  }

  async onSavePairs(): Promise<void> {
    this.saving.set(true);
    this.generalError.set(null);

    try {
      const pairs = this.inMemoryPairs();
      await this.pairingService.savePairs(this.tournamentId(), this.activeTab(), pairs);
      this.inMemoryPairs.set([]);
    } catch {
      this.generalError.set('Impossible d\'enregistrer les paires. Veuillez réessayer.');
    } finally {
      this.saving.set(false);
    }
  }

  async onLockPairs(): Promise<void> {
    this.locking.set(true);
    this.generalError.set(null);

    try {
      // Save in-memory pairs first if any
      if (this.inMemoryPairs().length > 0) {
        await this.pairingService.savePairs(
          this.tournamentId(),
          this.activeTab(),
          this.inMemoryPairs()
        );
        this.inMemoryPairs.set([]);
      }
      await this.pairingService.lockPairs(this.tournamentId(), this.activeTab());
    } catch {
      this.generalError.set('Impossible de valider les paires. Veuillez réessayer.');
    } finally {
      this.locking.set(false);
    }
  }

  startEdit(pair: PairWithIndex): void {
    this.editingPairIndex.set(pair.index);
    this.editPlayer1.set(pair.player1Id);
    this.editPlayer2.set(pair.player2Id);
  }

  cancelEdit(): void {
    this.editingPairIndex.set(-1);
  }

  async onConfirmEdit(index: number): Promise<void> {
    const p1 = this.editPlayer1();
    const p2 = this.editPlayer2();

    if (!p1 || !p2 || p1 === p2) {
      this.generalError.set('Les deux joueurs doivent être différents.');
      return;
    }

    this.generalError.set(null);

    const source = this.inMemoryPairs().length > 0 ? this.inMemoryPairs() : this.savedPairs();
    const pair = source[index];

    if (!pair) return;

    if (pair.id) {
      // Persisted pair — update via service
      try {
        await this.pairingService.updatePair(
          this.tournamentId(),
          pair.id,
          p1,
          p2,
          pair.locked
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        this.generalError.set(message);
        return;
      }
    } else {
      // In-memory only pair — update locally
      this.inMemoryPairs.update((pairs) =>
        pairs.map((p, i) =>
          i === index ? { ...p, player1Id: p1, player2Id: p2 } : p
        )
      );
    }

    this.editingPairIndex.set(-1);
  }
}
