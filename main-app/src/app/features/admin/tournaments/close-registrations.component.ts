import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { TournamentService } from '../../../core/services/tournament.service';
import { TournamentStatus } from '../../../core/models/tournament.model';

@Component({
  selector: 'app-close-registrations',
  standalone: true,
  template: `
    <div class="bg-white rounded-2xl shadow-sm p-6">
      <h2 class="text-xl font-semibold text-gray-900 mb-2">Clôturer les inscriptions</h2>
      <p class="text-gray-500 text-sm mb-4">
        Clôturez les inscriptions pour empêcher de nouveaux inscrits. Le statut passera de
        <strong>Inscriptions ouvertes</strong> à <strong>Inscriptions clôturées</strong>.
      </p>

      @if (!canClose()) {
        <p class="text-sm text-gray-400 italic">
          La clôture n'est disponible que lorsque le tournoi est en statut
          <strong>Inscriptions ouvertes</strong>.
        </p>
      }

      @if (canClose() && !showConfirm() && !closed()) {
        <button
          (click)="requestConfirm()"
          [disabled]="loading()"
          class="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Clôturer les inscriptions
        </button>
      }

      @if (canClose() && showConfirm() && !closed()) {
        <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
          <p class="text-sm text-yellow-800 font-medium mb-3">
            Confirmer la clôture ? Aucune nouvelle inscription ne sera possible.
          </p>
          <div class="flex gap-3">
            <button
              (click)="confirm()"
              [disabled]="loading()"
              class="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
            >
              @if (loading()) {
                Clôture en cours…
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

      @if (closed()) {
        <div class="bg-orange-50 border border-orange-200 rounded-lg p-4">
          <p class="text-sm text-orange-700 font-medium">
            Inscriptions clôturées. Aucune nouvelle inscription n'est possible.
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
export class CloseRegistrationsComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  readonly tournamentId = this.route.snapshot.paramMap.get('id')!;

  private readonly tournamentService = inject(TournamentService);

  readonly loading = signal(false);
  readonly showConfirm = signal(false);
  readonly closed = signal(false);
  readonly error = signal<string | null>(null);
  readonly currentStatus = signal<TournamentStatus | null>(null);

  readonly canClose = computed(() => this.currentStatus() === 'Inscriptions ouvertes');

  async ngOnInit(): Promise<void> {
    const t = await this.tournamentService.getTournament(this.tournamentId);
    if (t) {
      this.currentStatus.set(t.status);
    }
  }

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
      await this.tournamentService.closeRegistrations(this.tournamentId);
      this.showConfirm.set(false);
      this.closed.set(true);
    } catch {
      this.error.set('Impossible de clôturer les inscriptions. Veuillez réessayer.');
    } finally {
      this.loading.set(false);
    }
  }
}
