import { TestBed } from '@angular/core/testing';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { of } from 'rxjs';
import { ActivatedRoute, Router } from '@angular/router';
import { PlayerDetailComponent } from './player-detail.component';
import { PlayerService } from '../../../core/services/player.service';
import { Player } from '../../../core/models/player.model';

const mockPlayers: Player[] = [
  { id: 'p1', firstName: 'Alice', lastName: 'Dupont', gender: 'F', active: true },
  { id: 'p2', firstName: 'Bob', lastName: 'Martin', gender: 'M', active: false },
];

describe('PlayerDetailComponent', () => {
  let component: PlayerDetailComponent;
  let mockPlayerService: { getPlayers: ReturnType<typeof vi.fn>; deactivatePlayer: ReturnType<typeof vi.fn> };
  let mockRouter: { navigate: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    mockPlayerService = {
      getPlayers: vi.fn().mockReturnValue(of(mockPlayers)),
      deactivatePlayer: vi.fn().mockResolvedValue(undefined),
    };
    mockRouter = {
      navigate: vi.fn(),
    };

    TestBed.configureTestingModule({
      imports: [PlayerDetailComponent],
      providers: [
        { provide: PlayerService, useValue: mockPlayerService },
        { provide: Router, useValue: mockRouter },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { paramMap: { get: vi.fn().mockReturnValue('p1') } },
          },
        },
      ],
    });

    const fixture = TestBed.createComponent(PlayerDetailComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('should be created', () => {
    expect(component).toBeTruthy();
  });

  it('should load and display the correct player by id — AC: accès profil détaillé', () => {
    expect(component.player()?.id).toBe('p1');
    expect(component.player()?.firstName).toBe('Alice');
    expect(component.player()?.lastName).toBe('Dupont');
  });

  it('should display player gender — AC: liste nom/prénom/genre', () => {
    expect(component.player()?.gender).toBe('F');
  });

  it('goBack() should navigate to /admin/players — AC: accès profil détaillé', () => {
    component.goBack();
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/admin/players']);
  });
});
