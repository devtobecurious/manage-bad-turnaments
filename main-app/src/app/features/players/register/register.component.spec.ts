import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ActivatedRoute, Router } from '@angular/router';
import { RegisterComponent } from './register.component';
import { PlayerService } from '../../../core/services/player.service';
import { InviteService } from '../../../core/services/invite.service';

describe('RegisterComponent', () => {
  let component: RegisterComponent;
  let mockPlayerService: Partial<PlayerService>;
  let mockInviteService: Partial<InviteService>;
  let mockRouter: Partial<Router>;

  const mockRoute = {
    snapshot: {
      paramMap: {
        get: vi.fn().mockReturnValue('valid-token'),
      },
    },
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    // Reset route mock to default (valid token) — individual tests may override it
    mockRoute.snapshot.paramMap.get = vi.fn().mockReturnValue('valid-token');

    mockPlayerService = {
      registerPlayer: vi.fn().mockResolvedValue({
        id: 'player-123',
        firstName: 'Jean',
        lastName: 'Dupont',
        gender: 'homme',
        createdAt: '2026-05-13T12:00:00Z',
      }),
    };

    mockInviteService = {
      getInviteByToken: vi.fn().mockResolvedValue({
        id: 'invite-1',
        token: 'valid-token',
        createdBy: 'admin-uid',
        createdAt: '2026-05-13T10:00:00Z',
        active: true,
      }),
    };

    mockRouter = {
      navigate: vi.fn(),
    };

    TestBed.configureTestingModule({
      imports: [RegisterComponent],
      providers: [
        { provide: ActivatedRoute, useValue: mockRoute },
        { provide: Router, useValue: mockRouter },
        { provide: PlayerService, useValue: mockPlayerService },
        { provide: InviteService, useValue: mockInviteService },
      ],
    });

    const fixture = TestBed.createComponent(RegisterComponent);
    component = fixture.componentInstance;
    // Run ngOnInit so checkingToken becomes false (required for onSubmit guards)
    await component.ngOnInit();
  });

  it('should be created', () => {
    expect(component).toBeTruthy();
  });

  // AC1: Lien d'invitation global — validation du token
  it('should mark invite as invalid when token is not found — AC: lien d\'invitation valide', async () => {
    vi.mocked(mockInviteService.getInviteByToken!).mockResolvedValueOnce(null);

    await component.ngOnInit();

    expect(component.inviteInvalid()).toBe(true);
  });

  it('should mark invite as invalid when no token in route', async () => {
    mockRoute.snapshot.paramMap.get = vi.fn().mockReturnValue('');

    await component.ngOnInit();

    expect(component.inviteInvalid()).toBe(true);
  });

  it('should not mark invite as invalid for valid token', async () => {
    mockRoute.snapshot.paramMap.get = vi.fn().mockReturnValue('valid-token');

    await component.ngOnInit();

    expect(component.inviteInvalid()).toBe(false);
  });

  // AC2: Le joueur remplit prénom, nom, genre
  it('onSubmit should not call registerPlayer when firstName is missing', async () => {
    component.firstName = '';
    component.lastName = 'Dupont';
    component.gender = 'homme';

    await component.onSubmit();

    expect(mockPlayerService.registerPlayer).not.toHaveBeenCalled();
  });

  it('onSubmit should not call registerPlayer when lastName is missing', async () => {
    component.firstName = 'Jean';
    component.lastName = '';
    component.gender = 'homme';

    await component.onSubmit();

    expect(mockPlayerService.registerPlayer).not.toHaveBeenCalled();
  });

  it('onSubmit should not call registerPlayer when gender is missing', async () => {
    component.firstName = 'Jean';
    component.lastName = 'Dupont';
    component.gender = '';

    await component.onSubmit();

    expect(mockPlayerService.registerPlayer).not.toHaveBeenCalled();
  });

  // AC3: Un profil est créé avec un identifiant unique
  it('onSubmit should call registerPlayer with firstName, lastName, gender — AC: création du profil', async () => {
    component.firstName = 'Jean';
    component.lastName = 'Dupont';
    component.gender = 'homme';

    await component.onSubmit();

    expect(mockPlayerService.registerPlayer).toHaveBeenCalledWith({
      firstName: 'Jean',
      lastName: 'Dupont',
      gender: 'homme',
    });
  });

  // AC4: Le joueur reçoit son lien personnel
  it('onSubmit should set personalLink with player id after registration — AC: lien personnel', async () => {
    component.firstName = 'Jean';
    component.lastName = 'Dupont';
    component.gender = 'homme';

    await component.onSubmit();

    expect(component.personalLink()).toContain('player-123');
    expect(component.personalLink()).toContain('/player/');
  });

  it('onSubmit should set registered to true on success', async () => {
    component.firstName = 'Jean';
    component.lastName = 'Dupont';
    component.gender = 'homme';

    await component.onSubmit();

    expect(component.registered()).toBe(true);
  });

  it('should set error signal when registerPlayer throws', async () => {
    vi.mocked(mockPlayerService.registerPlayer!).mockRejectedValueOnce(new Error('Firestore error'));

    component.firstName = 'Jean';
    component.lastName = 'Dupont';
    component.gender = 'homme';

    await component.onSubmit();

    expect(component.error()).not.toBeNull();
    expect(component.registered()).toBe(false);
  });

  it('should clear loading signal after onSubmit completes', async () => {
    component.firstName = 'Jean';
    component.lastName = 'Dupont';
    component.gender = 'homme';

    await component.onSubmit();

    expect(component.loading()).toBe(false);
  });
});
