import { Component, inject, signal, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { TournamentService } from '../../../core/services/tournament.service';
import { PoolConfig, GameType } from '../../../core/models/tournament.model';

const GAME_TYPE_LABELS: Record<GameType, string> = {
  'simple-homme': 'Simple Homme',
  'simple-femme': 'Simple Femme',
  'double-homme': 'Double Homme',
  'double-femme': 'Double Femme',
  'mixte': 'Mixte',
};

@Component({
  selector: 'app-pool-config',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="bg-white rounded-2xl shadow-sm p-6">
      <h2 class="text-xl font-semibold text-gray-900 mb-1">Configuration des poules</h2>
      <p class="text-gray-500 text-sm mb-6">
        Définissez le nombre de poules et les qualifiés pour chaque type de jeu.
      </p>

      @if (gameTypesData().length === 0) {
        <p class="text-gray-400 text-sm italic">Aucun type de jeu configuré pour ce tournoi.</p>
      }

      @for (config of configs(); track config.gameType) {
        <div class="border border-gray-200 rounded-xl p-4 mb-4">
          <h3 class="text-base font-medium text-gray-800 mb-4">
            {{ gameTypeLabel(config.gameType) }}
          </h3>

          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">
                Nombre de poules
              </label>
              <input
                type="number"
                min="1"
                [value]="config.poolCount"
                (input)="onPoolCountChange(config.gameType, $event)"
                class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">
                Qualifiés par poule
              </label>
              <select
                [value]="config.qualifiersPerPool"
                (change)="onQualifiersChange(config.gameType, $event)"
                class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="0">0 — Pas de phase finale</option>
                <option value="1">1</option>
                <option value="2">2</option>
              </select>
            </div>
          </div>

          @if (config.poolCount === 1 && config.qualifiersPerPool === 0) {
            <p class="mt-3 text-amber-600 text-xs bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              Aucune phase finale ne sera générée (1 poule, 0 qualifié).
            </p>
          }
        </div>
      }

      @if (gameTypesData().length > 0) {
        <div class="flex items-center gap-3 mt-4">
          <button
            (click)="save()"
            [disabled]="saving()"
            class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            @if (saving()) {
              Enregistrement…
            } @else {
              Enregistrer la configuration
            }
          </button>

          @if (saveSuccess()) {
            <span class="text-green-600 text-sm font-medium">Configuration enregistrée.</span>
          }

          @if (saveError()) {
            <span class="text-red-600 text-sm">{{ saveError() }}</span>
          }
        </div>
      }
    </div>
  `,
})
export class PoolConfigComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  readonly tournamentId = this.route.snapshot.paramMap.get('id')!;

  private readonly tournamentService = inject(TournamentService);

  readonly saving = signal(false);
  readonly saveSuccess = signal(false);
  readonly saveError = signal<string | null>(null);

  readonly configs = signal<PoolConfig[]>([]);
  readonly gameTypesData = signal<GameType[]>([]);

  async ngOnInit(): Promise<void> {
    const t = await this.tournamentService.getTournament(this.tournamentId);
    if (t) {
      this.gameTypesData.set(t.gameTypes ?? []);
      this.initConfigs(t.gameTypes ?? [], t.poolConfig ?? []);
    }
  }

  private initConfigs(gameTypes: GameType[], existing: PoolConfig[]): void {
    const merged: PoolConfig[] = gameTypes.map((gameType) => {
      const found = existing.find((c) => c.gameType === gameType);
      return found ?? { gameType, poolCount: 1, qualifiersPerPool: 1 };
    });

    this.configs.set(merged);
  }

  gameTypeLabel(gameType: GameType): string {
    return GAME_TYPE_LABELS[gameType] ?? gameType;
  }

  onPoolCountChange(gameType: GameType, event: Event): void {
    const input = event.target as HTMLInputElement;
    const value = Math.max(1, parseInt(input.value, 10) || 1);
    this.updateConfig(gameType, { poolCount: value });
  }

  onQualifiersChange(gameType: GameType, event: Event): void {
    const select = event.target as HTMLSelectElement;
    const value = parseInt(select.value, 10) as 0 | 1 | 2;
    this.updateConfig(gameType, { qualifiersPerPool: value });
  }

  private updateConfig(gameType: GameType, patch: Partial<PoolConfig>): void {
    this.configs.update((configs) =>
      configs.map((c) => (c.gameType === gameType ? { ...c, ...patch } : c))
    );
  }

  async save(): Promise<void> {
    this.saving.set(true);
    this.saveSuccess.set(false);
    this.saveError.set(null);

    try {
      const configs = this.configs();
      await this.tournamentService.updatePoolConfig(this.tournamentId, configs);
      this.saveSuccess.set(true);
    } catch {
      this.saveError.set('Impossible de sauvegarder la configuration.');
    } finally {
      this.saving.set(false);
    }
  }
}
