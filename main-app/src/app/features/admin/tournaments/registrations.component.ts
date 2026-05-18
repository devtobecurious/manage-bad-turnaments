import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { RegistrationService } from '../../../core/services/registration.service';
import { PlayerService } from '../../../core/services/player.service';
import {
  GameType,
  GAME_TYPES,
  DOUBLE_GAME_TYPES,
  GAME_TYPE_LABELS,
} from '../../../core/models/registration.model';
import { Player } from '../../../core/models/player.model';

@Component({
  selector: 'app-registrations',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="bg-white rounded-2xl shadow-sm p-6">
      <h2 class="text-xl font-semibold text-gray-900 mb-6">Inscrits par type de jeu</h2>

      <!-- Tabs -->
      <div class="flex gap-1 border-b border-gray-200 mb-6 overflow-x-auto">
        @for (type of gameTypes; track type) {
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
            <span
              class="ml-1 px-1.5 py-0.5 text-xs rounded-full"
              [class.bg-indigo-500]="activeTab() === type"
              [class.text-white]="activeTab() === type"
              [class.bg-gray-200]="activeTab() !== type"
              [class.text-gray-700]="activeTab() !== type"
            >{{ countForTab(type) }}</span>
          </button>
        }
      </div>

      <!-- Active tab content -->
      <div>
        <!-- Parity alert for double/mixte types -->
        @if (showParityAlert()) {
          <div class="mb-4 bg-orange-50 border border-orange-200 rounded-lg p-4 flex items-start gap-3">
            <span class="text-orange-500 text-lg leading-none">⚠</span>
            <div>
              <p class="text-sm font-medium text-orange-800">Nombre impair d'inscrits</p>
              <p class="text-sm text-orange-600">
                {{ gameTypeLabels[activeTab()] }} : {{ currentRegistrations().length }} inscrits — impossible de former des paires complètes.
              </p>
            </div>
          </div>
        }

        <!-- Counter -->
        <div class="flex items-center justify-between mb-4">
          <p class="text-sm text-gray-500">
            <span class="font-semibold text-gray-800">{{ currentRegistrations().length }}</span>
            inscrit{{ currentRegistrations().length > 1 ? 's' : '' }} en {{ gameTypeLabels[activeTab()] }}
          </p>
        </div>

        <!-- Registrations list -->
        <div class="divide-y divide-gray-100 mb-6">
          @if (currentRegistrations().length === 0) {
            <p class="text-sm text-gray-400 py-4 text-center">Aucun inscrit pour ce type de jeu.</p>
          }
          @for (reg of currentRegistrations(); track reg.id) {
            <div class="flex items-center justify-between py-3">
              <div>
                <p class="text-sm font-medium text-gray-900">{{ playerName(reg.playerId) }}</p>
                <p class="text-xs text-gray-400">{{ formatDate(reg.registeredAt) }}</p>
              </div>
              <button
                (click)="removePlayer(reg.id)"
                [disabled]="removing() === reg.id"
                class="px-3 py-1 text-xs font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                @if (removing() === reg.id) {
                  Suppression…
                } @else {
                  Supprimer
                }
              </button>
            </div>
          }
        </div>

        <!-- Add player form -->
        <div class="border-t border-gray-100 pt-4">
          <h3 class="text-sm font-medium text-gray-700 mb-3">Ajouter un joueur</h3>
          <div class="flex gap-3 items-end">
            <div class="flex-1">
              <label class="block text-xs text-gray-500 mb-1">Joueur</label>
              <select
                [(ngModel)]="selectedPlayerId"
                class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Choisir un joueur…</option>
                @for (player of availablePlayers(); track player.id) {
                  <option [value]="player.id">{{ player.lastName }} {{ player.firstName }}</option>
                }
              </select>
            </div>
            <button
              (click)="addPlayer()"
              [disabled]="!selectedPlayerId || adding()"
              class="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              @if (adding()) {
                Ajout…
              } @else {
                Ajouter
              }
            </button>
          </div>
          @if (addError()) {
            <p class="mt-2 text-xs text-red-600">{{ addError() }}</p>
          }
        </div>
      </div>
    </div>
  `,
})
export class RegistrationsComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  readonly tournamentId = this.route.snapshot.paramMap.get('id')!;

  private readonly registrationService = inject(RegistrationService);
  private readonly playerService = inject(PlayerService);

  readonly gameTypes = GAME_TYPES;
  readonly gameTypeLabels = GAME_TYPE_LABELS;

  readonly activeTab = signal<GameType>('simple-homme');
  readonly adding = signal(false);
  readonly removing = signal<string | null>(null);
  readonly addError = signal<string | null>(null);

  selectedPlayerId = '';

  private readonly allPlayers = toSignal(this.playerService.getPlayers(), { initialValue: [] as Player[] });
  private readonly allRegistrations = signal<Record<GameType, { id: string; playerId: string; registeredAt: string }[]>>({
    'simple-homme': [],
    'simple-femme': [],
    'double-homme': [],
    'double-femme': [],
    'double-mixte': [],
  });

  readonly currentRegistrations = computed(() => {
    return this.allRegistrations()[this.activeTab()];
  });

  readonly showParityAlert = computed(() => {
    const tab = this.activeTab();
    const isDouble = (DOUBLE_GAME_TYPES as GameType[]).includes(tab);
    return isDouble && this.currentRegistrations().length % 2 !== 0;
  });

  readonly availablePlayers = computed(() => {
    const currentRegs = this.currentRegistrations();
    const registeredIds = new Set(currentRegs.map((r) => r.playerId));
    return this.allPlayers()
      .filter((p) => p.active && !registeredIds.has(p.id));
  });

  ngOnInit(): void {
    for (const gameType of GAME_TYPES) {
      this.registrationService.getRegistrations(this.tournamentId, gameType).subscribe((regs) => {
        this.allRegistrations.update((current) => ({
          ...current,
          [gameType]: regs,
        }));
      });
    }
  }

  countForTab(gameType: GameType): number {
    return this.allRegistrations()[gameType].length;
  }

  playerName(playerId: string): string {
    const player = this.allPlayers().find((p) => p.id === playerId);
    return player ? `${player.lastName} ${player.firstName}` : playerId;
  }

  formatDate(iso: string): string {
    try {
      return new Date(iso).toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return iso;
    }
  }

  selectTab(gameType: GameType): void {
    this.activeTab.set(gameType);
    this.selectedPlayerId = '';
    this.addError.set(null);
  }

  async addPlayer(): Promise<void> {
    if (!this.selectedPlayerId) return;

    this.adding.set(true);
    this.addError.set(null);

    try {
      await this.registrationService.addRegistration({
        tournamentId: this.tournamentId,
        playerId: this.selectedPlayerId,
        gameType: this.activeTab(),
      });
      this.selectedPlayerId = '';
    } catch {
      this.addError.set('Impossible d\'ajouter le joueur. Veuillez réessayer.');
    } finally {
      this.adding.set(false);
    }
  }

  async removePlayer(registrationId: string): Promise<void> {
    this.removing.set(registrationId);

    try {
      await this.registrationService.removeRegistration(this.tournamentId, registrationId);
    } catch {
      // ignore error silently — registration list will revert via observable
    } finally {
      this.removing.set(null);
    }
  }
}
