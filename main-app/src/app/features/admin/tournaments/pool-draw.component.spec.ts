import { TestBed, ComponentFixture } from '@angular/core/testing';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { of } from 'rxjs';
import { PoolDrawComponent } from './pool-draw.component';
import { TournamentService } from '../../../core/services/tournament.service';
import { RegistrationService } from '../../../core/services/registration.service';
import { PoolService } from '../../../core/services/pool.service';
import { PlayerService } from '../../../core/services/player.service';
import { provideRouter, ActivatedRoute } from '@angular/router';
import { Pool } from '../../../core/models/pool.model';

// ---- Mock services ----

const mockTournament = {
  id: 't1',
  name: 'Tournoi Printemps',
  date: '2026-06-01',
  status: 'Inscriptions clôturées',
  gameTypes: ['simple-homme', 'simple-femme'],
  poolConfig: [
    { gameType: 'simple-homme', poolCount: 2, qualifiersPerPool: 1 },
    { gameType: 'simple-femme', poolCount: 2, qualifiersPerPool: 1 },
  ],
  participationToken: null,
  createdAt: '2026-05-01T00:00:00Z',
};

const mockPools: Pool[] = [
  { id: 'pool-1', tournamentId: 't1', gameType: 'simple-homme', poolNumber: 1, memberIds: ['p1', 'p2', 'p3'], locked: false },
  { id: 'pool-2', tournamentId: 't1', gameType: 'simple-homme', poolNumber: 2, memberIds: ['p4', 'p5'], locked: false },
];

const mockLockedPools: Pool[] = [
  { id: 'pool-1', tournamentId: 't1', gameType: 'simple-homme', poolNumber: 1, memberIds: ['p1', 'p2', 'p3'], locked: true },
  { id: 'pool-2', tournamentId: 't1', gameType: 'simple-homme', poolNumber: 2, memberIds: ['p4', 'p5'], locked: true },
];

const mockTournamentService = {
  getTournament: vi.fn().mockResolvedValue(mockTournament),
};

const mockRegistrationService = {
  getRegistrations: vi.fn().mockReturnValue(of([])),
};

const mockPoolService = {
  generatePools: vi.fn().mockReturnValue(mockPools),
  savePools: vi.fn().mockResolvedValue(mockPools),
  lockPools: vi.fn().mockResolvedValue(undefined),
  getPools: vi.fn().mockReturnValue(of([])),
  getPoolsForPlayer: vi.fn().mockReturnValue(of([])),
};

const mockPlayerService = {
  getPlayers: vi.fn().mockReturnValue(of([
    { id: 'p1', firstName: 'Alice', lastName: 'Martin', gender: 'femme', createdAt: '2026-01-01', active: true },
    { id: 'p2', firstName: 'Bob', lastName: 'Dupont', gender: 'homme', createdAt: '2026-01-01', active: true },
    { id: 'p3', firstName: 'Carol', lastName: 'Durand', gender: 'femme', createdAt: '2026-01-01', active: true },
    { id: 'p4', firstName: 'David', lastName: 'Moreau', gender: 'homme', createdAt: '2026-01-01', active: true },
    { id: 'p5', firstName: 'Eva', lastName: 'Petit', gender: 'femme', createdAt: '2026-01-01', active: true },
  ])),
};


describe('PoolDrawComponent', () => {
  let fixture: ComponentFixture<PoolDrawComponent>;
  let component: PoolDrawComponent;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockTournamentService.getTournament.mockResolvedValue(mockTournament);
    mockPoolService.generatePools.mockReturnValue(mockPools);
    mockPoolService.savePools.mockResolvedValue(mockPools);
    mockPoolService.lockPools.mockResolvedValue(undefined);
    mockPoolService.getPools.mockReturnValue(of([]));
    mockRegistrationService.getRegistrations.mockReturnValue(of([]));

    await TestBed.configureTestingModule({
      imports: [PoolDrawComponent],
      providers: [
        provideRouter([]),
        { provide: TournamentService, useValue: mockTournamentService },
        { provide: RegistrationService, useValue: mockRegistrationService },
        { provide: PoolService, useValue: mockPoolService },
        { provide: PlayerService, useValue: mockPlayerService },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: { get: () => 't1' } } },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PoolDrawComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('should be created', () => {
    expect(component).toBeTruthy();
  });

  // --- canDraw computed ---

  it('canDraw should be true when tournament status is "Inscriptions clôturées"', () => {
    component.tournament.set({ ...mockTournament, status: 'Inscriptions clôturées' } as any);
    expect(component.canDraw()).toBe(true);
  });

  it('canDraw should be true when tournament status is "En cours"', () => {
    component.tournament.set({ ...mockTournament, status: 'En cours' } as any);
    expect(component.canDraw()).toBe(true);
  });

  it('canDraw should be false when tournament status is "Inscriptions ouvertes"', () => {
    component.tournament.set({ ...mockTournament, status: 'Inscriptions ouvertes' } as any);
    expect(component.canDraw()).toBe(false);
  });

  it('canDraw should be false when tournament status is "Brouillon"', () => {
    component.tournament.set({ ...mockTournament, status: 'Brouillon' } as any);
    expect(component.canDraw()).toBe(false);
  });

  // --- configuredGameTypes computed ---

  it('configuredGameTypes should return game types from poolConfig', () => {
    component.tournament.set(mockTournament as any);
    const types = component.configuredGameTypes();
    expect(types).toContain('simple-homme');
    expect(types).toContain('simple-femme');
  });

  it('configuredGameTypes should return empty array when no poolConfig', () => {
    component.tournament.set({ ...mockTournament, poolConfig: undefined } as any);
    expect(component.configuredGameTypes()).toEqual([]);
  });

  // --- selectTab ---

  it('selectTab should change activeTab — AC: visualisation par type de jeu', () => {
    component.selectTab('simple-femme');
    expect(component.activeTab()).toBe('simple-femme');
  });

  it('selectTab should clear drawError', () => {
    component.drawError.set('some error');
    component.selectTab('simple-femme');
    expect(component.drawError()).toBeNull();
  });

  it('selectTab should clear currentPools', () => {
    component.currentPools.set(mockPools);
    component.selectTab('simple-femme');
    expect(component.currentPools()).toEqual([]);
  });

  // --- isTabLocked ---

  it('isTabLocked should return false for unlocked tab', () => {
    expect(component.isTabLocked('simple-homme')).toBe(false);
  });

  it('isTabLocked should return true for locked tab', () => {
    component.lockedGameTypes.set(new Set(['simple-homme']));
    expect(component.isTabLocked('simple-homme')).toBe(true);
  });

  // --- drawPools() — AC: répartition aléatoire, admin peut relancer ---

  it('drawPools() should call generatePools with correct args — AC: répartition selon config poules', async () => {
    component.activeTab.set('simple-homme');
    component.tournament.set(mockTournament as any);

    await component.drawPools();

    expect(mockPoolService.generatePools).toHaveBeenCalledWith(
      't1',
      'simple-homme',
      2,
      expect.any(Array)
    );
  });

  it('drawPools() should call savePools to persist — AC: écriture dans pools', async () => {
    component.activeTab.set('simple-homme');
    component.tournament.set(mockTournament as any);

    await component.drawPools();

    expect(mockPoolService.savePools).toHaveBeenCalled();
  });

  it('drawPools() should update currentPools with saved pools', async () => {
    component.activeTab.set('simple-homme');
    component.tournament.set(mockTournament as any);

    await component.drawPools();

    expect(component.currentPools()).toEqual(mockPools);
  });

  it('drawPools() should set drawError on failure', async () => {
    mockPoolService.generatePools.mockImplementationOnce(() => {
      throw new Error('Capacity exceeded');
    });

    component.activeTab.set('simple-homme');
    component.tournament.set(mockTournament as any);

    await component.drawPools();

    expect(component.drawError()).not.toBeNull();
  });

  it('drawPools() should reset drawing state after success', async () => {
    component.activeTab.set('simple-homme');
    component.tournament.set(mockTournament as any);

    await component.drawPools();

    expect(component.drawing()).toBe(false);
  });

  it('drawPools() should reset drawing state after failure', async () => {
    mockPoolService.savePools.mockRejectedValueOnce(new Error('Firestore error'));
    component.activeTab.set('simple-homme');
    component.tournament.set(mockTournament as any);

    await component.drawPools();

    expect(component.drawing()).toBe(false);
  });

  it('drawPools() should set error when poolCount is 0', async () => {
    component.activeTab.set('simple-homme');
    component.tournament.set({ ...mockTournament, poolConfig: [] } as any);

    await component.drawPools();

    expect(component.drawError()).not.toBeNull();
    expect(mockPoolService.generatePools).not.toHaveBeenCalled();
  });

  // --- validatePools() — AC: validation → poules figées + statut En cours ---

  it('validatePools() should call lockPools — AC: validation → poules figées', async () => {
    component.activeTab.set('simple-homme');
    component.currentPools.set(mockPools);

    await component.validatePools();

    expect(mockPoolService.lockPools).toHaveBeenCalledWith('t1', 'simple-homme');
  });

  it('validatePools() should add gameType to lockedGameTypes — AC: poules figées', async () => {
    component.activeTab.set('simple-homme');
    component.currentPools.set(mockPools);

    await component.validatePools();

    expect(component.isTabLocked('simple-homme')).toBe(true);
  });

  it('validatePools() should reload tournament after locking — AC: statut En cours', async () => {
    const updatedTournament = { ...mockTournament, status: 'En cours' };
    mockTournamentService.getTournament.mockResolvedValueOnce(mockTournament).mockResolvedValueOnce(updatedTournament);

    component.activeTab.set('simple-homme');
    component.currentPools.set(mockPools);

    await component.validatePools();

    expect(mockTournamentService.getTournament).toHaveBeenCalledTimes(2);
  });

  it('validatePools() should set drawError on failure', async () => {
    mockPoolService.lockPools.mockRejectedValueOnce(new Error('Lock failed'));
    component.activeTab.set('simple-homme');

    await component.validatePools();

    expect(component.drawError()).not.toBeNull();
  });

  it('validatePools() should reset locking state after success', async () => {
    component.activeTab.set('simple-homme');

    await component.validatePools();

    expect(component.locking()).toBe(false);
  });

  it('validatePools() should reset locking state after failure', async () => {
    mockPoolService.lockPools.mockRejectedValueOnce(new Error('Failed'));
    component.activeTab.set('simple-homme');

    await component.validatePools();

    expect(component.locking()).toBe(false);
  });

  // --- playerName ---

  it('playerName should return player full name', () => {
    const name = component.playerName('p1');
    expect(name).toBe('Martin Alice');
  });

  it('playerName should return playerId when player not found', () => {
    const name = component.playerName('unknown-id');
    expect(name).toBe('unknown-id');
  });

  // --- poolCountForTab computed ---

  it('poolCountForTab should return configured pool count for active tab', () => {
    component.activeTab.set('simple-homme');
    component.tournament.set(mockTournament as any);
    expect(component.poolCountForTab()).toBe(2);
  });

  it('poolCountForTab should return 0 when no config for active tab', () => {
    component.activeTab.set('double-homme' as any);
    component.tournament.set(mockTournament as any);
    expect(component.poolCountForTab()).toBe(0);
  });
});
