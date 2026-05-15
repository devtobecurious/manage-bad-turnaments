import {
  Component,
  input,
  output,
  signal,
  computed,
  inject,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatchService } from '../../../core/services/match.service';
import { Match, SetScore, validateSet, validateMatch } from '../../../core/models/match.model';

interface SetForm {
  a: string;
  b: string;
}

@Component({
  selector: 'app-score-entry',
  standalone: true,
  imports: [FormsModule],
  template: `
    <!-- Modal backdrop -->
    <div
      class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      (click)="onBackdropClick($event)"
    >
      <div
        class="bg-white rounded-2xl shadow-xl w-full max-w-lg"
        (click)="$event.stopPropagation()"
      >
        <!-- Header -->
        <div class="px-6 pt-6 pb-4 border-b border-gray-100">
          <h2 class="text-lg font-semibold text-gray-900">Saisie du score</h2>
          <p class="text-sm text-gray-500 mt-1">
            <span class="font-medium text-indigo-700">{{ match().participantA.name }}</span>
            <span class="mx-2 text-gray-400">vs</span>
            <span class="font-medium text-indigo-700">{{ match().participantB.name }}</span>
          </p>
        </div>

        <!-- Body -->
        <div class="px-6 py-4 space-y-5">

          <!-- Forfeit toggle -->
          <div class="flex items-center gap-3">
            <input
              id="forfeit-toggle"
              type="checkbox"
              [checked]="forfeitMode()"
              (change)="toggleForfeit()"
              class="w-4 h-4 text-indigo-600 rounded border-gray-300"
            />
            <label for="forfeit-toggle" class="text-sm font-medium text-gray-700 cursor-pointer">
              Forfait
            </label>
          </div>

          @if (forfeitMode()) {
            <!-- Forfeit selection -->
            <div class="space-y-2">
              <p class="text-sm text-gray-600">Qui déclare forfait ?</p>
              <div class="flex flex-col gap-2">
                <label class="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="forfeit-participant"
                    [value]="match().participantA.id"
                    [checked]="forfeitParticipantId() === match().participantA.id"
                    (change)="forfeitParticipantId.set(match().participantA.id)"
                    class="text-indigo-600"
                  />
                  <span class="text-sm text-gray-800">{{ match().participantA.name }}</span>
                </label>
                <label class="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="forfeit-participant"
                    [value]="match().participantB.id"
                    [checked]="forfeitParticipantId() === match().participantB.id"
                    (change)="forfeitParticipantId.set(match().participantB.id)"
                    class="text-indigo-600"
                  />
                  <span class="text-sm text-gray-800">{{ match().participantB.name }}</span>
                </label>
              </div>
            </div>
          } @else {
            <!-- Set scores -->
            <div class="space-y-3">
              <!-- Column headers -->
              <div class="grid grid-cols-[1fr_2rem_1fr_2.5rem] gap-2 items-center">
                <span class="text-xs font-semibold text-gray-500 text-center truncate">
                  {{ match().participantA.name }}
                </span>
                <span></span>
                <span class="text-xs font-semibold text-gray-500 text-center truncate">
                  {{ match().participantB.name }}
                </span>
                <span></span>
              </div>

              @for (set of sets(); track $index; let i = $index) {
                <div class="grid grid-cols-[1fr_2rem_1fr_2.5rem] gap-2 items-center">
                  <!-- Score A -->
                  <input
                    type="number"
                    min="0"
                    max="30"
                    [value]="set.a"
                    (input)="updateSetA(i, $event)"
                    class="w-full text-center border rounded-lg px-2 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                    [class.border-red-400]="isSetInvalid(i)"
                    [class.border-green-400]="isSetValid(i)"
                    [class.border-gray-300]="!isSetInvalid(i) && !isSetValid(i)"
                    placeholder="0"
                  />

                  <span class="text-center text-gray-400 text-sm font-bold">—</span>

                  <!-- Score B -->
                  <input
                    type="number"
                    min="0"
                    max="30"
                    [value]="set.b"
                    (input)="updateSetB(i, $event)"
                    class="w-full text-center border rounded-lg px-2 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                    [class.border-red-400]="isSetInvalid(i)"
                    [class.border-green-400]="isSetValid(i)"
                    [class.border-gray-300]="!isSetInvalid(i) && !isSetValid(i)"
                    placeholder="0"
                  />

                  <!-- Remove set button (only for non-first sets) -->
                  @if (i > 0 && i === sets().length - 1) {
                    <button
                      type="button"
                      (click)="removeLastSet()"
                      class="text-gray-400 hover:text-red-500 transition-colors text-xs px-1"
                      title="Supprimer ce set"
                    >
                      ✕
                    </button>
                  } @else {
                    <span class="text-xs text-center text-gray-400 font-medium">
                      Set {{ i + 1 }}
                    </span>
                  }
                </div>

                <!-- Set validation feedback -->
                @if (isSetInvalid(i)) {
                  <p class="text-xs text-red-500 -mt-1 ml-1">
                    Score invalide — min 21 pts, 2 pts d'écart, max 30-29
                  </p>
                }
              }

              <!-- Add set button (max 3 sets) -->
              @if (sets().length < 3 && canAddSet()) {
                <button
                  type="button"
                  (click)="addSet()"
                  class="text-sm text-indigo-600 hover:text-indigo-800 font-medium transition-colors"
                >
                  + Ajouter un set
                </button>
              }
            </div>

            <!-- Match validation summary -->
            @if (matchValidationError()) {
              <div class="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <p class="text-xs text-amber-700">{{ matchValidationError() }}</p>
              </div>
            }

            @if (currentWinnerName()) {
              <div class="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center gap-2">
                <span class="text-green-600 text-sm">Vainqueur :</span>
                <span class="text-green-800 text-sm font-semibold">{{ currentWinnerName() }}</span>
              </div>
            }
          }

          <!-- Error display -->
          @if (error()) {
            <div class="bg-red-50 border border-red-200 rounded-lg p-3">
              <p class="text-sm text-red-700">{{ error() }}</p>
            </div>
          }
        </div>

        <!-- Footer -->
        <div class="px-6 pb-6 pt-2 flex gap-3 justify-end">
          <button
            type="button"
            (click)="cancel.emit()"
            class="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
          >
            Annuler
          </button>
          <button
            type="button"
            (click)="save()"
            [disabled]="!canSave() || saving()"
            class="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            @if (saving()) {
              Enregistrement…
            } @else {
              Enregistrer
            }
          </button>
        </div>
      </div>
    </div>
  `,
})
export class ScoreEntryComponent {
  readonly match = input.required<Match>();
  readonly tournamentId = input.required<string>();
  readonly poolId = input.required<string>();

  readonly cancel = output<void>();
  readonly saved = output<void>();

  private readonly matchService = inject(MatchService);

  readonly forfeitMode = signal(false);
  readonly forfeitParticipantId = signal<string>('');
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);

  // Sets: array of { a: string, b: string } for form binding
  readonly sets = signal<SetForm[]>([{ a: '', b: '' }]);

  toggleForfeit(): void {
    this.forfeitMode.update((v) => !v);
    this.forfeitParticipantId.set('');
    this.error.set(null);
  }

  updateSetA(index: number, event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.sets.update((sets) => {
      const copy = [...sets];
      copy[index] = { ...copy[index], a: value };
      return copy;
    });
  }

  updateSetB(index: number, event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.sets.update((sets) => {
      const copy = [...sets];
      copy[index] = { ...copy[index], b: value };
      return copy;
    });
  }

  addSet(): void {
    if (this.sets().length < 3) {
      this.sets.update((sets) => [...sets, { a: '', b: '' }]);
    }
  }

  removeLastSet(): void {
    this.sets.update((sets) => {
      if (sets.length > 1) return sets.slice(0, -1);
      return sets;
    });
  }

  private parsedSets = computed((): SetScore[] => {
    return this.sets()
      .map((s) => ({ a: parseInt(s.a, 10), b: parseInt(s.b, 10) }))
      .filter((s) => !isNaN(s.a) && !isNaN(s.b));
  });

  isSetValid(index: number): boolean {
    const set = this.sets()[index];
    const a = parseInt(set.a, 10);
    const b = parseInt(set.b, 10);
    if (isNaN(a) || isNaN(b)) return false;
    return validateSet(a, b);
  }

  isSetInvalid(index: number): boolean {
    const set = this.sets()[index];
    const a = parseInt(set.a, 10);
    const b = parseInt(set.b, 10);
    // Only show invalid if both are filled
    if (isNaN(a) || isNaN(b) || set.a === '' || set.b === '') return false;
    return !validateSet(a, b);
  }

  readonly canAddSet = computed(() => {
    // Can add a set if there's no match winner determined yet from current sets
    const parsed = this.parsedSets();
    if (parsed.length !== this.sets().length) return false; // not all sets filled
    let winsA = 0;
    let winsB = 0;
    for (const s of parsed) {
      if (validateSet(s.a, s.b)) {
        if (s.a > s.b) winsA++;
        else winsB++;
      }
    }
    return winsA < 2 && winsB < 2;
  });

  readonly matchValidationError = computed((): string | null => {
    if (this.forfeitMode()) return null;
    const parsed = this.parsedSets();
    if (parsed.length === 0) return null;
    // Only validate when all current set fields are filled
    if (parsed.length !== this.sets().length) return null;
    const result = validateMatch(parsed);
    if (!result.valid && result.error) return result.error;
    return null;
  });

  readonly currentWinnerName = computed((): string | null => {
    if (this.forfeitMode()) {
      const forfeitId = this.forfeitParticipantId();
      if (!forfeitId) return null;
      const m = this.match();
      return forfeitId === m.participantA.id
        ? m.participantB.name
        : m.participantA.name;
    }
    const parsed = this.parsedSets();
    if (parsed.length !== this.sets().length) return null;
    const result = validateMatch(parsed);
    if (!result.valid) return null;
    let winsA = 0;
    let winsB = 0;
    for (const s of parsed) {
      if (validateSet(s.a, s.b)) {
        if (s.a > s.b) winsA++;
        else winsB++;
      }
    }
    const m = this.match();
    if (winsA >= 2) return m.participantA.name;
    if (winsB >= 2) return m.participantB.name;
    return null;
  });

  readonly canSave = computed((): boolean => {
    if (this.forfeitMode()) {
      return this.forfeitParticipantId() !== '';
    }
    const parsed = this.parsedSets();
    if (parsed.length !== this.sets().length) return false;
    const result = validateMatch(parsed);
    return result.valid;
  });

  async save(): Promise<void> {
    if (!this.canSave()) return;
    this.saving.set(true);
    this.error.set(null);

    try {
      const m = this.match();
      const forfeitId = this.forfeitMode() ? this.forfeitParticipantId() : undefined;
      const sets: SetScore[] = this.forfeitMode() ? [] : this.parsedSets();

      await this.matchService.updateMatchScore(
        this.tournamentId(),
        this.poolId(),
        m.id,
        sets,
        forfeitId
      );

      this.saved.emit();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur lors de la sauvegarde.';
      this.error.set(message);
    } finally {
      this.saving.set(false);
    }
  }

  onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.cancel.emit();
    }
  }
}
