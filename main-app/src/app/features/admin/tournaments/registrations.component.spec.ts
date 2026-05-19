import { TestBed } from '@angular/core/testing';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { of } from 'rxjs';
import { By } from '@angular/platform-browser';
import { RegistrationsComponent } from './registrations.component';
import { RegistrationService } from '../../../core/services/registration.service';
import { PlayerService } from '../../../core/services/player.service';
import { ActivatedRoute } from '@angular/router';
import { Registration } from '../../../core/models/registration.model';
import { Player } from '../../../core/models/player.model';

const mockPlayers: Player[] = [
  { id: 'p1', firstName: 'Alice', lastName: 'Dupont', gender: 'femme', active: true, createdAt: '2026-05-01T00:00:00Z' },
  { id: 'p2', firstName: 'Bob', lastName: 'Martin', gender: 'homme', active: true, createdAt: '2026-05-01T00:00:00Z' },
  { id: 'p3', firstName: 'Claire', lastName: 'Bernard', gender: 'femme', active: true, createdAt: '2026-05-01T00:00:00Z' },
  { id: 'p4', firstName: 'David', lastName: 'Petit', gender: 'homme', active: false, createdAt: '2026-05-01T00:00:00Z' },
];

const makeRegistration = (overrides: Partial<Registration> = {}): Registration => ({
  id: 'r1',
  tournamentId: 't1',
  playerId: 'p1',
  gameType: 'simple-homme',
  registeredAt: '2026-05-13T10:00:00Z',
  ...overrides,
});

describe('RegistrationsComponent', () => {
  let mockRegistrationService: {
    getRegistrations: ReturnType<typeof vi.fn>;
    addRegistration: ReturnType<typeof vi.fn>;
    removeRegistration: ReturnType<typeof vi.fn>;
  };
  let mockPlayerService: { getPlayers: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    vi.clearAllMocks();

    mockRegistrationService = {
      getRegistrations: vi.fn().mockReturnValue(of([])),
      addRegistration: vi.fn().mockResolvedValue(makeRegistration()),
      removeRegistration: vi.fn().mockResolvedValue(undefined),
    };

    mockPlayerService = {
      getPlayers: vi.fn().mockReturnValue(of(mockPlayers)),
    };
  });

  function createComponent(tournamentId = 't1') {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [RegistrationsComponent],
      providers: [
        { provide: RegistrationService, useValue: mockRegistrationService },
        { provide: PlayerService, useValue: mockPlayerService },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: { get: () => tournamentId } } },
        },
      ],
    });
    const fixture = TestBed.createComponent(RegistrationsComponent);
    fixture.detectChanges();
    return fixture;
  }

  it('should create the component', () => {
    const fixture = createComponent();
    expect(fixture.componentInstance).toBeTruthy();
  });

  // --- AC: Vue par type de jeu ---

  it('should display a tab for each game type — AC: vue par type de jeu', () => {
    const fixture = createComponent();
    const buttons = fixture.debugElement.queryAll(By.css('button'));
    const tabLabels = ['Simple Homme', 'Simple Femme', 'Double Homme', 'Double Femme', 'Double Mixte'];
    const buttonTexts = buttons.map((b) => b.nativeElement.textContent.trim());
    for (const label of tabLabels) {
      expect(buttonTexts.some((t) => t.includes(label))).toBe(true);
    }
  });

  it('should show default active tab as "simple-homme" — AC: vue par type de jeu', () => {
    const fixture = createComponent();
    expect(fixture.componentInstance.activeTab()).toBe('simple-homme');
  });

  it('should switch active tab on selectTab() — AC: vue par type de jeu avec onglets', () => {
    const fixture = createComponent();
    fixture.componentInstance.selectTab('double-homme');
    fixture.detectChanges();
    expect(fixture.componentInstance.activeTab()).toBe('double-homme');
  });

  it('should call getRegistrations for each game type on init — AC: liste inscrits par type', () => {
    createComponent('tournament-abc');
    expect(mockRegistrationService.getRegistrations).toHaveBeenCalledWith('tournament-abc', 'simple-homme');
    expect(mockRegistrationService.getRegistrations).toHaveBeenCalledWith('tournament-abc', 'double-homme');
    expect(mockRegistrationService.getRegistrations).toHaveBeenCalledWith('tournament-abc', 'double-mixte');
  });

  // --- AC: compteur total ---

  it('should track registration count per game type — AC: compteur total inscrits', () => {
    const regs = [
      makeRegistration({ id: 'r1', playerId: 'p1', gameType: 'simple-homme' }),
      makeRegistration({ id: 'r2', playerId: 'p2', gameType: 'simple-homme' }),
    ];
    mockRegistrationService.getRegistrations.mockImplementation((_tournamentId: string, gameType?: string) => {
      if (gameType === 'simple-homme') return of(regs);
      return of([]);
    });

    const fixture = createComponent();
    fixture.detectChanges();

    expect(fixture.componentInstance.countForTab('simple-homme')).toBe(2);
    expect(fixture.componentInstance.countForTab('double-homme')).toBe(0);
  });

  // --- AC: ajouter un joueur ---

  it('should show a player select dropdown — AC: ajout manuel joueur', () => {
    const fixture = createComponent();
    const select = fixture.debugElement.query(By.css('select'));
    expect(select).not.toBeNull();
  });

  it('should list active players in the dropdown — AC: ajout manuel joueur', () => {
    const fixture = createComponent();
    const options = fixture.debugElement.queryAll(By.css('option'));
    const optionValues = options.map((o) => o.nativeElement.value);
    expect(optionValues).toContain('p1');
    expect(optionValues).toContain('p2');
    expect(optionValues).toContain('p3');
    expect(optionValues).not.toContain('p4');
  });

  it('addPlayer() should call addRegistration with correct data — AC: ajout manuel joueur', async () => {
    const fixture = createComponent();
    fixture.componentInstance.selectTab('double-femme');
    fixture.componentInstance.selectedPlayerId = 'p2';

    await fixture.componentInstance.addPlayer();

    expect(mockRegistrationService.addRegistration).toHaveBeenCalledWith({
      tournamentId: 't1',
      playerId: 'p2',
      gameType: 'double-femme',
    });
  });

  it('addPlayer() should not call addRegistration if no player selected — AC: ajout impossible sans sélection', async () => {
    const fixture = createComponent();
    fixture.componentInstance.selectedPlayerId = '';

    await fixture.componentInstance.addPlayer();

    expect(mockRegistrationService.addRegistration).not.toHaveBeenCalled();
  });

  it('addPlayer() should reset selectedPlayerId after success — AC: ajout manuel joueur', async () => {
    const fixture = createComponent();
    fixture.componentInstance.selectedPlayerId = 'p1';

    await fixture.componentInstance.addPlayer();

    expect(fixture.componentInstance.selectedPlayerId).toBe('');
  });

  it('addPlayer() should set addError on failure — AC: gestion erreur ajout', async () => {
    const fixture = createComponent();
    mockRegistrationService.addRegistration.mockRejectedValueOnce(new Error('Network error'));
    fixture.componentInstance.selectedPlayerId = 'p1';

    await fixture.componentInstance.addPlayer();

    expect(fixture.componentInstance.addError()).toBeTruthy();
  });

  // --- AC: supprimer un joueur ---

  it('removePlayer() should call removeRegistration with correct ids — AC: suppression manuelle joueur', async () => {
    const fixture = createComponent();

    await fixture.componentInstance.removePlayer('reg-abc');

    expect(mockRegistrationService.removeRegistration).toHaveBeenCalledWith('t1', 'reg-abc');
  });

  it('removePlayer() should reset removing signal after completion — AC: suppression manuelle joueur', async () => {
    const fixture = createComponent();

    await fixture.componentInstance.removePlayer('r1');

    expect(fixture.componentInstance.removing()).toBeNull();
  });

  // --- AC: alerte si nombre impair pour double/mixte ---

  it('showParityAlert should be false for simple-homme even with odd count — AC: alerte uniquement double/mixte', () => {
    const regs = [makeRegistration({ id: 'r1', playerId: 'p1', gameType: 'simple-homme' })];
    mockRegistrationService.getRegistrations.mockImplementation((_tournamentId: string, gameType?: string) => {
      if (gameType === 'simple-homme') return of(regs);
      return of([]);
    });

    const fixture = createComponent();
    fixture.componentInstance.activeTab.set('simple-homme');
    fixture.detectChanges();

    expect(fixture.componentInstance.showParityAlert()).toBe(false);
  });

  it('showParityAlert should be true for double-homme with odd count — AC: alerte si impair double', () => {
    const regs = [
      makeRegistration({ id: 'r1', playerId: 'p1', gameType: 'double-homme' }),
      makeRegistration({ id: 'r2', playerId: 'p2', gameType: 'double-homme' }),
      makeRegistration({ id: 'r3', playerId: 'p3', gameType: 'double-homme' }),
    ];
    mockRegistrationService.getRegistrations.mockImplementation((_tournamentId: string, gameType?: string) => {
      if (gameType === 'double-homme') return of(regs);
      return of([]);
    });

    const fixture = createComponent();
    fixture.componentInstance.activeTab.set('double-homme');
    fixture.detectChanges();

    expect(fixture.componentInstance.showParityAlert()).toBe(true);
  });

  it('showParityAlert should be false for double-homme with even count — AC: pas d\'alerte si pair', () => {
    const regs = [
      makeRegistration({ id: 'r1', playerId: 'p1', gameType: 'double-homme' }),
      makeRegistration({ id: 'r2', playerId: 'p2', gameType: 'double-homme' }),
    ];
    mockRegistrationService.getRegistrations.mockImplementation((_tournamentId: string, gameType?: string) => {
      if (gameType === 'double-homme') return of(regs);
      return of([]);
    });

    const fixture = createComponent();
    fixture.componentInstance.activeTab.set('double-homme');
    fixture.detectChanges();

    expect(fixture.componentInstance.showParityAlert()).toBe(false);
  });

  it('showParityAlert should be true for double-mixte with odd count — AC: alerte si impair mixte', () => {
    const regs = [makeRegistration({ id: 'r1', playerId: 'p1', gameType: 'double-mixte' })];
    mockRegistrationService.getRegistrations.mockImplementation((_tournamentId: string, gameType?: string) => {
      if (gameType === 'double-mixte') return of(regs);
      return of([]);
    });

    const fixture = createComponent();
    fixture.componentInstance.activeTab.set('double-mixte');
    fixture.detectChanges();

    expect(fixture.componentInstance.showParityAlert()).toBe(true);
  });

  it('showParityAlert should be true for double-femme with odd count — AC: alerte si impair double femme', () => {
    const regs = [makeRegistration({ id: 'r1', playerId: 'p1', gameType: 'double-femme' })];
    mockRegistrationService.getRegistrations.mockImplementation((_tournamentId: string, gameType?: string) => {
      if (gameType === 'double-femme') return of(regs);
      return of([]);
    });

    const fixture = createComponent();
    fixture.componentInstance.activeTab.set('double-femme');
    fixture.detectChanges();

    expect(fixture.componentInstance.showParityAlert()).toBe(true);
  });

  it('should not show alert for simple-femme with odd count — AC: alerte uniquement pour double/mixte', () => {
    const regs = [makeRegistration({ id: 'r1', playerId: 'p1', gameType: 'simple-femme' })];
    mockRegistrationService.getRegistrations.mockImplementation((_tournamentId: string, gameType?: string) => {
      if (gameType === 'simple-femme') return of(regs);
      return of([]);
    });

    const fixture = createComponent();
    fixture.componentInstance.activeTab.set('simple-femme');
    fixture.detectChanges();

    expect(fixture.componentInstance.showParityAlert()).toBe(false);
  });

  // --- playerName() helper ---

  it('playerName() should return formatted player name — AC: affichage nom joueur', () => {
    const fixture = createComponent();
    expect(fixture.componentInstance.playerName('p1')).toBe('Dupont Alice');
  });

  it('playerName() should return playerId if player not found', () => {
    const fixture = createComponent();
    expect(fixture.componentInstance.playerName('unknown-id')).toBe('unknown-id');
  });

  // --- already registered players should be excluded from dropdown ---

  it('availablePlayers should exclude already registered players — AC: pas de doublon', () => {
    const regs = [makeRegistration({ id: 'r1', playerId: 'p1', gameType: 'simple-homme' })];
    mockRegistrationService.getRegistrations.mockImplementation((_tournamentId: string, gameType?: string) => {
      if (gameType === 'simple-homme') return of(regs);
      return of([]);
    });

    const fixture = createComponent();
    fixture.detectChanges();

    // p1 is registered in simple-homme, default tab — should not appear in available players
    const available = fixture.componentInstance.availablePlayers();
    expect(available.find((p) => p.id === 'p1')).toBeUndefined();
    expect(available.find((p) => p.id === 'p2')).toBeDefined();
  });
});
