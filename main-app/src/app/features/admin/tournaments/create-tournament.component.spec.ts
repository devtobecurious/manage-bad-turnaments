import { TestBed } from '@angular/core/testing';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { provideRouter } from '@angular/router';
import { Router } from '@angular/router';
import { CreateTournamentComponent } from './create-tournament.component';
import { TournamentService } from '../../../core/services/tournament.service';
import { Tournament } from '../../../core/models/tournament.model';

const mockTournament: Tournament = {
  id: 'new-id',
  name: 'Tournoi Test',
  date: '2026-09-01',
  gameTypes: ['simple-homme'],
  status: 'Brouillon',
  participationToken: null,
  createdAt: '2026-05-13T12:00:00Z',
};

describe('CreateTournamentComponent', () => {
  let component: CreateTournamentComponent;
  let tournamentServiceMock: { createTournament: ReturnType<typeof vi.fn> };
  let router: Router;

  beforeEach(async () => {
    tournamentServiceMock = {
      createTournament: vi.fn().mockResolvedValue(mockTournament),
    };

    await TestBed.configureTestingModule({
      imports: [CreateTournamentComponent],
      providers: [
        { provide: TournamentService, useValue: tournamentServiceMock },
        provideRouter([]),
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(CreateTournamentComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    // Prevent "Cannot match any routes" unhandled rejections in tests
    vi.spyOn(router, 'navigate').mockResolvedValue(true);
  });

  it('should be created', () => {
    expect(component).toBeTruthy();
  });

  it('should display 5 game type options — AC: multi-types de jeu', () => {
    expect(component.gameTypeOptions).toHaveLength(5);
    const values = component.gameTypeOptions.map((o) => o.value);
    expect(values).toContain('simple-homme');
    expect(values).toContain('simple-femme');
    expect(values).toContain('double-homme');
    expect(values).toContain('double-femme');
    expect(values).toContain('mixte');
  });

  it('should start with no game types selected — AC: multi-select', () => {
    expect(component.selectedGameTypes()).toHaveLength(0);
  });

  it('onGameTypeChange() should add a game type when checked — AC: sélection multi-types', () => {
    const event = { target: { checked: true } } as unknown as Event;
    component.onGameTypeChange('simple-homme', event);
    expect(component.selectedGameTypes()).toContain('simple-homme');
  });

  it('onGameTypeChange() should remove a game type when unchecked — AC: sélection multi-types', () => {
    const addEvent = { target: { checked: true } } as unknown as Event;
    component.onGameTypeChange('simple-homme', addEvent);
    component.onGameTypeChange('double-homme', addEvent);

    const removeEvent = { target: { checked: false } } as unknown as Event;
    component.onGameTypeChange('simple-homme', removeEvent);

    expect(component.selectedGameTypes()).not.toContain('simple-homme');
    expect(component.selectedGameTypes()).toContain('double-homme');
  });

  it('onGameTypeChange() can select multiple types — AC: multi-types de jeu', () => {
    const event = { target: { checked: true } } as unknown as Event;
    component.onGameTypeChange('simple-homme', event);
    component.onGameTypeChange('mixte', event);
    component.onGameTypeChange('double-femme', event);

    expect(component.selectedGameTypes()).toHaveLength(3);
  });

  it('onSubmit() should not call createTournament when name is empty — AC: saisie obligatoire', async () => {
    component.name = '';
    component.date = '2026-09-01';
    const event = { target: { checked: true } } as unknown as Event;
    component.onGameTypeChange('mixte', event);

    await component.onSubmit();

    expect(tournamentServiceMock.createTournament).not.toHaveBeenCalled();
  });

  it('onSubmit() should not call createTournament when date is empty — AC: saisie obligatoire', async () => {
    component.name = 'Tournoi Test';
    component.date = '';
    const event = { target: { checked: true } } as unknown as Event;
    component.onGameTypeChange('mixte', event);

    await component.onSubmit();

    expect(tournamentServiceMock.createTournament).not.toHaveBeenCalled();
  });

  it('onSubmit() should not call createTournament when no game type selected — AC: multi-types obligatoires', async () => {
    component.name = 'Tournoi Test';
    component.date = '2026-09-01';

    await component.onSubmit();

    expect(tournamentServiceMock.createTournament).not.toHaveBeenCalled();
  });

  it('onSubmit() should call createTournament with correct data — AC: saisie complète', async () => {
    component.name = 'Tournoi Printemps';
    component.date = '2026-05-01';
    component.description = 'Description du tournoi';

    const event = { target: { checked: true } } as unknown as Event;
    component.onGameTypeChange('simple-homme', event);
    component.onGameTypeChange('mixte', event);

    await component.onSubmit();

    expect(tournamentServiceMock.createTournament).toHaveBeenCalledWith({
      name: 'Tournoi Printemps',
      date: '2026-05-01',
      description: 'Description du tournoi',
      gameTypes: ['simple-homme', 'mixte'],
    });
  });

  it('onSubmit() should call createTournament without description when empty — AC: description optionnelle', async () => {
    component.name = 'Tournoi Printemps';
    component.date = '2026-05-01';
    component.description = '';

    const event = { target: { checked: true } } as unknown as Event;
    component.onGameTypeChange('mixte', event);

    await component.onSubmit();

    const callArg = tournamentServiceMock.createTournament.mock.calls[0][0] as Record<string, unknown>;
    expect(callArg).not.toHaveProperty('description');
  });

  it('onSubmit() should set saving signal during creation — AC: UX', async () => {
    component.name = 'Tournoi Test';
    component.date = '2026-09-01';
    const event = { target: { checked: true } } as unknown as Event;
    component.onGameTypeChange('simple-homme', event);

    let wasTrue = false;
    tournamentServiceMock.createTournament.mockImplementationOnce(async () => {
      wasTrue = component.saving();
      return mockTournament;
    });

    await component.onSubmit();

    expect(wasTrue).toBe(true);
    expect(component.saving()).toBe(false);
  });

  it('onSubmit() should navigate to /admin after successful creation — AC: redirection', async () => {
    component.name = 'Tournoi Test';
    component.date = '2026-09-01';
    const event = { target: { checked: true } } as unknown as Event;
    component.onGameTypeChange('mixte', event);

    const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    await component.onSubmit();

    expect(navigateSpy).toHaveBeenCalledWith(['/admin']);
  });

  it('onSubmit() should show error message when service throws — AC: gestion erreur', async () => {
    component.name = 'Tournoi Test';
    component.date = '2026-09-01';
    const event = { target: { checked: true } } as unknown as Event;
    component.onGameTypeChange('mixte', event);

    tournamentServiceMock.createTournament.mockRejectedValueOnce(new Error('Firestore error'));

    await component.onSubmit();

    expect(component.errorMessage()).toBeTruthy();
    expect(component.saving()).toBe(false);
  });

  it('onCancel() should navigate to /admin — AC: annulation', () => {
    const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    component.onCancel();
    expect(navigateSpy).toHaveBeenCalledWith(['/admin']);
  });
});
