import { TestBed } from '@angular/core/testing';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ActivatedRoute } from '@angular/router';
import { PoolConfigComponent } from './pool-config.component';
import { TournamentService } from '../../../core/services/tournament.service';
import { PoolConfig, GameType, Tournament } from '../../../core/models/tournament.model';

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
const mockGetTournament = vi.fn();

function makeTournament(gameTypes: GameType[], poolConfig: PoolConfig[] = []): Tournament {
  return {
    id: 't1',
    name: 'Test',
    date: '2026-06-01',
    status: 'Brouillon',
    gameTypes,
    poolConfig,
    createdAt: '',
    createdBy: '',
    participationToken: null,
  };
}

describe('PoolConfigComponent', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    TestBed.configureTestingModule({
      imports: [PoolConfigComponent],
      providers: [
        {
          provide: TournamentService,
          useValue: { updatePoolConfig: mockUpdatePoolConfig, getTournament: mockGetTournament },
        },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: { get: () => 't1' } } },
        },
      ],
    });
  });

  async function createComponent(gameTypes: GameType[], poolConfig: PoolConfig[] = []) {
    mockGetTournament.mockResolvedValue(makeTournament(gameTypes, poolConfig));
    const fixture = TestBed.createComponent(PoolConfigComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    return fixture;
  }

  it('should be created', async () => {
    const fixture = await createComponent([]);
    expect(fixture.componentInstance).toBeTruthy();
  });

  // --- AC: Choix du nombre de poules par type de jeu ---

  it('should initialise one config per game type — AC: config par type de jeu', async () => {
    const fixture = await createComponent(['simple-homme', 'simple-femme']);
    const configs = fixture.componentInstance.configs();
    expect(configs).toHaveLength(2);
    expect(configs.map((c) => c.gameType)).toContain('simple-homme');
    expect(configs.map((c) => c.gameType)).toContain('simple-femme');
  });

  it('should use poolConfig from tournament when provided — AC: config indépendante par type de jeu', async () => {
    const initial: PoolConfig[] = [
      { gameType: 'simple-homme', poolCount: 4, qualifiersPerPool: 2 },
    ];
    const fixture = await createComponent(['simple-homme'], initial);
    const configs = fixture.componentInstance.configs();
    expect(configs[0].poolCount).toBe(4);
    expect(configs[0].qualifiersPerPool).toBe(2);
  });

  it('should default to poolCount=1 and qualifiersPerPool=1 for new game types', async () => {
    const fixture = await createComponent(['mixte']);
    const configs = fixture.componentInstance.configs();
    expect(configs[0].poolCount).toBe(1);
    expect(configs[0].qualifiersPerPool).toBe(1);
  });

  // --- AC: Choix du nombre de qualifiés par poule : 1 ou 2 ---

  it('onQualifiersChange() should update qualifiersPerPool — AC: qualifiés 1 ou 2', async () => {
    const fixture = await createComponent(['simple-homme']);
    const component = fixture.componentInstance;

    const fakeEvent = { target: { value: '2' } } as unknown as Event;
    component.onQualifiersChange('simple-homme', fakeEvent);

    expect(component.configs()[0].qualifiersPerPool).toBe(2);
  });

  it('onQualifiersChange() should allow qualifiersPerPool = 1', async () => {
    const fixture = await createComponent(['simple-femme']);
    const component = fixture.componentInstance;

    const fakeEvent = { target: { value: '1' } } as unknown as Event;
    component.onQualifiersChange('simple-femme', fakeEvent);

    expect(component.configs()[0].qualifiersPerPool).toBe(1);
  });

  // --- AC: Si 1 seule poule et 0 qualifié → pas de phase finale ---

  it('should accept poolCount=1 and qualifiersPerPool=0 — AC: pas de finale', async () => {
    const initial: PoolConfig[] = [
      { gameType: 'mixte', poolCount: 1, qualifiersPerPool: 0 },
    ];
    const fixture = await createComponent(['mixte'], initial);
    const configs = fixture.componentInstance.configs();
    expect(configs[0].poolCount).toBe(1);
    expect(configs[0].qualifiersPerPool).toBe(0);
  });

  it('onQualifiersChange() should allow qualifiersPerPool = 0', async () => {
    const fixture = await createComponent(['simple-homme']);
    const component = fixture.componentInstance;

    const fakeEvent = { target: { value: '0' } } as unknown as Event;
    component.onQualifiersChange('simple-homme', fakeEvent);

    expect(component.configs()[0].qualifiersPerPool).toBe(0);
  });

  it('onPoolCountChange() should update poolCount', async () => {
    const fixture = await createComponent(['simple-homme']);
    const component = fixture.componentInstance;

    const fakeEvent = { target: { value: '4' } } as unknown as Event;
    component.onPoolCountChange('simple-homme', fakeEvent);

    expect(component.configs()[0].poolCount).toBe(4);
  });

  it('onPoolCountChange() should enforce minimum of 1', async () => {
    const fixture = await createComponent(['simple-homme']);
    const component = fixture.componentInstance;

    const fakeEvent = { target: { value: '0' } } as unknown as Event;
    component.onPoolCountChange('simple-homme', fakeEvent);

    expect(component.configs()[0].poolCount).toBeGreaterThanOrEqual(1);
  });

  // --- AC: Config indépendante par type de jeu ---

  it('updating one game type should not affect another', async () => {
    const initial: PoolConfig[] = [
      { gameType: 'simple-homme', poolCount: 2, qualifiersPerPool: 1 },
      { gameType: 'simple-femme', poolCount: 3, qualifiersPerPool: 2 },
    ];
    const fixture = await createComponent(['simple-homme', 'simple-femme'], initial);
    const component = fixture.componentInstance;

    const fakeEvent = { target: { value: '5' } } as unknown as Event;
    component.onPoolCountChange('simple-homme', fakeEvent);

    const homme = component.configs().find((c) => c.gameType === 'simple-homme')!;
    const femme = component.configs().find((c) => c.gameType === 'simple-femme')!;

    expect(homme.poolCount).toBe(5);
    expect(femme.poolCount).toBe(3);
  });

  // --- save() ---

  it('save() should call TournamentService.updatePoolConfig with current configs', async () => {
    const initial: PoolConfig[] = [
      { gameType: 'simple-homme', poolCount: 2, qualifiersPerPool: 1 },
    ];
    const fixture = await createComponent(['simple-homme'], initial);

    await fixture.componentInstance.save();

    expect(mockUpdatePoolConfig).toHaveBeenCalledWith('t1', [
      { gameType: 'simple-homme', poolCount: 2, qualifiersPerPool: 1 },
    ]);
  });

  it('save() should set saveSuccess signal after successful save', async () => {
    const fixture = await createComponent(['simple-homme']);
    const component = fixture.componentInstance;

    await component.save();

    expect(component.saveSuccess()).toBe(true);
    expect(component.saveError()).toBeNull();
  });

  it('save() should set saveError signal on failure', async () => {
    mockUpdatePoolConfig.mockRejectedValueOnce(new Error('Firestore error'));

    const fixture = await createComponent(['simple-homme']);
    const component = fixture.componentInstance;

    await component.save();

    expect(component.saveError()).toBeTruthy();
    expect(component.saveSuccess()).toBe(false);
  });

  // --- gameTypeLabel() ---

  it('gameTypeLabel() should return human-readable labels', async () => {
    const fixture = await createComponent([]);
    const component = fixture.componentInstance;

    expect(component.gameTypeLabel('simple-homme')).toBe('Simple Homme');
    expect(component.gameTypeLabel('simple-femme')).toBe('Simple Femme');
    expect(component.gameTypeLabel('double-homme')).toBe('Double Homme');
    expect(component.gameTypeLabel('double-femme')).toBe('Double Femme');
    expect(component.gameTypeLabel('mixte')).toBe('Mixte');
  });
});
