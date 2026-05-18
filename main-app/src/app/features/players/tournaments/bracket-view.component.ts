import {
  Component,
  inject,
  signal,
  computed,
  input,
  OnInit,
  OnDestroy,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { BracketService } from '../../../core/services/bracket.service';
import { BracketMatch, BracketParticipant } from '../../../core/models/bracket.model';

@Component({
  selector: 'app-bracket-view',
  standalone: true,
  imports: [RouterLink],
  template: `
    <header class="bg-white shadow-sm mb-6">
      <div class="max-w-2xl mx-auto px-4 py-3 flex justify-between items-center">
        <span class="font-bold text-gray-900">BadTournoi</span>
        <a [routerLink]="['/player', playerId(), 'tournaments']" class="text-sm text-blue-600 hover:text-blue-800 font-medium">Mes tournois</a>
      </div>
    </header>
    <div class="min-h-screen bg-gray-50 p-4">
      <div class="max-w-7xl mx-auto">

        @if (loading()) {
          <div class="text-center text-gray-500 py-12">Chargement…</div>
        } @else if (error()) {
          <div class="bg-red-50 border border-red-200 rounded-xl p-6 text-red-700 text-sm">
            {{ error() }}
          </div>
        } @else {

          <!-- Header -->
          <div class="mb-6">
            <h1 class="text-2xl font-bold text-gray-900">Tableau final</h1>
            <p class="text-sm text-gray-500 mt-1">Phase éliminatoire du tournoi</p>
          </div>

          <!-- Champion banner -->
          @if (champion()) {
            <div class="mb-6 rounded-2xl bg-yellow-50 border border-yellow-200 px-6 py-4 flex items-center gap-4">
              <div class="flex-shrink-0 w-12 h-12 rounded-full bg-yellow-100 flex items-center justify-center">
                <svg class="w-7 h-7 text-yellow-500" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2l2.8 5.7L21 9l-4.5 4.4 1.1 6.1L12 16.8l-5.6 2.7 1.1-6.1L3 9l6.2-.3L12 2z"/>
                </svg>
              </div>
              <div>
                <p class="text-xs font-medium text-yellow-600 uppercase tracking-wide">Champion du tournoi</p>
                <p
                  class="text-lg font-bold"
                  [class.text-indigo-700]="isCurrentPlayer(champion())"
                  [class.text-yellow-900]="!isCurrentPlayer(champion())"
                >
                  {{ champion()!.name }}
                  @if (isCurrentPlayer(champion())) {
                    <span class="ml-2 text-sm font-normal text-indigo-500">C'est vous !</span>
                  }
                </p>
              </div>
            </div>
          }

          <!-- Bracket tree -->
          @if (rounds().length > 0) {
            <div class="overflow-x-auto pb-4">
              <div class="flex gap-8 min-w-max">
                @for (round of rounds(); track round.number) {
                  <div class="flex flex-col gap-4">

                    <!-- Round header -->
                    <div class="text-center mb-2">
                      <span class="text-sm font-semibold text-gray-600 uppercase tracking-wide">
                        {{ roundLabel(round.number, rounds().length) }}
                      </span>
                    </div>

                    <!-- Matches -->
                    <div
                      class="flex flex-col justify-around"
                      [style.gap.px]="roundGap(round.number)"
                    >
                      @for (match of round.matches; track match.id) {
                        <div
                          class="w-56 rounded-xl border bg-white shadow-sm overflow-hidden"
                          [class.border-gray-200]="match.status !== 'bye'"
                          [class.border-dashed]="match.status === 'bye'"
                          [class.border-gray-300]="match.status === 'bye'"
                          [class.opacity-60]="match.status === 'bye'"
                          [class.ring-2]="hasCurrentPlayer(match)"
                          [class.ring-indigo-400]="hasCurrentPlayer(match)"
                        >
                          <!-- Participant A -->
                          <div
                            class="px-3 py-2 border-b border-gray-100 flex items-center justify-between gap-2"
                            [class.bg-green-50]="match.winnerId && match.winnerId === match.participantA?.id"
                            [class.bg-indigo-50]="isCurrentPlayer(match.participantA) && match.winnerId !== match.participantA?.id"
                          >
                            <span
                              class="text-sm truncate"
                              [class.font-semibold]="match.winnerId === match.participantA?.id"
                              [class.text-green-800]="match.winnerId === match.participantA?.id"
                              [class.text-indigo-700]="isCurrentPlayer(match.participantA) && match.winnerId !== match.participantA?.id"
                              [class.text-gray-800]="!isCurrentPlayer(match.participantA) && match.winnerId !== match.participantA?.id"
                            >
                              @if (match.participantA) {
                                {{ match.participantA.name }}
                                @if (isCurrentPlayer(match.participantA)) {
                                  <span class="ml-1 text-xs text-indigo-400">(vous)</span>
                                }
                              } @else if (match.status === 'bye') {
                                <span class="text-gray-400 italic text-xs">Bye</span>
                              } @else {
                                <span class="text-gray-400 italic text-xs">À déterminer</span>
                              }
                            </span>
                            @if (match.winnerId === match.participantA?.id) {
                              <span class="text-xs text-green-600 font-bold shrink-0">✓</span>
                            }
                          </div>

                          <!-- Participant B -->
                          <div
                            class="px-3 py-2 flex items-center justify-between gap-2"
                            [class.bg-green-50]="match.winnerId && match.winnerId === match.participantB?.id"
                            [class.bg-indigo-50]="isCurrentPlayer(match.participantB) && match.winnerId !== match.participantB?.id"
                          >
                            <span
                              class="text-sm truncate"
                              [class.font-semibold]="match.winnerId === match.participantB?.id"
                              [class.text-green-800]="match.winnerId === match.participantB?.id"
                              [class.text-indigo-700]="isCurrentPlayer(match.participantB) && match.winnerId !== match.participantB?.id"
                              [class.text-gray-800]="!isCurrentPlayer(match.participantB) && match.winnerId !== match.participantB?.id"
                            >
                              @if (match.participantB) {
                                {{ match.participantB.name }}
                                @if (isCurrentPlayer(match.participantB)) {
                                  <span class="ml-1 text-xs text-indigo-400">(vous)</span>
                                }
                              } @else if (match.status === 'bye') {
                                <span class="text-gray-400 italic text-xs">Bye</span>
                              } @else {
                                <span class="text-gray-400 italic text-xs">À déterminer</span>
                              }
                            </span>
                            @if (match.winnerId === match.participantB?.id) {
                              <span class="text-xs text-green-600 font-bold shrink-0">✓</span>
                            }
                          </div>

                          <!-- Scores (played matches) -->
                          @if (match.status === 'played' && match.scores && match.scores.length > 0) {
                            <div class="px-3 py-1.5 bg-gray-50 border-t border-gray-100 flex gap-1 flex-wrap">
                              @for (score of match.scores; track $index) {
                                <span class="text-xs font-mono text-gray-600 bg-white border border-gray-200 px-1.5 py-0.5 rounded">
                                  {{ score.a }}-{{ score.b }}
                                </span>
                              }
                            </div>
                          } @else {
                            <!-- Status badge -->
                            <div class="px-3 py-1.5 bg-gray-50 border-t border-gray-100">
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
                            </div>
                          }
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
              <h3 class="text-lg font-medium text-gray-900 mb-1">Tableau non encore disponible</h3>
              <p class="text-sm text-gray-500 max-w-sm mx-auto">
                Le tableau final sera affiché dès que la phase de poules sera terminée.
              </p>
            </div>
          }

        }
      </div>
    </div>
  `,
})
export class BracketViewComponent implements OnInit, OnDestroy {
  readonly tournamentId = input.required<string>();
  readonly playerId = input<string>();

  private readonly bracketService = inject(BracketService);

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly allMatches = signal<BracketMatch[]>([]);

  private subscription: Subscription | null = null;

  /** Matches grouped by round, sorted by round asc then position asc. */
  readonly rounds = computed(() => {
    const matches = this.allMatches();
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

  /**
   * Returns the champion participant if the final round match has a winnerId.
   */
  readonly champion = computed((): BracketParticipant | null => {
    const rounds = this.rounds();
    if (rounds.length === 0) return null;
    const finalRound = rounds[rounds.length - 1];
    if (finalRound.matches.length !== 1) return null;
    const finalMatch = finalRound.matches[0];
    if (!finalMatch.winnerId) return null;
    if (finalMatch.participantA?.id === finalMatch.winnerId) return finalMatch.participantA;
    if (finalMatch.participantB?.id === finalMatch.winnerId) return finalMatch.participantB;
    return null;
  });

  ngOnInit(): void {
    this.subscription = this.bracketService.getBracket(this.tournamentId()).subscribe({
      next: (matches) => {
        this.allMatches.set(matches);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Impossible de charger le tableau final.');
        this.loading.set(false);
      },
    });
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
  }

  /** Returns true if the participant is the current player (from input). */
  isCurrentPlayer(participant: BracketParticipant | null | undefined): boolean {
    const pid = this.playerId();
    if (!pid || !participant) return false;
    return participant.id === pid;
  }

  /** Returns true if the match involves the current player. */
  hasCurrentPlayer(match: BracketMatch): boolean {
    return this.isCurrentPlayer(match.participantA) || this.isCurrentPlayer(match.participantB);
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
}
