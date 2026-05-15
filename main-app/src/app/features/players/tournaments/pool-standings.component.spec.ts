import { TestBed, ComponentFixture } from '@angular/core/testing';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { of } from 'rxjs';
import { ComponentRef } from '@angular/core';
import { PoolStandingsComponent } from './pool-standings.component';
import { StandingsService } from '../../../core/services/standings.service';
import { MatchService } from '../../../core/services/match.service';
import { TournamentService } from '../../../core/services/tournament.service';
import { PoolService } from '../../../core/services/pool.service';
import { PoolStanding } from '../../../core/models/standings.model';
import { Match } from '../../../core/models/match.model';
import { Tournament } from '../../../core/models/tournament.model';
import { Pool } from '../../../core/models/pool.model';

// ──────────────────────────────────── Mock data ────────────────────────────────────

const mockTournament: Tournament = {
  id: 't1',
  name: 'Tournoi Printemps',
  date: '2026-06-01',
  status: 'En cours',
  participationToken: 'token-123',
  createdBy: 'admin-uid',
  createdAt: '2026-05-01T00:00:00Z',
  poolConfig: [
    { gameType: 'simple-homme', poolCount: 1, qualifiersPerPool: 2 },
  ],
};

const mockPool: Pool = {
  id: 'pool1',
  tournamentId: 't1',
  gameType: 'simple-homme',
  poolNumber: 1,
  memberIds: ['p1', 'p2', 'p3'],
  locked: true,
};

const mockStandings: PoolStanding[] = [
  {
    participantId: 'p1',
    name: 'Dupont Alice',
    rank: 1,
    matchesPlayed: 2,
    victories: 2,
    defeats: 0,
    setsWon: 4,
    setsLost: 1,
    pointsScored: 84,
    pointsConceded: 42,
    totalPoints: 4,
    qualified: false,
  },
  {
    participantId: 'p2',
    name: 'Martin Bob',
    rank: 2,
    matchesPlayed: 2,
    victories: 1,
    defeats: 1,
    setsWon: 2,
    setsLost: 2,
    pointsScored: 63,
    pointsConceded: 63,
    totalPoints: 3,
    qualified: false,
  },
  {
    participantId: 'p3',
    name: 'Durand Carol',
    rank: 3,
    matchesPlayed: 2,
    victories: 0,
    defeats: 2,
    setsWon: 1,
    setsLost: 4,
    pointsScored: 42,
    pointsConceded: 84,
    totalPoints: 2,
    qualified: false,
  },
];

const mockMatches: Match[] = [
  {
    id: 'm1',
    tournamentId: 't1',
    poolId: 'pool1',
    gameType: 'simple-homme',
    participantA: { id: 'p1', name: 'Dupont Alice' },
    participantB: { id: 'p2', name: 'Martin Bob' },
    status: 'played',
    winnerId: 'p1',
    sets: [{ a: 21, b: 10 }, { a: 21, b: 15 }],
  },
  {
    id: 'm2',
    tournamentId: 't1',
    poolId: 'pool1',
    gameType: 'simple-homme',
    participantA: { id: 'p1', name: 'Dupont Alice' },
    participantB: { id: 'p3', name: 'Durand Carol' },
    status: 'played',
    winnerId: 'p1',
    sets: [{ a: 21, b: 8 }, { a: 21, b: 12 }],
  },
  {
    id: 'm3',
    tournamentId: 't1',
    poolId: 'pool1',
    gameType: 'simple-homme',
    participantA: { id: 'p2', name: 'Martin Bob' },
    participantB: { id: 'p3', name: 'Durand Carol' },
    status: 'pending',
  },
];

// ──────────────────────────────────── Mock services ────────────────────────────────

function createMockStandingsService(standings: PoolStanding[] = mockStandings) {
  return {
    getPoolStandings: vi.fn().mockReturnValue(of(standings)),
  };
}

function createMockMatchService(matches: Match[] = mockMatches) {
  return {
    getMatchesForPool: vi.fn().mockReturnValue(of(matches)),
  };
}

function createMockTournamentService(tournament: Tournament | null = mockTournament) {
  return {
    getTournament: vi.fn().mockResolvedValue(tournament),
  };
}

function createMockPoolService(pool: Pool | null = mockPool) {
  return {
    getPools: vi.fn().mockReturnValue(of(pool ? [pool] : [])),
  };
}

// ──────────────────────────────────── Setup helper ────────────────────────────────

async function createComponent(opts?: {
  standings?: PoolStanding[];
  matches?: Match[];
  tournament?: Tournament | null;
  pool?: Pool | null;
}) {
  const standingsSvc = createMockStandingsService(opts?.standings);
  const matchSvc = createMockMatchService(opts?.matches);
  const tournamentSvc = createMockTournamentService(opts?.tournament);
  const poolSvc = createMockPoolService(opts?.pool);

  await TestBed.configureTestingModule({
    imports: [PoolStandingsComponent],
    providers: [
      { provide: StandingsService, useValue: standingsSvc },
      { provide: MatchService, useValue: matchSvc },
      { provide: TournamentService, useValue: tournamentSvc },
      { provide: PoolService, useValue: poolSvc },
    ],
  }).compileComponents();

  const fixture: ComponentFixture<PoolStandingsComponent> = TestBed.createComponent(PoolStandingsComponent);
  const component = fixture.componentInstance;
  const componentRef: ComponentRef<PoolStandingsComponent> = fixture.componentRef;

  componentRef.setInput('tournamentId', 't1');
  componentRef.setInput('poolId', 'pool1');

  // Trigger ngOnInit (async), then wait for all microtasks to settle
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();

  return { fixture, component, standingsSvc, matchSvc, tournamentSvc, poolSvc };
}

// ──────────────────────────────────── Tests ────────────────────────────────────────

describe('PoolStandingsComponent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.resetTestingModule();
  });

  // --- Creation ---

  it('should be created', async () => {
    const { component } = await createComponent();
    expect(component).toBeTruthy();
  });

  // --- Loading state ---

  it('should start with loading = true before init resolves', () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [PoolStandingsComponent],
      providers: [
        { provide: StandingsService, useValue: createMockStandingsService() },
        { provide: MatchService, useValue: createMockMatchService() },
        { provide: TournamentService, useValue: createMockTournamentService() },
        { provide: PoolService, useValue: createMockPoolService() },
      ],
    });
    const fixture = TestBed.createComponent(PoolStandingsComponent);
    const component = fixture.componentInstance;
    expect(component.loading()).toBe(true);
  });

  it('should set loading to false after data loads', async () => {
    const { component } = await createComponent();
    expect(component.loading()).toBe(false);
  });

  // --- Data loading ---

  it('should call getPoolStandings with correct params — AC: classement temps réel', async () => {
    const { standingsSvc } = await createComponent();
    expect(standingsSvc.getPoolStandings).toHaveBeenCalledWith('t1', 'pool1');
  });

  it('should call getMatchesForPool with correct params — AC: matchs affichés', async () => {
    const { matchSvc } = await createComponent();
    expect(matchSvc.getMatchesForPool).toHaveBeenCalledWith('t1', 'pool1');
  });

  it('should load standings into signal', async () => {
    const { component } = await createComponent();
    expect(component.standings()).toHaveLength(3);
  });

  it('should load matches into signal', async () => {
    const { component } = await createComponent();
    expect(component.matches()).toHaveLength(3);
  });

  // --- Computed: qualifiersPerPool ---

  it('should compute qualifiersPerPool from tournament poolConfig', async () => {
    const { component } = await createComponent();
    expect(component.qualifiersPerPool()).toBe(2);
  });

  it('should return 0 qualifiersPerPool when tournament has no poolConfig', async () => {
    const tournamentNoConfig: Tournament = { ...mockTournament, poolConfig: undefined };
    const { component } = await createComponent({ tournament: tournamentNoConfig });
    expect(component.qualifiersPerPool()).toBe(0);
  });

  // --- Computed: rankedStandings with qualified flag ---

  it('should mark top-2 as qualified when qualifiersPerPool is 2 — AC: places qualificatives', async () => {
    const { component } = await createComponent();
    const ranked = component.rankedStandings();
    expect(ranked.find((s) => s.rank === 1)?.qualified).toBe(true);
    expect(ranked.find((s) => s.rank === 2)?.qualified).toBe(true);
    expect(ranked.find((s) => s.rank === 3)?.qualified).toBe(false);
  });

  it('should mark no one as qualified when qualifiersPerPool is 0', async () => {
    const tournamentNoQualif: Tournament = {
      ...mockTournament,
      poolConfig: [{ gameType: 'simple-homme', poolCount: 1, qualifiersPerPool: 0 }],
    };
    const { component } = await createComponent({ tournament: tournamentNoQualif });
    const ranked = component.rankedStandings();
    expect(ranked.every((s) => !s.qualified)).toBe(true);
  });

  it('should sort rankedStandings by rank ascending', async () => {
    // Provide standings in reverse order to verify sorting
    const reversed = [...mockStandings].reverse();
    const { component } = await createComponent({ standings: reversed });
    const ranked = component.rankedStandings();
    expect(ranked[0].rank).toBe(1);
    expect(ranked[1].rank).toBe(2);
    expect(ranked[2].rank).toBe(3);
  });

  // --- Computed: playedMatches / pendingMatches ---

  it('should filter playedMatches correctly — AC: scores des matchs joués', async () => {
    const { component } = await createComponent();
    expect(component.playedMatches()).toHaveLength(2);
    expect(component.playedMatches().every((m) => m.status === 'played')).toBe(true);
  });

  it('should filter pendingMatches correctly — AC: matchs restants identifiés', async () => {
    const { component } = await createComponent();
    expect(component.pendingMatches()).toHaveLength(1);
    expect(component.pendingMatches()[0].status).toBe('pending');
  });

  // --- Error state ---

  it('should set error when TournamentService throws', async () => {
    TestBed.resetTestingModule();
    const tournamentSvc = createMockTournamentService();
    tournamentSvc.getTournament.mockRejectedValueOnce(new Error('Network error'));

    await TestBed.configureTestingModule({
      imports: [PoolStandingsComponent],
      providers: [
        { provide: StandingsService, useValue: createMockStandingsService() },
        { provide: MatchService, useValue: createMockMatchService() },
        { provide: TournamentService, useValue: tournamentSvc },
        { provide: PoolService, useValue: createMockPoolService() },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(PoolStandingsComponent);
    const component = fixture.componentInstance;
    fixture.componentRef.setInput('tournamentId', 't1');
    fixture.componentRef.setInput('poolId', 'pool1');

    // Call ngOnInit directly and await it so the rejected promise is fully settled
    await component.ngOnInit();
    fixture.detectChanges();

    expect(component.error()).toBeTruthy();
    expect(component.loading()).toBe(false);
  });

  // --- Template rendering ---

  it('should render standings table in template — AC: tableau classement affiché', async () => {
    const { fixture } = await createComponent();
    fixture.detectChanges();
    const html = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(html).toContain('Dupont Alice');
    expect(html).toContain('Martin Bob');
    expect(html).toContain('Durand Carol');
  });

  it('should render Qualifié badge for top-2 players — AC: indicateur visuel places qualificatives', async () => {
    const { fixture } = await createComponent();
    fixture.detectChanges();
    const html = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(html).toContain('Qualifié');
  });

  it('should render played matches section — AC: scores matchs joués visibles', async () => {
    const { fixture } = await createComponent();
    fixture.detectChanges();
    const html = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(html).toContain('Matchs joués');
    expect(html).toContain('21-10');
  });

  it('should render pending matches section — AC: matchs restants identifiés', async () => {
    const { fixture } = await createComponent();
    fixture.detectChanges();
    const html = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(html).toContain('Matchs à venir');
    expect(html).toContain('À jouer');
  });

  it('should show qualifiersPerPool info when > 0 — AC: indicateur visuel qualificatifs', async () => {
    const { fixture } = await createComponent();
    fixture.detectChanges();
    const html = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(html).toContain('se qualifient pour la phase finale');
  });

  it('should not show qualify info when qualifiersPerPool is 0', async () => {
    const tournamentNoQualif: Tournament = {
      ...mockTournament,
      poolConfig: [{ gameType: 'simple-homme', poolCount: 1, qualifiersPerPool: 0 }],
    };
    const { fixture } = await createComponent({ tournament: tournamentNoQualif });
    fixture.detectChanges();
    const html = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(html).not.toContain('se qualifient pour la phase finale');
  });

  it('should show empty standings message when no standings', async () => {
    const { fixture } = await createComponent({ standings: [] });
    fixture.detectChanges();
    const html = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(html).toContain('Aucun classement disponible');
  });

  // --- ngOnDestroy ---

  it('should unsubscribe on destroy', async () => {
    const { component } = await createComponent();
    const unsubSpy = vi.spyOn(component['subscription']!, 'unsubscribe');
    component.ngOnDestroy();
    expect(unsubSpy).toHaveBeenCalled();
  });
});
