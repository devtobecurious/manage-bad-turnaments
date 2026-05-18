import {
  Component,
  OnInit,
  inject,
  signal,
  computed,
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { toSignal, toObservable } from '@angular/core/rxjs-interop';
import { switchMap } from 'rxjs/operators';
import { of } from 'rxjs';
import { BracketService } from '../../../core/services/bracket.service';
import { BracketMatch } from '../../../core/models/bracket.model';
import { BracketScoreEntryComponent } from './bracket-score-entry.component';

@Component({
  selector: 'app-bracket',
  standalone: true,
  imports: [BracketScoreEntryComponent],
  template: `
    <div class="min-h-screen bg-gray-50 p-6">
      <!-- Header -->
      <div class="max-w-7xl mx-auto">
        <div class="mb-6 flex items-center justify-between">
          <div>
            <h1 class="text-2xl font-bold text-gray-900">Tableau final</h1>
            <p class="text-sm text-gray-500 mt-1">Phase éliminatoire du tournoi</p>
          </div>
          <button
            type="button"
            (click)="generate()"
            [disabled]="generating()"
            class="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            @if (generating()) {
              <span class="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
              Génération…
            } @else {
              Générer le tableau
            }
          </button>
        </div>

        <!-- Error alert -->
        @if (error()) {
          <div class="mb-4 rounded-lg bg-red-50 border border-red-200 p-4">
            <p class="text-sm text-red-700">{{ error() }}</p>
          </div>
        }

        <!-- Success alert -->
        @if (successMessage()) {
          <div class="mb-4 rounded-lg bg-green-50 border border-green-200 p-4">
            <p class="text-sm text-green-700">{{ successMessage() }}</p>
          </div>
        }

        <!-- Champion banner -->
        @if (champion()) {
          <div class="mb-6 rounded-2xl bg-gradient-to-r from-yellow-400 via-amber-400 to-yellow-500 p-6 shadow-lg animate-pulse">
            <div class="flex items-center gap-4">
              <div class="text-4xl">🏆</div>
              <div>
                <p class="text-sm font-semibold text-yellow-900 uppercase tracking-widest">Champion du tournoi</p>
                <p class="text-2xl font-bold text-yellow-950">{{ champion()!.name }}</p>
              </div>
            </div>
          </div>
        }

        <!-- Bracket display -->
        @if (rounds().length > 0) {
          <div class="overflow-x-auto">
            <div class="flex gap-8 min-w-max pb-4">
              @for (round of rounds(); track round.number) {
                <div class="flex flex-col gap-4">
                  <!-- Round header -->
                  <div class="text-center">
                    <span class="text-sm font-semibold text-gray-600 uppercase tracking-wide">
                      {{ roundLabel(round.number, rounds().length) }}
                    </span>
                  </div>

                  <!-- Matches in this round -->
                  <div
                    class="flex flex-col justify-around"
                    [style.gap.px]="roundGap(round.number)"
                  >
                    @for (match of round.matches; track match.id) {
                      <div
                        class="w-52 rounded-lg border bg-white shadow-sm overflow-hidden"
                        [class.border-gray-200]="match.status !== 'bye'"
                        [class.border-dashed]="match.status === 'bye'"
                        [class.border-gray-300]="match.status === 'bye'"
                        [class.opacity-70]="match.status === 'bye'"
                        [class.cursor-pointer]="isClickable(match)"
                        [class.hover:shadow-md]="isClickable(match)"
                        [class.hover:border-indigo-300]="isClickable(match)"
                        [class.ring-2]="isClickable(match)"
                        [class.ring-indigo-100]="isClickable(match)"
                        (click)="openScoreEntry(match)"
                      >
                        <!-- Participant A -->
                        <div
                          class="px-3 py-2 border-b border-gray-100 flex items-center justify-between"
                          [class.bg-green-50]="match.winnerId === match.participantA?.id"
                          [class.font-semibold]="match.winnerId === match.participantA?.id"
                          [class.text-green-800]="match.winnerId === match.participantA?.id"
                          [class.bg-yellow-50]="isChampion(match.participantA?.id)"
                        >
                          <span class="text-sm truncate">
                            @if (match.participantA) {
                              {{ match.participantA.name }}
                            } @else {
                              <span class="text-gray-400 italic">Bye</span>
                            }
                          </span>
                          @if (isChampion(match.participantA?.id) && match.status === 'played') {
                            <span class="text-lg ml-1" title="Champion">🏆</span>
                          } @else if (match.status === 'bye' && match.winnerId === match.participantA?.id) {
                            <span class="text-xs text-green-600 font-medium ml-1">✓</span>
                          }
                        </div>

                        <!-- Participant B -->
                        <div
                          class="px-3 py-2 flex items-center justify-between"
                          [class.bg-green-50]="match.winnerId === match.participantB?.id"
                          [class.font-semibold]="match.winnerId === match.participantB?.id"
                          [class.text-green-800]="match.winnerId === match.participantB?.id"
                          [class.bg-yellow-50]="isChampion(match.participantB?.id)"
                        >
                          <span class="text-sm truncate">
                            @if (match.participantB) {
                              {{ match.participantB.name }}
                            } @else {
                              <span class="text-gray-400 italic">Bye</span>
                            }
                          </span>
                          @if (isChampion(match.participantB?.id) && match.status === 'played') {
                            <span class="text-lg ml-1" title="Champion">🏆</span>
                          } @else if (match.status === 'bye' && match.winnerId === match.participantB?.id) {
                            <span class="text-xs text-green-600 font-medium ml-1">✓</span>
                          }
                        </div>

                        <!-- Status badge -->
                        <div class="px-3 py-1 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
                          <span class="text-xs text-gray-400">
                            @if (match.status === 'bye') {
                              Bye
                            } @else if (match.status === 'played') {
                              Joué
                            } @else if (match.participantA && match.participantB) {
                              À jouer
                            } @else {
                              En attente
                            }
                          </span>
                          @if (isClickable(match)) {
                            <span class="text-xs text-indigo-500 font-medium">Saisir →</span>
                          }
                        </div>
                      </div>
                    }
                  </div>
                </div>
              }
            </div>
          </div>
        } @else {
          <!-- Empty state -->
          <div class="text-center py-16">
            <div class="mx-auto w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
              <svg class="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <h3 class="text-lg font-medium text-gray-900 mb-1">Tableau non encore généré</h3>
            <p class="text-sm text-gray-500 max-w-sm mx-auto">
              Cliquez sur "Générer le tableau" lorsque tous les matchs de poule ont été saisis.
            </p>
          </div>
        }
      </div>
    </div>

    <!-- Score entry modal -->
    @if (selectedMatch()) {
      <app-bracket-score-entry
        [match]="selectedMatch()!"
        [tournamentId]="tournamentId()"
        (cancel)="closeScoreEntry()"
        (saved)="onScoreSaved()"
      />
    }
  `,
})
export class BracketComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly bracketService = inject(BracketService);

  readonly tournamentId = signal<string>('');
  readonly generating = signal(false);
  readonly error = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);
  readonly selectedMatch = signal<BracketMatch | null>(null);
  /** Champion ID set when the tournament is completed */
  readonly championId = signal<string | null>(null);

  private readonly _matchesRaw = toSignal(
    toObservable(computed(() => this.tournamentId() || '__none__')).pipe(
      switchMap(id => this.bracketService.getBracket(id))
    )
  );
  private readonly allMatches = computed(() => this._matchesRaw() ?? []);

  /** Matches grouped by round, sorted by round asc then position asc */
  readonly rounds = computed(() => {
    const matches = this.allMatches() ?? [];
    if (matches.length === 0) return [];

    const roundMap = new Map<number, BracketMatch[]>();
    for (const m of matches) {
      if (!roundMap.has(m.round)) roundMap.set(m.round, []);
      roundMap.get(m.round)!.push(m);
    }

    return Array.from(roundMap.entries())
      .sort(([a], [b]) => a - b)
      .map(([number, ms]) => ({
        number,
        matches: ms.sort((a, b) => a.position - b.position),
      }));
  });

  /** Champion participant (from final match winner) */
  readonly champion = computed(() => {
    const allRounds = this.rounds();
    if (allRounds.length === 0) return null;

    const finalRound = allRounds[allRounds.length - 1];
    const finalMatch = finalRound.matches[0];
    if (!finalMatch || finalMatch.status !== 'played' || !finalMatch.winnerId) return null;

    const winner =
      finalMatch.participantA?.id === finalMatch.winnerId
        ? finalMatch.participantA
        : finalMatch.participantB;

    return winner ?? null;
  });

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id') ?? '';
    this.tournamentId.set(id);
  }

  roundLabel(roundNumber: number, totalRounds: number): string {
    if (roundNumber === totalRounds) return 'Finale';
    if (roundNumber === totalRounds - 1) return 'Demi-finales';
    if (roundNumber === totalRounds - 2) return 'Quarts de finale';
    return `Tour ${roundNumber}`;
  }

  roundGap(roundNumber: number): number {
    return Math.pow(2, roundNumber - 1) * 8;
  }

  isClickable(match: BracketMatch): boolean {
    return (
      match.status === 'pending' &&
      match.participantA !== null &&
      match.participantB !== null
    );
  }

  isChampion(participantId: string | undefined): boolean {
    if (!participantId) return false;
    const ch = this.champion();
    return ch?.id === participantId;
  }

  openScoreEntry(match: BracketMatch): void {
    if (!this.isClickable(match)) return;
    this.selectedMatch.set(match);
  }

  closeScoreEntry(): void {
    this.selectedMatch.set(null);
  }

  onScoreSaved(): void {
    this.selectedMatch.set(null);
    this.successMessage.set('Score enregistré !');
    setTimeout(() => this.successMessage.set(null), 3000);
  }

  async generate(): Promise<void> {
    this.generating.set(true);
    this.error.set(null);
    this.successMessage.set(null);

    try {
      await this.bracketService.generateBracket(this.tournamentId());
      this.successMessage.set('Tableau généré avec succès !');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur lors de la génération du tableau.';
      this.error.set(msg);
    } finally {
      this.generating.set(false);
    }
  }
}
