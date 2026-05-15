import { TestBed, ComponentFixture } from '@angular/core/testing';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { of } from 'rxjs';
import { MatchScheduleComponent } from './match-schedule.component';
import { MatchService } from '../../../core/services/match.service';
import { provideRouter } from '@angular/router';
import { ComponentRef } from '@angular/core';
import { Match } from '../../../core/models/match.model';

const mockMatches: Match[] = [
  {
    id: 'm1',
    tournamentId: 't1',
    poolId: 'pool1',
    gameType: 'simple-homme',
    participantA: { id: 'p1', name: 'Dupont Alice' },
    participantB: { id: 'p2', name: 'Martin Bob' },
    status: 'pending',
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

const mockMatchService = {
  getMatchesForPool: vi.fn().mockReturnValue(of([])),
  generateMatches: vi.fn().mockResolvedValue(undefined),
  updateMatchScore: vi.fn().mockResolvedValue(undefined),
};

describe('MatchScheduleComponent', () => {
  let fixture: ComponentFixture<MatchScheduleComponent>;
  let component: MatchScheduleComponent;
  let componentRef: ComponentRef<MatchScheduleComponent>;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockMatchService.getMatchesForPool.mockReturnValue(of([]));
    mockMatchService.generateMatches.mockResolvedValue(undefined);

    await TestBed.configureTestingModule({
      imports: [MatchScheduleComponent],
      providers: [
        provideRouter([]),
        { provide: MatchService, useValue: mockMatchService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(MatchScheduleComponent);
    component = fixture.componentInstance;
    componentRef = fixture.componentRef;
    componentRef.setInput('tournamentId', 't1');
    componentRef.setInput('poolId', 'pool1');
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('should be created', () => {
    expect(component).toBeTruthy();
  });

  // --- Initial state ---

  it('should start with empty matches', () => {
    expect(component.matches()).toEqual([]);
  });

  it('should start with generating = false', () => {
    expect(component.generating()).toBe(false);
  });

  it('should start with no error', () => {
    expect(component.error()).toBeNull();
  });

  // --- ngOnInit ---

  it('should load matches from MatchService on init', async () => {
    mockMatchService.getMatchesForPool.mockReturnValue(of(mockMatches));

    componentRef.setInput('tournamentId', 't1');
    componentRef.setInput('poolId', 'pool1');
    component.ngOnInit();

    expect(mockMatchService.getMatchesForPool).toHaveBeenCalledWith('t1', 'pool1');
    expect(component.matches()).toEqual(mockMatches);
  });

  // --- Computed counts ---

  it('playedCount should return number of played matches', () => {
    mockMatchService.getMatchesForPool.mockReturnValue(of(mockMatches));
    component.ngOnInit();

    expect(component.playedCount()).toBe(1);
  });

  it('pendingCount should return number of pending matches', () => {
    mockMatchService.getMatchesForPool.mockReturnValue(of(mockMatches));
    component.ngOnInit();

    expect(component.pendingCount()).toBe(2);
  });

  // --- generate() ---

  it('generate() should call generateMatches with correct args — AC: génération round-robin', async () => {
    await component.generate();

    expect(mockMatchService.generateMatches).toHaveBeenCalledWith('t1', 'pool1');
  });

  it('generate() should set generating to true during execution', async () => {
    let wasGenerating = false;
    mockMatchService.generateMatches.mockImplementation(async () => {
      wasGenerating = component.generating();
    });

    await component.generate();

    expect(wasGenerating).toBe(true);
    expect(component.generating()).toBe(false);
  });

  it('generate() should set error on failure', async () => {
    mockMatchService.generateMatches.mockRejectedValueOnce(new Error('Network error'));

    await component.generate();

    expect(component.error()).toBe('Network error');
    expect(component.generating()).toBe(false);
  });

  it('generate() should clear error before generating', async () => {
    component.error.set('previous error');

    await component.generate();

    // error cleared during call (set to null before awaiting)
    expect(component.error()).toBeNull();
  });
});
