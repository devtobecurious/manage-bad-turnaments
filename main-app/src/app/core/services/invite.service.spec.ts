import { TestBed } from '@angular/core/testing';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { InviteService } from './invite.service';

const mockInviteDocRef = { id: 'invite-doc-id', ref: {} };
const mockExistingDoc = {
  ref: { path: 'invites/old-invite' },
};

vi.mock('@angular/fire/firestore', () => ({
  Firestore: class MockFirestore {},
  collection: vi.fn().mockReturnValue({ path: 'invites' }),
  addDoc: vi.fn().mockResolvedValue({ id: 'invite-doc-id' }),
  query: vi.fn().mockReturnValue({ type: 'query' }),
  where: vi.fn().mockReturnValue({ type: 'where' }),
  getDocs: vi.fn().mockResolvedValue({ empty: true, docs: [] }),
  updateDoc: vi.fn().mockResolvedValue(undefined),
}));

describe('InviteService', () => {
  let service: InviteService;

  beforeEach(async () => {
    vi.clearAllMocks();

    const { Firestore, getDocs } = await import('@angular/fire/firestore');
    vi.mocked(getDocs).mockResolvedValue({ empty: true, docs: [] } as never);

    TestBed.configureTestingModule({
      providers: [
        InviteService,
        { provide: Firestore, useValue: {} },
      ],
    });

    service = TestBed.inject(InviteService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  // AC1: L'admin génère un lien d'invitation global pour le club (non nominatif)
  it('createInvite should write to Firestore invites collection — AC: lien d\'invitation global', async () => {
    const { addDoc } = await import('@angular/fire/firestore');

    const invite = await service.createInvite('admin-uid-1');

    expect(addDoc).toHaveBeenCalled();
    expect(invite.active).toBe(true);
    expect(invite.createdBy).toBe('admin-uid-1');
  });

  it('createInvite should return an invite with a UUID token — AC: lien unique', async () => {
    const invite = await service.createInvite('admin-uid-1');

    expect(invite.token).toBeDefined();
    expect(typeof invite.token).toBe('string');
    expect(invite.token.length).toBeGreaterThan(0);
    expect(invite.id).toBe('invite-doc-id');
  });

  it('createInvite should deactivate existing active invites before creating a new one', async () => {
    const { getDocs, updateDoc } = await import('@angular/fire/firestore');

    vi.mocked(getDocs).mockResolvedValueOnce({
      empty: false,
      docs: [mockExistingDoc],
    } as never);

    await service.createInvite('admin-uid-1');

    expect(updateDoc).toHaveBeenCalledWith(
      mockExistingDoc.ref,
      { active: false }
    );
  });

  it('createInvite should store createdBy, createdAt, token, active in Firestore', async () => {
    const { addDoc } = await import('@angular/fire/firestore');

    await service.createInvite('admin-uid-1');

    expect(addDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        createdBy: 'admin-uid-1',
        active: true,
        token: expect.any(String),
        createdAt: expect.any(String),
      })
    );
  });

  it('getInviteByToken should return null for unknown or inactive token', async () => {
    const result = await service.getInviteByToken('invalid-token');
    expect(result).toBeNull();
  });

  it('getInviteByToken should return invite for valid active token', async () => {
    const { getDocs } = await import('@angular/fire/firestore');

    vi.mocked(getDocs).mockResolvedValueOnce({
      empty: false,
      docs: [
        {
          id: 'invite-doc-id',
          data: () => ({
            token: 'valid-token',
            createdBy: 'admin-uid-1',
            createdAt: '2026-05-13T12:00:00Z',
            active: true,
          }),
        },
      ],
    } as never);

    const result = await service.getInviteByToken('valid-token');

    expect(result).not.toBeNull();
    expect(result?.token).toBe('valid-token');
    expect(result?.active).toBe(true);
    expect(result?.id).toBe('invite-doc-id');
  });

  it('getInviteByToken should use "active == true" and "token" filters', async () => {
    const { query, where } = await import('@angular/fire/firestore');

    await service.getInviteByToken('some-token');

    expect(where).toHaveBeenCalledWith('token', '==', 'some-token');
    expect(where).toHaveBeenCalledWith('active', '==', true);
  });
});
