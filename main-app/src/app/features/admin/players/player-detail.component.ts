import { Component, inject, signal, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { PlayerService } from '../../../core/services/player.service';
import { Player } from '../../../core/models/player.model';

@Component({
  selector: 'app-player-detail',
  standalone: true,
  template: `
    <div class="p-6">
      <button
        (click)="goBack()"
        class="mb-4 flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800"
      >
        &larr; Retour à la liste
      </button>

      @if (player()) {
        <div class="bg-white rounded-xl shadow p-6 max-w-md">
          <h2 class="text-2xl font-bold text-gray-900 mb-4">
            {{ player()!.firstName }} {{ player()!.lastName }}
          </h2>
          <dl class="space-y-2">
            <div class="flex gap-2">
              <dt class="text-sm font-medium text-gray-500 w-24">Genre :</dt>
              <dd class="text-sm text-gray-900">
                {{ player()!.gender === 'M' ? 'Masculin' : 'Féminin' }}
              </dd>
            </div>
            <div class="flex gap-2">
              <dt class="text-sm font-medium text-gray-500 w-24">Statut :</dt>
              <dd class="text-sm">
                @if (player()!.active) {
                  <span class="text-green-700 font-medium">Actif</span>
                } @else {
                  <span class="text-red-700 font-medium">Désactivé</span>
                }
              </dd>
            </div>
          </dl>
        </div>
      } @else {
        <p class="text-gray-500 italic">Chargement du profil...</p>
      }
    </div>
  `,
})
export class PlayerDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly playerService = inject(PlayerService);

  readonly player = signal<Player | null>(null);

  ngOnInit(): void {
    const playerId = this.route.snapshot.paramMap.get('id');
    if (playerId) {
      this.playerService.getPlayers().subscribe((players) => {
        const found = players.find((p) => p.id === playerId) ?? null;
        this.player.set(found);
      });
    }
  }

  goBack(): void {
    this.router.navigate(['/admin/players']);
  }
}
