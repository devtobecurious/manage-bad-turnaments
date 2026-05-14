import { TestBed } from '@angular/core/testing';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Component } from '@angular/core';
import { PoolConfigComponent } from './pool-config.component';
import { TournamentService } from '../../../core/services/tournament.service';
import { PoolConfig, GameType } from '../../../core/models/tournament.model';

// Mock Firestore so TournamentService can be injected
vi.mock('@angular/fire/firestore', () => ({
  Firestore: class MockFirestore {},
  collection: vi.fn().mockReturnValue({ path: 'tournaments' }),
  collectionData: vi.fn(),
  addDoc: vi.fn().mockResolvedValue({ id: 'new-id' }),
  doc: vi.fn().mockReturnValue({ path: 'tournaments/t1' }),
  getDoc: vi.fn().mockResolvedValue({ exists: () => false }),
  updateDoc: vi.fn().mockResolvedValue(undefined),
  query: vi.fn().mockImplementation((ref) => ref),
  orderBy: vi.fn().mockReturnValue({}),
}));

const mockUpdatePoolConfig = vi.fn().mockResolvedValue(undefined);

describe('PoolConfigComponent', () => {
  let mockTournamentService: Partial<TournamentService>;

  beforeEach(async () => {
    vi.clearAllMocks();

    mockTournamentService = {
      updatePoolConfig: mockUpdatePoolConfig,
    };

    const { Firestore } = await import('@angular/fire/firestore');

    TestBed.configureTestingModule({
      imports: [PoolConfigComponent],
      providers: [
        { provide: TournamentService, useValue: mockTournamentService },
        { provide: Firestore, useValue: {} },
      ],
    });
  });

  function createComponent(
    tournamentId: string,
    gameTypes: GameType[],
    initialConfigs: PoolConfig[] = []
  ) {
    const fixture = TestBed.createComponent(PoolConfigComponent);
    fixture.componentRef.setInput('tournamentId', tournamentId);
    fixture.componentRef.setInput('gameTypes', gameTypes);
    fixture.componentRef.setInput('initialConfigs', initialConfigs);
    fixture.detectChanges();
    return fixture;
  }

  it('should be created', () => {
    const fixture = createComponent('t1', []);
    expect(fixture.componentInstance).toBeTruthy();
  });

  // --- AC: Choix du nombre de poules par type de jeu ---

  it('should initialise one config per game type — AC: config par type de jeu', () => {
    const fixture = createComponent('t1', ['simple-homme', 'simple-femme']);
    const configs = fixture.componentInstance.configs();
    expect(configs).toHaveLength(2);
    expect(configs.map((c) => c.gameType)).toContain('simple-homme');
    expect(configs.map((c) => c.gameType)).toContain('simple-femme');
  });

  it('should use initialConfigs when provided — AC: config indépendante par type de jeu', () => {
    const initial: PoolConfig[] = [
      { gameType: 'simple-homme', poolCount: 4, qualifiersPerPool: 2 },
    ];
    const fixture = createComponent('t1', ['simple-homme'], initial);
    const configs = fixture.componentInstance.configs();
    expect(configs[0].poolCount).toBe(4);
    expect(configs[0].qualifiersPerPool).toBe(2);
  });

  it('should default to poolCount=1 and qualifiersPerPool=1 for new game types', () => {
    const fixture = createComponent('t1', ['double-mixte']);
    const configs = fixture.componentInstance.configs();
    expect(configs[0].poolCount).toBe(1);
    expect(configs[0].qualifiersPerPool).toBe(1);
  });

  // --- AC: Choix du nombre de qualifiés par poule : 1 ou 2 ---

  it('onQualifiersChange() should update qualifiersPerPool for given gameType — AC: qualifiés 1 ou 2', () => {
    const fixture = createComponent('t1', ['simple-homme']);
    const component = fixture.componentInstance;

    const fakeEvent = { target: { value: '2' } } as unknown as Event;
    component.onQualifiersChange('simple-homme', fakeEvent);

    const configs = component.configs();
    expect(configs[0].qualifiersPerPool).toBe(2);
  });

  it('onQualifiersChange() should allow qualifiersPerPool = 1 — AC: qualifiés 1 ou 2', () => {
    const fixture = createComponent('t1', ['simple-femme']);
    const component = fixture.componentInstance;

    const fakeEvent = { target: { value: '1' } } as unknown as Event;
    component.onQualifiersChange('simple-femme', fakeEvent);

    const configs = component.configs();
    expect(configs[0].qualifiersPerPool).toBe(1);
  });

  // --- AC: Si 1 seule poule et 0 qualifié → pas de phase finale ---

  it('should accept poolCount=1 and qualifiersPerPool=0 combination — AC: pas de finale', () => {
    const initial: PoolConfig[] = [
      { gameType: 'double-mixte', poolCount: 1, qualifiersPerPool: 0 },
    ];
    const fixture = createComponent('t1', ['double-mixte'], initial);
    const configs = fixture.componentInstance.configs();
    expect(configs[0].poolCount).toBe(1);
    expect(configs[0].qualifiersPerPool).toBe(0);
  });

  it('onQualifiersChange() should allow qualifiersPerPool = 0 — AC: pas de finale si 0 qualifié', () => {
    const fixture = createComponent('t1', ['simple-homme']);
    const component = fixture.componentInstance;

    const fakeEvent = { target: { value: '0' } } as unknown as Event;
    component.onQualifiersChange('simple-homme', fakeEvent);

    const configs = component.configs();
    expect(configs[0].qualifiersPerPool).toBe(0);
  });

  it('onPoolCountChange() should update poolCount — AC: nombre de poules', () => {
    const fixture = createComponent('t1', ['simple-homme']);
    const component = fixture.componentInstance;

    const fakeEvent = { target: { value: '4' } } as unknown as Event;
    component.onPoolCountChange('simple-homme', fakeEvent);

    const configs = component.configs();
    expect(configs[0].poolCount).toBe(4);
  });

  it('onPoolCountChange() should enforce minimum of 1', () => {
    const fixture = createComponent('t1', ['simple-homme']);
    const component = fixture.componentInstance;

    const fakeEvent = { target: { value: '0' } } as unknown as Event;
    component.onPoolCountChange('simple-homme', fakeEvent);

    const configs = component.configs();
    expect(configs[0].poolCount).toBeGreaterThanOrEqual(1);
  });

  // --- AC: Config indépendante par type de jeu ---

  it('updating one game type should not affect another — AC: indépendant par type', () => {
    const initial: PoolConfig[] = [
      { gameType: 'simple-homme', poolCount: 2, qualifiersPerPool: 1 },
      { gameType: 'simple-femme', poolCount: 3, qualifiersPerPool: 2 },
    ];
    const fixture = createComponent('t1', ['simple-homme', 'simple-femme'], initial);
    const component = fixture.componentInstance;

    const fakeEvent = { target: { value: '5' } } as unknown as Event;
    component.onPoolCountChange('simple-homme', fakeEvent);

    const configs = component.configs();
    const homme = configs.find((c) => c.gameType === 'simple-homme')!;
    const femme = configs.find((c) => c.gameType === 'simple-femme')!;

    expect(homme.poolCount).toBe(5);
    expect(femme.poolCount).toBe(3); // unchanged
  });

  // --- save() ---

  it('save() should call TournamentService.updatePoolConfig with current configs', async () => {
    const initial: PoolConfig[] = [
      { gameType: 'simple-homme', poolCount: 2, qualifiersPerPool: 1 },
    ];
    const fixture = createComponent('t1', ['simple-homme'], initial);
    const component = fixture.componentInstance;

    await component.save();

    expect(mockUpdatePoolConfig).toHaveBeenCalledWith(
      't1',
      [{ gameType: 'simple-homme', poolCount: 2, qualifiersPerPool: 1 }]
    );
  });

  it('save() should set saveSuccess signal after successful save', async () => {
    const fixture = createComponent('t1', ['simple-homme']);
    const component = fixture.componentInstance;

    await component.save();

    expect(component.saveSuccess()).toBe(true);
    expect(component.saveError()).toBeNull();
  });

  it('save() should set saveError signal on failure', async () => {
    mockUpdatePoolConfig.mockRejectedValueOnce(new Error('Firestore error'));

    const fixture = createComponent('t1', ['simple-homme']);
    const component = fixture.componentInstance;

    await component.save();

    expect(component.saveError()).toBeTruthy();
    expect(component.saveSuccess()).toBe(false);
  });

  it('save() should emit saved output with configs after success', async () => {
    const initial: PoolConfig[] = [
      { gameType: 'double-homme', poolCount: 2, qualifiersPerPool: 2 },
    ];
    const fixture = createComponent('t1', ['double-homme'], initial);
    const component = fixture.componentInstance;

    const emitted: PoolConfig[][] = [];
    component.saved.subscribe((configs) => emitted.push(configs));

    await component.save();

    expect(emitted).toHaveLength(1);
    expect(emitted[0]).toEqual(initial);
  });

  // --- gameTypeLabel() ---

  it('gameTypeLabel() should return a human-readable label for each game type', () => {
    const fixture = createComponent('t1', []);
    const component = fixture.componentInstance;

    expect(component.gameTypeLabel('simple-homme')).toBe('Simple Homme');
    expect(component.gameTypeLabel('simple-femme')).toBe('Simple Femme');
    expect(component.gameTypeLabel('double-homme')).toBe('Double Homme');
    expect(component.gameTypeLabel('double-femme')).toBe('Double Femme');
    expect(component.gameTypeLabel('double-mixte')).toBe('Double Mixte');
  });
});
