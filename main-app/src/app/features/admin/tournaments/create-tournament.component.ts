import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { TournamentService } from '../../../core/services/tournament.service';
import { GameType } from '../../../core/models/tournament.model';

interface GameTypeOption {
  value: GameType;
  label: string;
}

@Component({
  selector: 'app-create-tournament',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="p-6 max-w-2xl mx-auto">
      <h2 class="text-2xl font-bold text-gray-900 mb-6">Créer un tournoi</h2>

      <form (ngSubmit)="onSubmit()" #tournamentForm="ngForm" novalidate>
        <!-- Nom -->
        <div class="mb-4">
          <label for="name" class="block text-sm font-medium text-gray-700 mb-1">
            Nom du tournoi <span class="text-red-500">*</span>
          </label>
          <input
            id="name"
            name="name"
            type="text"
            [(ngModel)]="name"
            required
            class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Ex: Tournoi Printemps 2026"
          />
          @if (submitted() && !name) {
            <p class="mt-1 text-sm text-red-600">Le nom est obligatoire.</p>
          }
        </div>

        <!-- Date -->
        <div class="mb-4">
          <label for="date" class="block text-sm font-medium text-gray-700 mb-1">
            Date <span class="text-red-500">*</span>
          </label>
          <input
            id="date"
            name="date"
            type="date"
            [(ngModel)]="date"
            required
            class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          @if (submitted() && !date) {
            <p class="mt-1 text-sm text-red-600">La date est obligatoire.</p>
          }
        </div>

        <!-- Description (optionnel) -->
        <div class="mb-4">
          <label for="description" class="block text-sm font-medium text-gray-700 mb-1">
            Description <span class="text-gray-400 text-xs">(optionnel)</span>
          </label>
          <textarea
            id="description"
            name="description"
            [(ngModel)]="description"
            rows="3"
            class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Décrivez le tournoi..."
          ></textarea>
        </div>

        <!-- Types de jeu (multi-select) -->
        <div class="mb-6">
          <fieldset>
            <legend class="block text-sm font-medium text-gray-700 mb-2">
              Types de jeu <span class="text-red-500">*</span>
            </legend>
            <div class="space-y-2">
              @for (option of gameTypeOptions; track option.value) {
                <label class="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    [value]="option.value"
                    [checked]="selectedGameTypes().includes(option.value)"
                    (change)="onGameTypeChange(option.value, $event)"
                    class="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span class="text-sm text-gray-700">{{ option.label }}</span>
                </label>
              }
            </div>
            @if (submitted() && selectedGameTypes().length === 0) {
              <p class="mt-1 text-sm text-red-600">Sélectionnez au moins un type de jeu.</p>
            }
          </fieldset>
        </div>

        <!-- Actions -->
        <div class="flex gap-3">
          <button
            type="submit"
            [disabled]="saving()"
            class="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            @if (saving()) {
              Création en cours…
            } @else {
              Créer le tournoi
            }
          </button>
          <button
            type="button"
            (click)="onCancel()"
            class="px-4 py-2 bg-white text-gray-700 text-sm font-medium rounded-lg border border-gray-300 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-400"
          >
            Annuler
          </button>
        </div>

        @if (errorMessage()) {
          <p class="mt-3 text-sm text-red-600">{{ errorMessage() }}</p>
        }
      </form>
    </div>
  `,
})
export class CreateTournamentComponent {
  private readonly tournamentService = inject(TournamentService);
  private readonly router = inject(Router);

  readonly gameTypeOptions: GameTypeOption[] = [
    { value: 'simple-homme', label: 'Simple Homme' },
    { value: 'simple-femme', label: 'Simple Femme' },
    { value: 'double-homme', label: 'Double Homme' },
    { value: 'double-femme', label: 'Double Femme' },
    { value: 'mixte', label: 'Mixte' },
  ];

  name = '';
  date = '';
  description = '';

  readonly selectedGameTypes = signal<GameType[]>([]);
  readonly submitted = signal(false);
  readonly saving = signal(false);
  readonly errorMessage = signal('');

  onGameTypeChange(value: GameType, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    const current = this.selectedGameTypes();

    if (checked) {
      this.selectedGameTypes.set([...current, value]);
    } else {
      this.selectedGameTypes.set(current.filter((t) => t !== value));
    }
  }

  async onSubmit(): Promise<void> {
    this.submitted.set(true);
    this.errorMessage.set('');

    if (!this.name || !this.date || this.selectedGameTypes().length === 0) {
      return;
    }

    this.saving.set(true);

    try {
      await this.tournamentService.createTournament({
        name: this.name,
        date: this.date,
        ...(this.description ? { description: this.description } : {}),
        gameTypes: this.selectedGameTypes(),
      });

      this.router.navigate(['/admin']);
    } catch {
      this.errorMessage.set('Une erreur est survenue lors de la création du tournoi.');
    } finally {
      this.saving.set(false);
    }
  }

  onCancel(): void {
    this.router.navigate(['/admin']);
  }
}
