import { TestBed } from '@angular/core/testing';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { of } from 'rxjs';
import { ActivatedRoute } from '@angular/router';
import { PlayerProfileComponent } from './profile.component';
import { PlayerService } from '../../../core/services/player.service';
import { StatsService } from '../../../core/services/stats.service';

describe('PlayerProfileComponent', () => {
  let component: PlayerProfileComponent;
  let mockPlayerService: Partial<PlayerService>;

  const mockPlayer = {
    id: 'player-123',
    firstName: 'Jean',
    lastName: 'Dupont',
    gender: 'homme' as const,
    createdAt: '2026-05-13T12:00:00Z',
  };

  const mockRoute = {
    snapshot: {
      paramMap: {
        get: vi.fn().mockReturnValue('player-123'),
      },
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockPlayerService = {
      getPlayer: vi.fn().mockResolvedValue(mockPlayer),
    };

    const mockStatsService: Partial<StatsService> = {
      getPlayerStats: vi.fn().mockReturnValue(of({
        playerId: 'player-123',
        global: { played: 0, wins: 0, losses: 0, winRate: 0 },
        byGameType: [],
        tournaments: [],
      })),
    };

    TestBed.configureTestingModule({
      imports: [PlayerProfileComponent],
      providers: [
        { provide: ActivatedRoute, useValue: mockRoute },
        { provide: PlayerService, useValue: mockPlayerService },
        { provide: StatsService, useValue: mockStatsService },
      ],
    });

    const fixture = TestBed.createComponent(PlayerProfileComponent);
    component = fixture.componentInstance;
  });

  it('should be created', () => {
    expect(component).toBeTruthy();
  });

  it('should load player by id from route on init', async () => {
    await component.ngOnInit();

    expect(mockPlayerService.getPlayer).toHaveBeenCalledWith('player-123');
  });

  it('should set player signal after loading', async () => {
    await component.ngOnInit();

    expect(component.player()).toEqual(mockPlayer);
    expect(component.loading()).toBe(false);
  });

  // AC4: Le joueur reçoit son lien personnel pour accéder à son profil
  it('should set personalLink containing the player id — AC: lien personnel', async () => {
    await component.ngOnInit();

    expect(component.personalLink()).toContain('player-123');
    expect(component.personalLink()).toContain('/player/');
  });

  it('should set player to null when player is not found', async () => {
    vi.mocked(mockPlayerService.getPlayer!).mockResolvedValueOnce(null);

    await component.ngOnInit();

    expect(component.player()).toBeNull();
    expect(component.loading()).toBe(false);
  });

  it('should set loading to false even when id is empty', async () => {
    mockRoute.snapshot.paramMap.get = vi.fn().mockReturnValue('');

    await component.ngOnInit();

    expect(component.loading()).toBe(false);
    expect(component.player()).toBeNull();
  });
});
