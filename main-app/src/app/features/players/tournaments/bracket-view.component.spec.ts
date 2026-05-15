import { TestBed, ComponentFixture } from '@angular/core/testing';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { of, throwError } from 'rxjs';
import { ComponentRef } from '@angular/core';
import { BracketViewComponent } from './bracket-view.component';
import { BracketService } from '../../../core/services/bracket.service';
import { BracketMatch } from '../../../core/models/bracket.model';

// ──────────────────────────────────── Mock data ────────────────────────────────────

const matchR1P1: BracketMatch = {
  id: 'r1-m1',
  round: 1,
  position: 1,
  participantA: { id: 'p1', name: 'Alice Dupont', fromPool: 'pool1' },
  participantB: { id: 'p2', name: 'Bob Martin', fromPool: 'pool2' },
  status: 'played',
  winnerId: 'p1',
  scores: [{ a: 21, b: 15 }, { a: 21, b: 18 }],
};

const matchR1P2: BracketMatch = {
  id: 'r1-m2',
  round: 1,
  position: 2,
  participantA: { id: 'p3', name: 'Carol Durand', fromPool: 'pool1' },
  participantB: { id: 'p4', name: 'David Leroy', fromPool: 'pool2' },
  status: 'played',
  winnerId: 'p3',
  scores: [{ a: 21, b: 10 }, { a: 21, b: 12 }],
};

const matchR2Final: BracketMatch = {
  id: 'r2-m1',
  round: 2,
  position: 1,
  participantA: { id: 'p1', name: 'Alice Dupont', fromPool: 'pool1' },
  participantB: { id: 'p3', name: 'Carol Durand', fromPool: 'pool1' },
  status: 'pending',
};

const matchR2FinalWithWinner: BracketMatch = {
  ...matchR2Final,
  status: 'played',
  winnerId: 'p1',
  scores: [{ a: 21, b: 19 }, { a: 21, b: 17 }],
};

const mockBracketComplete: BracketMatch[] = [matchR1P1, matchR1P2, matchR2FinalWithWinner];
const mockBracketPending: BracketMatch[] = [matchR1P1, matchR1P2, matchR2Final];

const matchWithNullParticipants: BracketMatch = {
  id: 'r2-m1',
  round: 2,
  position: 1,
  participantA: null,
  participantB: null,
  status: 'pending',
};

const matchBye: BracketMatch = {
  id: 'r1-m1-bye',
  round: 1,
  position: 1,
  participantA: { id: 'p1', name: 'Alice Dupont', fromPool: 'pool1' },
  participantB: null,
  status: 'bye',
  winnerId: 'p1',
};

// ──────────────────────────────────── Mock service ────────────────────────────────

function createMockBracketService(matches: BracketMatch[] = mockBracketComplete) {
  return {
    getBracket: vi.fn().mockReturnValue(of(matches)),
  };
}

// ──────────────────────────────────── Setup helper ────────────────────────────────

async function createComponent(opts?: {
  matches?: BracketMatch[];
  playerId?: string;
}) {
  const bracketSvc = createMockBracketService(opts?.matches);

  await TestBed.configureTestingModule({
    imports: [BracketViewComponent],
    providers: [
      { provide: BracketService, useValue: bracketSvc },
    ],
  }).compileComponents();

  const fixture: ComponentFixture<BracketViewComponent> = TestBed.createComponent(BracketViewComponent);
  const component = fixture.componentInstance;
  const componentRef: ComponentRef<BracketViewComponent> = fixture.componentRef;

  componentRef.setInput('tournamentId', 't1');
  if (opts?.playerId !== undefined) {
    componentRef.setInput('playerId', opts.playerId);
  }

  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();

  return { fixture, component, bracketSvc };
}

// ──────────────────────────────────── Tests ────────────────────────────────────────

describe('BracketViewComponent', () => {
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

  it('should start with loading = true before subscription resolves', () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [BracketViewComponent],
      providers: [
        { provide: BracketService, useValue: { getBracket: vi.fn().mockReturnValue(of([])) } },
      ],
    });
    const fixture = TestBed.createComponent(BracketViewComponent);
    const component = fixture.componentInstance;
    // Before detectChanges + ngOnInit: loading should be true
    expect(component.loading()).toBe(true);
  });

  it('should set loading to false after data loads', async () => {
    const { component } = await createComponent();
    expect(component.loading()).toBe(false);
  });

  // --- Service call ---

  it('should call getBracket with correct tournamentId — AC: données temps réel', async () => {
    const { bracketSvc } = await createComponent();
    expect(bracketSvc.getBracket).toHaveBeenCalledWith('t1');
  });

  // --- Data loading ---

  it('should load matches into allMatches signal', async () => {
    const { component } = await createComponent();
    expect(component.allMatches()).toHaveLength(3);
  });

  // --- Computed: rounds grouping ---

  it('should group matches into rounds sorted by round number — AC: tous les rounds affichés', async () => {
    const { component } = await createComponent();
    const rounds = component.rounds();
    expect(rounds).toHaveLength(2);
    expect(rounds[0].number).toBe(1);
    expect(rounds[1].number).toBe(2);
  });

  it('should sort matches within each round by position', async () => {
    const { component } = await createComponent();
    const round1 = component.rounds()[0];
    expect(round1.matches[0].position).toBe(1);
    expect(round1.matches[1].position).toBe(2);
  });

  // --- Computed: champion ---

  it('should compute champion when final has a winnerId — AC: champion identifié', async () => {
    const { component } = await createComponent({ matches: mockBracketComplete });
    const champion = component.champion();
    expect(champion).not.toBeNull();
    expect(champion!.id).toBe('p1');
    expect(champion!.name).toBe('Alice Dupont');
  });

  it('should return null champion when final has no winnerId — AC: champion non affiché en cours', async () => {
    const { component } = await createComponent({ matches: mockBracketPending });
    expect(component.champion()).toBeNull();
  });

  it('should return null champion when bracket is empty', async () => {
    const { component } = await createComponent({ matches: [] });
    expect(component.champion()).toBeNull();
  });

  // --- isCurrentPlayer ---

  it('should identify current player when playerId matches participant — AC: joueur mis en évidence', async () => {
    const { component } = await createComponent({ playerId: 'p1' });
    const participant = { id: 'p1', name: 'Alice Dupont', fromPool: 'pool1' };
    expect(component.isCurrentPlayer(participant)).toBe(true);
  });

  it('should return false for different player', async () => {
    const { component } = await createComponent({ playerId: 'p2' });
    const participant = { id: 'p1', name: 'Alice Dupont', fromPool: 'pool1' };
    expect(component.isCurrentPlayer(participant)).toBe(false);
  });

  it('should return false when playerId is not set', async () => {
    const { component } = await createComponent();
    const participant = { id: 'p1', name: 'Alice Dupont', fromPool: 'pool1' };
    expect(component.isCurrentPlayer(participant)).toBe(false);
  });

  it('should return false for null participant', async () => {
    const { component } = await createComponent({ playerId: 'p1' });
    expect(component.isCurrentPlayer(null)).toBe(false);
  });

  // --- hasCurrentPlayer ---

  it('should detect current player in match participantA', async () => {
    const { component } = await createComponent({ playerId: 'p1' });
    expect(component.hasCurrentPlayer(matchR1P1)).toBe(true);
  });

  it('should detect current player in match participantB', async () => {
    const { component } = await createComponent({ playerId: 'p2' });
    expect(component.hasCurrentPlayer(matchR1P1)).toBe(true);
  });

  it('should return false when current player not in match', async () => {
    const { component } = await createComponent({ playerId: 'p99' });
    expect(component.hasCurrentPlayer(matchR1P1)).toBe(false);
  });

  // --- Round labels ---

  it('should label the last round as "Finale"', async () => {
    const { component } = await createComponent();
    expect(component.roundLabel(2, 2)).toBe('Finale');
  });

  it('should label the second-to-last round as "Demi-finales"', async () => {
    const { component } = await createComponent();
    expect(component.roundLabel(3, 4)).toBe('Demi-finales');
  });

  it('should label earlier rounds as "Tour N"', async () => {
    const { component } = await createComponent();
    // In a 4-round bracket, round 1 is neither final/semis/quarters → "Tour 1"
    expect(component.roundLabel(1, 4)).toBe('Tour 1');
  });

  // --- Error state ---

  it('should set error when getBracket throws', async () => {
    TestBed.resetTestingModule();
    const bracketSvc = { getBracket: vi.fn().mockReturnValue(throwError(() => new Error('Network'))) };

    await TestBed.configureTestingModule({
      imports: [BracketViewComponent],
      providers: [{ provide: BracketService, useValue: bracketSvc }],
    }).compileComponents();

    const fixture = TestBed.createComponent(BracketViewComponent);
    fixture.componentRef.setInput('tournamentId', 't1');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.componentInstance.error()).toBeTruthy();
    expect(fixture.componentInstance.loading()).toBe(false);
  });

  // --- Template rendering ---

  it('should render participant names in template — AC: noms affichés', async () => {
    const { fixture } = await createComponent();
    const html = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(html).toContain('Alice Dupont');
    expect(html).toContain('Bob Martin');
    expect(html).toContain('Carol Durand');
  });

  it('should render scores for played matches — AC: scores des matchs joués affichés', async () => {
    const { fixture } = await createComponent();
    const html = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(html).toContain('21-15');
    expect(html).toContain('21-18');
  });

  it('should render champion banner when final has winner — AC: champion clairement identifié', async () => {
    const { fixture } = await createComponent({ matches: mockBracketComplete });
    const html = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(html).toContain('Champion du tournoi');
    expect(html).toContain('Alice Dupont');
  });

  it('should not render champion banner when final is pending — AC: champion absent si non déterminé', async () => {
    const { fixture } = await createComponent({ matches: mockBracketPending });
    const html = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(html).not.toContain('Champion du tournoi');
  });

  it('should render "À déterminer" for null participant in non-bye match — AC: adversaires à venir', async () => {
    const { fixture } = await createComponent({ matches: [matchR1P1, matchWithNullParticipants] });
    const html = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(html).toContain('À déterminer');
  });

  it('should render "Bye" for null participant in bye match — AC: bye distincts', async () => {
    const { fixture } = await createComponent({ matches: [matchBye] });
    const html = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(html).toContain('Bye');
  });

  it('should render round labels — AC: tous les rounds affichés', async () => {
    const { fixture } = await createComponent();
    const html = (fixture.nativeElement as HTMLElement).textContent ?? '';
    // mockBracketComplete has 2 rounds: round 1 = "Demi-finales", round 2 = "Finale"
    expect(html).toContain('Demi-finales');
    expect(html).toContain('Finale');
  });

  it('should highlight current player with (vous) label — AC: joueur courant mis en évidence', async () => {
    const { fixture } = await createComponent({ playerId: 'p1' });
    const html = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(html).toContain('(vous)');
  });

  it('should not show (vous) label when playerId does not match any participant', async () => {
    const { fixture } = await createComponent({ playerId: 'p99' });
    const html = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(html).not.toContain('(vous)');
  });

  it('should show "C\'est vous !" in champion banner when current player is champion', async () => {
    const { fixture } = await createComponent({ matches: mockBracketComplete, playerId: 'p1' });
    const html = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(html).toContain("C'est vous");
  });

  it('should show empty state when bracket has no matches', async () => {
    const { fixture } = await createComponent({ matches: [] });
    const html = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(html).toContain('Tableau non encore disponible');
  });

  // --- ngOnDestroy ---

  it('should unsubscribe on destroy', async () => {
    const { component } = await createComponent();
    const unsubSpy = vi.spyOn(component['subscription']!, 'unsubscribe');
    component.ngOnDestroy();
    expect(unsubSpy).toHaveBeenCalled();
  });
});
