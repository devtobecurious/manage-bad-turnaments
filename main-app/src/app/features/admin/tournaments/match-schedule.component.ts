import { Component, inject, signal, computed, input, OnInit } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { MatchService } from '../../../core/services/match.service';
import { Match } from '../../../core/models/match.model';
import { GAME_TYPE_LABELS } from '../../../core/models/registration.model';

@Component({
  selector: 'app-match-schedule',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="max-w-4xl mx-auto p-6 space-y-6">
      <!-- Header -->
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-bold text-gray-900">Calendrier des matchs</h1>
          <p class="text-sm text-gray-500 mt-1">
            Tournoi : {{ tournamentId() }} — Poule : {{ poolId() }}
          </p>
        </div>
        <a
          [routerLink]="['/admin/tournaments', tournamentId(), 'pool-draw']"
          class="text-sm text-indigo-600 hover:text-indigo-800"
        >
          Retour aux poules
        </a>
      </div>

      <!-- Error banner -->
      @if (error()) {
        <div class="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">
          {{ error() }}
        </div>
      }

      <!-- Generate button -->
      <div class="flex gap-3">
        <button
          (click)="generate()"
          [disabled]="generating()"
          class="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          @if (generating()) {
            Génération en cours…
          } @else if (matches().length > 0) {
            Régénérer le calendrier
          } @else {
            Générer le calendrier
          }
        </button>
      </div>

      <!-- Match count summary -->
      @if (matches().length > 0) {
        <div class="bg-gray-50 rounded-lg px-4 py-3 flex items-center gap-3">
          <span class="text-sm text-gray-600">
            <span class="font-semibold text-gray-900">{{ matches().length }}</span>
            match{{ matches().length > 1 ? 's' : '' }} —
            <span class="text-green-700 font-medium">{{ playedCount() }} joué{{ playedCount() > 1 ? 's' : '' }}</span>
            /
            <span class="text-yellow-700 font-medium">{{ pendingCount() }} à jouer</span>
          </span>
        </div>
      }

      <!-- Match list -->
      @if (matches().length > 0) {
        <div class="space-y-3">
          @for (match of matches(); track match.id) {
            <div
              class="bg-white rounded-xl shadow-sm border p-4 flex items-center justify-between gap-4"
              [class.border-green-200]="match.status === 'played'"
              [class.border-gray-200]="match.status === 'pending'"
            >
              <!-- Participants -->
              <div class="flex items-center gap-4 flex-1 min-w-0">
                <div class="flex-1 text-right min-w-0">
                  <span
                    class="text-sm font-medium truncate block"
                    [class.text-indigo-700]="match.winnerId === match.participantA.id"
                    [class.text-gray-800]="match.winnerId !== match.participantA.id"
                  >
                    {{ match.participantA.name }}
                  </span>
                </div>

                <span class="text-gray-400 text-xs font-semibold shrink-0">VS</span>

                <div class="flex-1 min-w-0">
                  <span
                    class="text-sm font-medium truncate block"
                    [class.text-indigo-700]="match.winnerId === match.participantB.id"
                    [class.text-gray-800]="match.winnerId !== match.participantB.id"
                  >
                    {{ match.participantB.name }}
                  </span>
                </div>
              </div>

              <!-- Status badge -->
              <div class="shrink-0">
                @if (match.status === 'played') {
                  <span class="px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full">
                    Joué
                  </span>
                } @else {
                  <span class="px-2 py-1 bg-yellow-100 text-yellow-700 text-xs font-medium rounded-full">
                    À jouer
                  </span>
                }
              </div>
            </div>
          }
        </div>
      } @else if (!generating()) {
        <div class="text-center py-12 text-gray-400 text-sm">
          Aucun match généré. Cliquez sur "Générer le calendrier" pour commencer.
        </div>
      }
    </div>
  `,
})
export class MatchScheduleComponent implements OnInit {
  readonly tournamentId = input.required<string>();
  readonly poolId = input.required<string>();

  private readonly matchService = inject(MatchService);

  readonly generating = signal(false);
  readonly error = signal<string | null>(null);

  private readonly matches$ = signal<Match[]>([]);

  readonly matches = computed(() => this.matches$());

  readonly playedCount = computed(() => this.matches().filter((m) => m.status === 'played').length);
  readonly pendingCount = computed(() => this.matches().filter((m) => m.status === 'pending').length);

  readonly gameTypeLabels = GAME_TYPE_LABELS;

  ngOnInit(): void {
    this.matchService.getMatchesForPool(this.tournamentId(), this.poolId()).subscribe({
      next: (matches) => this.matches$.set(matches),
      error: () => this.error.set('Impossible de charger les matchs.'),
    });
  }

  async generate(): Promise<void> {
    this.generating.set(true);
    this.error.set(null);

    try {
      await this.matchService.generateMatches(this.tournamentId(), this.poolId());
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Impossible de générer le calendrier.';
      this.error.set(message);
    } finally {
      this.generating.set(false);
    }
  }
}
