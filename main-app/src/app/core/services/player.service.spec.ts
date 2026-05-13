import { TestBed } from '@angular/core/testing';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { of } from 'rxjs';
import { PlayerService } from './player.service';
import { Player } from '../models/player.model';

vi.mock('@angular/fire/firestore', () => ({
  Firestore: class MockFirestore {},
  collection: vi.fn().mockReturnValue({ path: 'players' }),
  collectionData: vi.fn(),
  doc: vi.fn().mockReturnValue({ path: 'players/player-1' }),
  updateDoc: vi.fn().mockResolvedValue(undefined),
  query: vi.fn().mockImplementation((ref) => ref),
  orderBy: vi.fn().mockReturnValue({}),
}));

const mockPlayers: Player[] = [
  { id: 'p1', firstName: 'Alice', lastName: 'Dupont', gender: 'F', active: true },
  { id: 'p2', firstName: 'Bob', lastName: 'Martin', gender: 'M', active: true },
  { id: 'p3', firstName: 'Claire', lastName: 'Bernard', gender: 'F', active: false },
];

describe('PlayerService', () => {
  let service: PlayerService;

  beforeEach(async () => {
    vi.clearAllMocks();

    const { collectionData } = await import('@angular/fire/firestore');
    vi.mocked(collectionData).mockReturnValue(of(mockPlayers) as any);

    const { Firestore } = await import('@angular/fire/firestore');

    TestBed.configureTestingModule({
      providers: [
        PlayerService,
        { provide: Firestore, useValue: {} },
      ],
    });

    service = TestBed.inject(PlayerService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('getPlayers() should return an Observable of players — AC: liste membres', () => {
    return new Promise<void>((resolve) => {
      service.getPlayers().subscribe((players) => {
        expect(players).toHaveLength(3);
        resolve();
      });
    });
  });

  it('getPlayers() should return players with nom, prénom, genre — AC: liste nom/prénom/genre', () => {
    return new Promise<void>((resolve) => {
      service.getPlayers().subscribe((players) => {
        const player = players[0];
        expect(player).toHaveProperty('firstName');
        expect(player).toHaveProperty('lastName');
        expect(player).toHaveProperty('gender');
        resolve();
      });
    });
  });

  it('getPlayers() should return players with active flag — AC: désactivation profil', () => {
    return new Promise<void>((resolve) => {
      service.getPlayers().subscribe((players) => {
        const active = players.find((p) => p.id === 'p1');
        const inactive = players.find((p) => p.id === 'p3');
        expect(active?.active).toBe(true);
        expect(inactive?.active).toBe(false);
        resolve();
      });
    });
  });

  it('deactivatePlayer() should call updateDoc with active: false — AC: désactivation profil', async () => {
    const { updateDoc } = await import('@angular/fire/firestore');
    await service.deactivatePlayer('player-1');
    expect(updateDoc).toHaveBeenCalledWith(
      expect.anything(),
      { active: false }
    );
  });

  it('deactivatePlayer() should call doc with correct player ID — AC: désactivation profil', async () => {
    const { doc } = await import('@angular/fire/firestore');
    await service.deactivatePlayer('player-1');
    expect(doc).toHaveBeenCalledWith(expect.anything(), 'players', 'player-1');
  });
});
