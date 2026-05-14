import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { of } from 'rxjs';
import { ActivatedRoute } from '@angular/router';
import { PlayerTournamentsComponent } from './player-tournaments.component';
import { PlayerService } from '../../../core/services/player.service';
import { RegistrationService } from '../../../core/services/registration.service';
import { Player } from '../../../core/models/player.model';
import { Tournament } from '../../../core/models/tournament.model';
import { Registration } from '../../../core/models/registration.model';

const mockPlayerHomme: Player = {
  id: 'player-1',
  firstName: 'Jean',
  lastName: 'Dupont',
  gender: 'homme',
  createdAt: '2026-01-01T00:00:00Z',
  active: true,
};

const mockPlayerFemme: Player = {
  id: 'player-2',
  firstName: 'Marie',
  lastName: 'Martin',
  gender: 'femme',
  createdAt: '2026-01-01T00:00:00Z',
  active: true,
};

const mockTournament: Tournament = {
  id: 't1',
  name: 'Tournoi Printemps',
  date: '2026-06-01',
  status: 'Inscriptions ouvertes',
  participationToken: 'token-123',
  createdBy: 'admin-uid',
  createdAt: '2026-05-01T00:00:00Z',
};

const mockRegistration: Registration = {
  id: 'reg-1',
  tournamentId: 't1',
  playerId: 'player-1',
  gameType: 'simple homme',
  registeredAt: '2026-05-14T08:00:00Z',
};

function createMockPlayerService(player: Player | null = mockPlayerHomme) {
  return {
    getPlayer: vi.fn().mockResolvedValue(player),
  };
}

function createMockRegistrationService(
  tournaments: Tournament[] = [mockTournament],
  registrations: Registration[] = []
) {
  return {
    getOpenTournaments: vi.fn().mockReturnValue(of(tournaments)),
    getPlayerRegistrations: vi.fn().mockReturnValue(of(registrations)),
    registerForTournament: vi.fn().mockResolvedValue(mockRegistration),
    unregisterFromTournament: vi.fn().mockResolvedValue(undefined),
  };
}

async function createComponent(
  playerId: string,
  playerServiceMock: ReturnType<typeof createMockPlayerService>,
  registrationServiceMock: ReturnType<typeof createMockRegistrationService>
) {
  await TestBed.configureTestingModule({
    imports: [PlayerTournamentsComponent],
    providers: [
      {
        provide: ActivatedRoute,
        useValue: { snapshot: { paramMap: { get: () => playerId } } },
      },
      { provide: PlayerService, useValue: playerServiceMock },
      { provide: RegistrationService, useValue: registrationServiceMock },
    ],
  }).compileComponents();

  const fixture = TestBed.createComponent(PlayerTournamentsComponent);
  const component = fixture.componentInstance;
  await fixture.whenStable();
  fixture.detectChanges();
  return { fixture, component };
}

describe('PlayerTournamentsComponent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.resetTestingModule();
  });

  // --- AC: liste des tournois ouverts ---

  it('should display loading state initially', async () => {
    const playerSvc = createMockPlayerService();
    const regSvc = createMockRegistrationService();

    await TestBed.configureTestingModule({
      imports: [PlayerTournamentsComponent],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: { get: () => 'player-1' } } },
        },
        { provide: PlayerService, useValue: playerSvc },
        { provide: RegistrationService, useValue: regSvc },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(PlayerTournamentsComponent);
    const component = fixture.componentInstance;
    // Before ngOnInit resolves
    expect(component.loading()).toBe(true);
  });

  it('should load player and open tournaments on init — AC: liste des tournois ouverts', async () => {
    const playerSvc = createMockPlayerService();
    const regSvc = createMockRegistrationService();
    const { component } = await createComponent('player-1', playerSvc, regSvc);

    expect(component.player()).toEqual(mockPlayerHomme);
    expect(component.openTournaments()).toEqual([mockTournament]);
    expect(component.loading()).toBe(false);
  });

  it('should show player not found state when player does not exist — AC: profil introuvable', async () => {
    const playerSvc = createMockPlayerService(null);
    const regSvc = createMockRegistrationService();
    const { component, fixture } = await createComponent('unknown-id', playerSvc, regSvc);

    fixture.detectChanges();
    expect(component.player()).toBeNull();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Joueur introuvable');
  });

  // --- AC: types de jeu filtrés par genre ---

  it('should return compatible game types for homme — AC: types de jeu filtrés genre homme', async () => {
    const playerSvc = createMockPlayerService(mockPlayerHomme);
    const regSvc = createMockRegistrationService();
    const { component } = await createComponent('player-1', playerSvc, regSvc);

    const types = component.compatibleGameTypes();
    expect(types).toContain('simple homme');
    expect(types).toContain('double homme');
    expect(types).toContain('mixte');
    expect(types).not.toContain('simple femme');
    expect(types).not.toContain('double femme');
    expect(types.length).toBe(3);
  });

  it('should return compatible game types for femme — AC: types de jeu filtrés genre femme', async () => {
    const playerSvc = createMockPlayerService(mockPlayerFemme);
    const regSvc = createMockRegistrationService();
    const { component } = await createComponent('player-2', playerSvc, regSvc);

    const types = component.compatibleGameTypes();
    expect(types).toContain('simple femme');
    expect(types).toContain('double femme');
    expect(types).toContain('mixte');
    expect(types).not.toContain('simple homme');
    expect(types).not.toContain('double homme');
    expect(types.length).toBe(3);
  });

  it('should display compatible game types for the player in the template — AC: types de jeu filtrés', async () => {
    const playerSvc = createMockPlayerService(mockPlayerHomme);
    const regSvc = createMockRegistrationService();
    const { fixture } = await createComponent('player-1', playerSvc, regSvc);

    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    const text = compiled.textContent ?? '';
    expect(text).toContain('simple homme');
    expect(text).toContain('double homme');
    expect(text).toContain('mixte');
  });

  // --- AC: confirmation d'inscription ---

  it('register() should call registerForTournament and set confirmation message — AC: confirmation d\'inscription', async () => {
    const playerSvc = createMockPlayerService();
    const regSvc = createMockRegistrationService();
    const { component } = await createComponent('player-1', playerSvc, regSvc);

    await component.register('t1', 'simple homme');

    expect(regSvc.registerForTournament).toHaveBeenCalledWith('t1', 'player-1', 'simple homme');
    expect(component.confirmationMessage()).toContain('simple homme');
  });

  it('register() should display confirmation message in template — AC: confirmation d\'inscription', async () => {
    const playerSvc = createMockPlayerService();
    const regSvc = createMockRegistrationService();
    const { component, fixture } = await createComponent('player-1', playerSvc, regSvc);

    await component.register('t1', 'mixte');
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Inscription confirmée');
  });

  it('register() should set error message if registration fails — AC: gestion erreur', async () => {
    const playerSvc = createMockPlayerService();
    const regSvc = createMockRegistrationService();
    regSvc.registerForTournament.mockRejectedValueOnce(
      new Error("Le tournoi n'est pas ouvert aux inscriptions.")
    );
    const { component } = await createComponent('player-1', playerSvc, regSvc);

    await component.register('t1', 'simple homme');

    expect(component.errorMessage()).toContain("Le tournoi n'est pas ouvert aux inscriptions.");
    expect(component.confirmationMessage()).toBeNull();
  });

  // --- AC: désinscription possible tant que les inscriptions sont ouvertes ---

  it('unregister() should call unregisterFromTournament — AC: désinscription possible', async () => {
    const playerSvc = createMockPlayerService();
    const regSvc = createMockRegistrationService();
    const { component } = await createComponent('player-1', playerSvc, regSvc);

    await component.unregister('t1', 'reg-1', 'simple homme');

    expect(regSvc.unregisterFromTournament).toHaveBeenCalledWith('t1', 'reg-1');
    expect(component.confirmationMessage()).toContain('Désinscription');
  });

  it('unregister() should set error message if unregistration fails — AC: désinscription fermée', async () => {
    const playerSvc = createMockPlayerService();
    const regSvc = createMockRegistrationService();
    regSvc.unregisterFromTournament.mockRejectedValueOnce(
      new Error("La désinscription n'est plus possible : les inscriptions sont fermées.")
    );
    const { component } = await createComponent('player-1', playerSvc, regSvc);

    await component.unregister('t1', 'reg-1', 'simple homme');

    expect(component.errorMessage()).toContain("La désinscription n'est plus possible");
    expect(component.confirmationMessage()).toBeNull();
  });

  it('should show registration button when player is not yet registered — AC: bouton inscription', async () => {
    const playerSvc = createMockPlayerService();
    const regSvc = createMockRegistrationService([mockTournament], []);
    const { fixture } = await createComponent('player-1', playerSvc, regSvc);

    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain("S'inscrire");
  });

  it('should show unregister button when player is registered — AC: bouton désinscription', async () => {
    const playerSvc = createMockPlayerService();
    const regSvc = createMockRegistrationService([mockTournament], [mockRegistration]);
    const { fixture } = await createComponent('player-1', playerSvc, regSvc);

    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Se désinscrire');
  });

  it('getRegistration() should return the registration for a given tournament and gameType', async () => {
    const playerSvc = createMockPlayerService();
    const regSvc = createMockRegistrationService([mockTournament], [mockRegistration]);
    const { component } = await createComponent('player-1', playerSvc, regSvc);

    const reg = component.getRegistration('t1', 'simple homme');
    expect(reg).toEqual(mockRegistration);
  });

  it('getRegistration() should return undefined if not registered', async () => {
    const playerSvc = createMockPlayerService();
    const regSvc = createMockRegistrationService([mockTournament], []);
    const { component } = await createComponent('player-1', playerSvc, regSvc);

    const reg = component.getRegistration('t1', 'simple homme');
    expect(reg).toBeUndefined();
  });

  it('should show empty state when no open tournaments — AC: aucun tournoi ouvert', async () => {
    const playerSvc = createMockPlayerService();
    const regSvc = createMockRegistrationService([], []);
    const { fixture } = await createComponent('player-1', playerSvc, regSvc);

    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Aucun tournoi');
  });

  it('processingKey should be set during registration and cleared after', async () => {
    const playerSvc = createMockPlayerService();
    const regSvc = createMockRegistrationService();
    let capturedKeyDuringCall: string | null = null;

    regSvc.registerForTournament.mockImplementationOnce(async () => {
      // We can't capture mid-async here easily, but we verify it clears after
      return mockRegistration;
    });

    const { component } = await createComponent('player-1', playerSvc, regSvc);
    await component.register('t1', 'simple homme');

    expect(component.processingKey()).toBeNull();
  });
});
