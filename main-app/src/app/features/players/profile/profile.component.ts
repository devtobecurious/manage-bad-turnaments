import { Component, inject, signal, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { PlayerService } from '../../../core/services/player.service';
import { Player } from '../../../core/models/player.model';

@Component({
  selector: 'app-player-profile',
  standalone: true,
  template: `
    <div class="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div class="bg-white rounded-2xl shadow-lg p-8 w-full max-w-md">
        @if (loading()) {
          <div class="text-center text-gray-500">Chargement…</div>
        } @else if (!player()) {
          <div class="text-center">
            <h1 class="text-xl font-bold text-gray-900 mb-2">Profil introuvable</h1>
            <p class="text-gray-500">Ce lien de profil est invalide.</p>
          </div>
        } @else {
          <div>
            <h1 class="text-2xl font-bold text-gray-900 mb-1">
              {{ player()!.firstName }} {{ player()!.lastName }}
            </h1>
            <p class="text-gray-500 mb-4 capitalize">{{ player()!.gender }}</p>
            <div class="bg-gray-50 rounded-lg p-4">
              <p class="text-xs text-gray-400">Votre lien personnel :</p>
              <p class="text-sm text-blue-600 break-all mt-1">{{ personalLink() }}</p>
            </div>
          </div>
        }
      </div>
    </div>
  `,
})
export class PlayerProfileComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly playerService = inject(PlayerService);

  readonly loading = signal(true);
  readonly player = signal<Player | null>(null);
  readonly personalLink = signal('');

  async ngOnInit(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('id') ?? '';

    if (!id) {
      this.loading.set(false);
      return;
    }

    const foundPlayer = await this.playerService.getPlayer(id);
    this.player.set(foundPlayer);
    this.personalLink.set(`${window.location.origin}/player/${id}`);
    this.loading.set(false);
  }
}
