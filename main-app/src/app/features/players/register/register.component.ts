import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { PlayerService } from '../../../core/services/player.service';
import { InviteService } from '../../../core/services/invite.service';
import { Gender } from '../../../core/models/player.model';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div class="bg-white rounded-2xl shadow-lg p-8 w-full max-w-md">
        <h1 class="text-2xl font-bold text-gray-900 mb-2">Rejoindre le club</h1>
        <p class="text-gray-500 mb-6">Créez votre profil de joueur</p>

        @if (inviteInvalid()) {
          <div class="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
            Ce lien d'invitation est invalide ou a expiré.
          </div>
        } @else if (registered()) {
          <div class="bg-green-50 border border-green-200 rounded-lg p-4">
            <p class="text-green-800 font-semibold mb-2">Inscription réussie !</p>
            <p class="text-green-700 text-sm mb-3">Voici votre lien personnel pour accéder à votre profil :</p>
            <a
              [href]="personalLink()"
              class="block w-full text-center bg-green-600 text-white rounded-lg px-4 py-2 hover:bg-green-700 transition-colors text-sm break-all"
            >
              {{ personalLink() }}
            </a>
          </div>
        } @else {
          <form (ngSubmit)="onSubmit()" #registerForm="ngForm">
            <div class="space-y-4">
              <div>
                <label for="firstName" class="block text-sm font-medium text-gray-700 mb-1">
                  Prénom
                </label>
                <input
                  id="firstName"
                  type="text"
                  name="firstName"
                  [(ngModel)]="firstName"
                  required
                  class="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Votre prénom"
                />
              </div>

              <div>
                <label for="lastName" class="block text-sm font-medium text-gray-700 mb-1">
                  Nom
                </label>
                <input
                  id="lastName"
                  type="text"
                  name="lastName"
                  [(ngModel)]="lastName"
                  required
                  class="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Votre nom"
                />
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Genre</label>
                <div class="flex gap-4">
                  <label class="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="gender"
                      value="homme"
                      [(ngModel)]="gender"
                      class="text-blue-600"
                    />
                    <span class="text-gray-700">Homme</span>
                  </label>
                  <label class="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="gender"
                      value="femme"
                      [(ngModel)]="gender"
                      class="text-blue-600"
                    />
                    <span class="text-gray-700">Femme</span>
                  </label>
                </div>
              </div>

              @if (error()) {
                <div class="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">
                  {{ error() }}
                </div>
              }

              <button
                type="submit"
                [disabled]="loading() || !firstName || !lastName || !gender"
                class="w-full bg-blue-600 text-white rounded-lg px-4 py-2 font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                @if (loading()) {
                  Inscription en cours…
                } @else {
                  S'inscrire
                }
              </button>
            </div>
          </form>
        }
      </div>
    </div>
  `,
})
export class RegisterComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly playerService = inject(PlayerService);
  private readonly inviteService = inject(InviteService);

  firstName = '';
  lastName = '';
  gender: Gender | '' = '';

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly registered = signal(false);
  readonly inviteInvalid = signal(false);
  readonly personalLink = signal('');

  private token = '';

  async ngOnInit(): Promise<void> {
    this.token = this.route.snapshot.paramMap.get('token') ?? '';

    if (!this.token) {
      this.inviteInvalid.set(true);
      return;
    }

    const invite = await this.inviteService.getInviteByToken(this.token);
    if (!invite) {
      this.inviteInvalid.set(true);
    }
  }

  async onSubmit(): Promise<void> {
    if (!this.firstName || !this.lastName || !this.gender) {
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    try {
      const player = await this.playerService.registerPlayer({
        firstName: this.firstName,
        lastName: this.lastName,
        gender: this.gender,
      });

      const origin = window.location.origin;
      this.personalLink.set(`${origin}/player/${player.id}`);
      this.registered.set(true);
    } catch {
      this.error.set('Une erreur est survenue lors de l\'inscription. Veuillez réessayer.');
    } finally {
      this.loading.set(false);
    }
  }
}
