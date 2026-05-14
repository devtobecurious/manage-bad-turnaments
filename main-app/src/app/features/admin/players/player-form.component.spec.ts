import { TestBed } from '@angular/core/testing';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PlayerFormComponent } from './player-form.component';
import { PlayerService } from '../../../core/services/player.service';
import { InviteService } from '../../../core/services/invite.service';
import { AuthService } from '../../../core/services/auth.service';
import { Player } from '../../../core/models/player.model';
import { signal } from '@angular/core';

const mockPlayer: Player = {
  id: 'player-1',
  firstName: 'Jean',
  lastName: 'Dupont',
  gender: 'homme',
  createdAt: '2026-05-13T00:00:00Z',
  active: true,
};

const mockInvite = {
  id: 'invite-1',
  token: 'abc-123',
  createdBy: 'admin-uid',
  createdAt: '2026-05-13T00:00:00Z',
  active: true,
};

describe('PlayerFormComponent', () => {
  let component: PlayerFormComponent;
  let mockPlayerService: { registerPlayer: ReturnType<typeof vi.fn> };
  let mockInviteService: { createInvite: ReturnType<typeof vi.fn> };
  let mockAuthService: { currentUser: ReturnType<typeof signal<{ uid: string; displayName: string } | null>> };

  beforeEach(() => {
    mockPlayerService = {
      registerPlayer: vi.fn().mockResolvedValue(mockPlayer),
    };

    mockInviteService = {
      createInvite: vi.fn().mockResolvedValue(mockInvite),
    };

    const userSignal = signal<{ uid: string; displayName: string } | null>({
      uid: 'admin-uid',
      displayName: 'Admin',
    });
    mockAuthService = { currentUser: userSignal };

    TestBed.configureTestingModule({
      imports: [PlayerFormComponent],
      providers: [
        { provide: PlayerService, useValue: mockPlayerService },
        { provide: InviteService, useValue: mockInviteService },
        { provide: AuthService, useValue: mockAuthService },
      ],
    });

    component = TestBed.createComponent(PlayerFormComponent).componentInstance;
  });

  it('should be created', () => {
    expect(component).toBeTruthy();
  });

  it('formData should have firstName, lastName and gender fields — AC: form fields present', () => {
    expect('firstName' in component.formData).toBe(true);
    expect('lastName' in component.formData).toBe(true);
    expect('gender' in component.formData).toBe(true);
  });

  it('onSubmit should call playerService.registerPlayer with form data — AC: writes to Firestore', async () => {
    component.formData = { firstName: 'Jean', lastName: 'Dupont', gender: 'homme' };

    await component.onSubmit();

    expect(mockPlayerService.registerPlayer).toHaveBeenCalledWith({
      firstName: 'Jean',
      lastName: 'Dupont',
      gender: 'homme',
    });
  });

  it('onSubmit should call inviteService.createInvite after creating player — AC: unique invite link generated', async () => {
    component.formData = { firstName: 'Jean', lastName: 'Dupont', gender: 'homme' };

    await component.onSubmit();

    expect(mockInviteService.createInvite).toHaveBeenCalledWith('admin-uid');
  });

  it('onSubmit should set createdPlayer signal after success — AC: link shown after creation', async () => {
    component.formData = { firstName: 'Jean', lastName: 'Dupont', gender: 'homme' };

    await component.onSubmit();

    expect(component.createdPlayer()).toEqual(mockPlayer);
  });

  it('onSubmit should set inviteLink signal after success — AC: invite link displayed', async () => {
    component.formData = { firstName: 'Jean', lastName: 'Dupont', gender: 'homme' };

    await component.onSubmit();

    expect(component.inviteLink()).toContain(mockInvite.token);
  });

  it('onSubmit should not call registerPlayer if firstName is empty — AC: form validation', async () => {
    component.formData = { firstName: '', lastName: 'Dupont', gender: 'homme' };

    await component.onSubmit();

    expect(mockPlayerService.registerPlayer).not.toHaveBeenCalled();
  });

  it('onSubmit should set errorMessage on failure — AC: error handling', async () => {
    mockPlayerService.registerPlayer.mockRejectedValueOnce(new Error('Firestore error'));
    component.formData = { firstName: 'Jean', lastName: 'Dupont', gender: 'homme' };

    await component.onSubmit();

    expect(component.errorMessage()).toBeTruthy();
  });

  it('copyLink should call navigator.clipboard.writeText with the inviteLink — AC: link is copyable', async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText: writeTextMock } });

    component.formData = { firstName: 'Jean', lastName: 'Dupont', gender: 'homme' };
    await component.onSubmit();
    await component.copyLink();

    expect(writeTextMock).toHaveBeenCalledWith(component.inviteLink());
  });

  it('copyLink should set copied signal to true — AC: copy feedback shown', async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText: writeTextMock } });

    component.formData = { firstName: 'Jean', lastName: 'Dupont', gender: 'homme' };
    await component.onSubmit();
    await component.copyLink();

    expect(component.copied()).toBe(true);
  });

  it('resetForm should clear createdPlayer signal', async () => {
    component.formData = { firstName: 'Jean', lastName: 'Dupont', gender: 'homme' };
    await component.onSubmit();

    component.resetForm();

    expect(component.createdPlayer()).toBeNull();
  });

  it('resetForm should clear inviteLink signal', async () => {
    component.formData = { firstName: 'Jean', lastName: 'Dupont', gender: 'homme' };
    await component.onSubmit();

    component.resetForm();

    expect(component.inviteLink()).toBe('');
  });

  it('inviteLink should contain the invite token — AC: unique link generated', async () => {
    component.formData = { firstName: 'Jean', lastName: 'Dupont', gender: 'homme' };
    await component.onSubmit();

    expect(component.inviteLink()).toContain(mockInvite.token);
  });
});
