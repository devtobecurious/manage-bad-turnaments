import {
  Component,
  inject,
  signal,
  computed,
  OnInit,
  OnDestroy,
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';
import { PlayerService } from '../../../core/services/player.service';
import { RegistrationService } from '../../../core/services/registration.service';
import { Player } from '../../../core/models/player.model';
import { Tournament } from '../../../core/models/tournament.model';
import { Registration, GameType, getCompatibleGameTypes } from '../../../core/models/registration.model';

@Component({
  selector: 'app-player-tournaments',
  standalone: true,
  template: `
    <div class="min-h-screen bg-gray-50 p-4">
      <div class="max-w-2xl mx-auto">

        @if (loading()) {
          <div class="text-center text-gray-500 py-12">Chargement…</div>
        } @else if (!player()) {
          <div class="bg-white rounded-2xl shadow-lg p-8 text-center">
            <h1 class="text-xl font-bold text-gray-900 mb-2">Joueur introuvable</h1>
            <p class="text-gray-500">Ce profil est invalide.</p>
          </div>
        } @else {
          <div class="mb-6">
            <h1 class="text-2xl font-bold text-gray-900">
              Tournois — {{ player()!.firstName }} {{ player()!.lastName }}
            </h1>
            <p class="text-gray-500 mt-1">Inscriptions ouvertes</p>
          </div>

          @if (confirmationMessage()) {
            <div class="mb-4 bg-green-50 border border-green-200 rounded-lg p-4 text-green-800">
              {{ confirmationMessage() }}
            </div>
          }

          @if (errorMessage()) {
            <div class="mb-4 bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
              {{ errorMessage() }}
            </div>
          }

          @if (openTournaments().length === 0) {
            <div class="bg-white rounded-2xl shadow-lg p-8 text-center text-gray-500">
              Aucun tournoi avec des inscriptions ouvertes pour le moment.
            </div>
          } @else {
            <div class="space-y-4">
              @for (tournament of openTournaments(); track tournament.id) {
                <div class="bg-white rounded-2xl shadow-lg p-6">
                  <div class="flex items-start justify-between mb-4">
                    <div>
                      <h2 class="text-lg font-semibold text-gray-900">{{ tournament.name }}</h2>
                      <p class="text-sm text-gray-500 mt-1">{{ tournament.date }}</p>
                    </div>
                    <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      Inscriptions ouvertes
                    </span>
                  </div>

                  <div class="border-t border-gray-100 pt-4">
                    <p class="text-sm font-medium text-gray-700 mb-3">Types de jeu disponibles :</p>
                    <div class="space-y-2">
                      @for (gameType of compatibleGameTypes(); track gameType) {
                        @if (getRegistration(tournament.id, gameType); as registration) {
                          <div class="flex items-center justify-between py-2 px-3 bg-blue-50 rounded-lg">
                            <div>
                              <span class="text-sm font-medium text-blue-900 capitalize">{{ gameType }}</span>
                              <span class="ml-2 text-xs text-blue-600">✓ Inscrit</span>
                            </div>
                            <button
                              (click)="unregister(tournament.id, registration.id, gameType)"
                              [disabled]="processingKey() === tournament.id + ':' + gameType"
                              class="text-sm text-red-600 hover:text-red-800 font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                              @if (processingKey() === tournament.id + ':' + gameType) {
                                Traitement…
                              } @else {
                                Se désinscrire
                              }
                            </button>
                          </div>
                        } @else {
                          <div class="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
                            <span class="text-sm text-gray-700 capitalize">{{ gameType }}</span>
                            <button
                              (click)="register(tournament.id, gameType)"
                              [disabled]="processingKey() === tournament.id + ':' + gameType"
                              class="text-sm text-blue-600 hover:text-blue-800 font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                              @if (processingKey() === tournament.id + ':' + gameType) {
                                Traitement…
                              } @else {
                                S'inscrire
                              }
                            </button>
                          </div>
                        }
                      }
                    </div>
                  </div>
                </div>
              }
            </div>
          }
        }
      </div>
    </div>
  `,
})
export class PlayerTournamentsComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly playerService = inject(PlayerService);
  private readonly registrationService = inject(RegistrationService);

  readonly loading = signal(true);
  readonly player = signal<Player | null>(null);
  readonly openTournaments = signal<Tournament[]>([]);
  readonly playerRegistrations = signal<Registration[]>([]);
  readonly confirmationMessage = signal<string | null>(null);
  readonly errorMessage = signal<string | null>(null);
  readonly processingKey = signal<string | null>(null);

  readonly compatibleGameTypes = computed<GameType[]>(() => {
    const p = this.player();
    if (!p) return [];
    return getCompatibleGameTypes(p.gender);
  });

  private tournamentsSubscription: Subscription | null = null;
  private registrationsSubscription: Subscription | null = null;

  getRegistration(tournamentId: string, gameType: GameType): Registration | undefined {
    return this.playerRegistrations().find(
      (r) => r.tournamentId === tournamentId && r.gameType === gameType
    );
  }

  async ngOnInit(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('id') ?? '';

    if (!id) {
      this.loading.set(false);
      return;
    }

    const foundPlayer = await this.playerService.getPlayer(id);
    this.player.set(foundPlayer);

    if (!foundPlayer) {
      this.loading.set(false);
      return;
    }

    this.tournamentsSubscription = this.registrationService
      .getOpenTournaments()
      .subscribe((tournaments) => {
        this.openTournaments.set(tournaments);
      });

    this.registrationsSubscription = this.registrationService
      .getPlayerRegistrations(id)
      .subscribe((registrations) => {
        this.playerRegistrations.set(registrations);
      });

    this.loading.set(false);
  }

  ngOnDestroy(): void {
    this.tournamentsSubscription?.unsubscribe();
    this.registrationsSubscription?.unsubscribe();
  }

  async register(tournamentId: string, gameType: GameType): Promise<void> {
    const p = this.player();
    if (!p) return;

    const key = `${tournamentId}:${gameType}`;
    this.processingKey.set(key);
    this.confirmationMessage.set(null);
    this.errorMessage.set(null);

    try {
      await this.registrationService.registerForTournament(tournamentId, p.id, gameType);
      this.confirmationMessage.set(
        `Inscription confirmée pour "${gameType}" !`
      );
    } catch (err) {
      this.errorMessage.set(
        err instanceof Error ? err.message : "Une erreur est survenue lors de l'inscription."
      );
    } finally {
      this.processingKey.set(null);
    }
  }

  async unregister(tournamentId: string, registrationId: string, gameType: GameType): Promise<void> {
    const key = `${tournamentId}:${gameType}`;
    this.processingKey.set(key);
    this.confirmationMessage.set(null);
    this.errorMessage.set(null);

    try {
      await this.registrationService.unregisterFromTournament(tournamentId, registrationId);
      this.confirmationMessage.set(`Désinscription de "${gameType}" effectuée.`);
    } catch (err) {
      this.errorMessage.set(
        err instanceof Error ? err.message : 'Une erreur est survenue lors de la désinscription.'
      );
    } finally {
      this.processingKey.set(null);
    }
  }
}
