import { TestBed } from '@angular/core/testing';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthService } from './auth.service';

// Mock Firebase Auth module — use string-only in factory to avoid hoisting issues
vi.mock('@angular/fire/auth', () => ({
  Auth: class MockAuth {},
  GoogleAuthProvider: class MockGoogleAuthProvider {},
  signInWithPopup: vi.fn().mockResolvedValue({ user: { uid: 'uid1', email: 'test@test.com', displayName: 'Test User' } }),
  signOut: vi.fn().mockResolvedValue(undefined),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onAuthStateChanged: vi.fn().mockImplementation((_auth: any, callback: any) => {
    callback(null);
    return () => {};
  }),
  browserLocalPersistence: {},
  setPersistence: vi.fn().mockResolvedValue(undefined),
}));

// Mock Firestore module
vi.mock('@angular/fire/firestore', () => ({
  Firestore: class MockFirestore {},
  doc: vi.fn().mockReturnValue({ path: 'users/uid1' }),
  getDoc: vi.fn().mockResolvedValue({ exists: () => false, data: () => null }),
  setDoc: vi.fn().mockResolvedValue(undefined),
}));

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    vi.clearAllMocks();

    const { Auth } = await import('@angular/fire/auth');
    const { Firestore } = await import('@angular/fire/firestore');

    // Reset default mock behaviour
    const { onAuthStateChanged } = await import('@angular/fire/auth');
    vi.mocked(onAuthStateChanged).mockImplementation((_auth: any, callback: any) => {
      callback(null);
      return () => {};
    });

    TestBed.configureTestingModule({
      providers: [
        AuthService,
        { provide: Auth, useValue: {} },
        { provide: Firestore, useValue: {} },
      ],
    });
    service = TestBed.inject(AuthService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should expose currentUser signal as null initially (no auth state)', () => {
    expect(service.currentUser()).toBeNull();
  });

  it('isAuthenticated should be false when no user is logged in', () => {
    expect(service.isAuthenticated()).toBe(false);
  });

  it('isAdmin should be false when no user is logged in', () => {
    expect(service.isAdmin()).toBe(false);
  });

  it('should call signInWithPopup with GoogleAuthProvider on signInWithGoogle — AC: Google OAuth', async () => {
    const { signInWithPopup } = await import('@angular/fire/auth');
    await service.signInWithGoogle();
    expect(signInWithPopup).toHaveBeenCalled();
  });

  it('should call signOut on Firebase Auth on signOut', async () => {
    const { signOut } = await import('@angular/fire/auth');
    await service.signOut();
    expect(signOut).toHaveBeenCalled();
  });

  it('should set currentUser to null after signOut', async () => {
    await service.signOut();
    expect(service.currentUser()).toBeNull();
  });

  it('isAdmin should return true when user role is admin — AC: admin role distinct', async () => {
    const { Auth } = await import('@angular/fire/auth');
    const { Firestore } = await import('@angular/fire/firestore');
    const { getDoc } = await import('@angular/fire/firestore');
    const { onAuthStateChanged } = await import('@angular/fire/auth');

    vi.mocked(getDoc).mockResolvedValueOnce({
      exists: () => true,
      data: () => ({ role: 'admin' }),
    } as any);

    const firebaseUser = { uid: 'admin-uid', email: 'admin@test.com', displayName: 'Admin User' };
    // eslint-disable-next-line prefer-const
    let authCallback: (((user: any) => void) | null) = null;

    vi.mocked(onAuthStateChanged).mockImplementationOnce((_auth: any, cb: any) => {
      authCallback = cb;
      return () => {};
    });

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        AuthService,
        { provide: Auth, useValue: {} },
        { provide: Firestore, useValue: {} },
      ],
    });

    const freshService = TestBed.inject(AuthService);

    if (authCallback !== null) {
      await (authCallback as (user: any) => Promise<void>)(firebaseUser);
    }

    expect(freshService.isAdmin()).toBe(true);
  });

  it('isAdmin should return false when user role is player — AC: admin role distinct', async () => {
    const { Auth } = await import('@angular/fire/auth');
    const { Firestore } = await import('@angular/fire/firestore');
    const { getDoc } = await import('@angular/fire/firestore');
    const { onAuthStateChanged } = await import('@angular/fire/auth');

    vi.mocked(getDoc).mockResolvedValueOnce({
      exists: () => true,
      data: () => ({ role: 'player' }),
    } as any);

    const firebaseUser = { uid: 'player-uid', email: 'player@test.com', displayName: 'Player User' };
    // eslint-disable-next-line prefer-const
    let authCallback: (((user: any) => void) | null) = null;

    vi.mocked(onAuthStateChanged).mockImplementationOnce((_auth: any, cb: any) => {
      authCallback = cb;
      return () => {};
    });

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        AuthService,
        { provide: Auth, useValue: {} },
        { provide: Firestore, useValue: {} },
      ],
    });

    const playerService = TestBed.inject(AuthService);

    if (authCallback !== null) {
      await (authCallback as (user: any) => Promise<void>)(firebaseUser);
    }

    expect(playerService.isAdmin()).toBe(false);
  });

  it('should subscribe to authState so session persists — AC: session persistence', async () => {
    // Firebase handles token refresh internally when browserLocalPersistence is set
    // Verifying onAuthStateChanged was called ensures the service listens to auth state changes
    const { onAuthStateChanged } = await import('@angular/fire/auth');
    expect(onAuthStateChanged).toHaveBeenCalled();
  });

  it('should call setPersistence with browserLocalPersistence — AC: session persistence', async () => {
    const { setPersistence, browserLocalPersistence } = await import('@angular/fire/auth');
    expect(setPersistence).toHaveBeenCalledWith({}, browserLocalPersistence);
  });
});
