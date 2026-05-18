import { TestBed } from '@angular/core/testing';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Router, UrlTree } from '@angular/router';
import { signal, computed } from '@angular/core';
import { adminGuard } from './admin.guard';
import { AuthService } from '../services/auth.service';

describe('adminGuard', () => {
  let mockAuthService: Partial<AuthService>;
  let mockRouter: Partial<Router>;

  const createGuardResult = () => {
    return TestBed.runInInjectionContext(() => adminGuard({} as never, {} as never));
  };

  beforeEach(() => {
    mockRouter = {
      createUrlTree: vi.fn().mockReturnValue({ toString: () => '/login' } as UrlTree),
    };
  });

  it('should allow access when user is authenticated and is admin', () => {
    mockAuthService = {
      isAuthenticated: computed(() => true),
      isAdmin: computed(() => true),
      authReady: signal(true),
      currentUser: signal(null),
    } as unknown as AuthService;

    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: mockAuthService },
        { provide: Router, useValue: mockRouter },
      ],
    });

    const result = createGuardResult();
    expect(result).toBe(true);
  });

  it('should redirect to /login when user is not authenticated', () => {
    mockAuthService = {
      isAuthenticated: computed(() => false),
      isAdmin: computed(() => false),
      authReady: signal(true),
      currentUser: signal(null),
    } as unknown as AuthService;

    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: mockAuthService },
        { provide: Router, useValue: mockRouter },
      ],
    });

    const result = createGuardResult();
    expect(result).not.toBe(true);
    expect(mockRouter.createUrlTree).toHaveBeenCalledWith(['/login']);
  });

  it('should redirect to /login when user is authenticated but not admin', () => {
    mockAuthService = {
      isAuthenticated: computed(() => true),
      isAdmin: computed(() => false),
      authReady: signal(true),
      currentUser: signal(null),
    } as unknown as AuthService;

    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: mockAuthService },
        { provide: Router, useValue: mockRouter },
      ],
    });

    const result = createGuardResult();
    expect(result).not.toBe(true);
    expect(mockRouter.createUrlTree).toHaveBeenCalledWith(['/login']);
  });

  it('should return a UrlTree pointing to /login for unauthorized access', () => {
    mockAuthService = {
      isAuthenticated: computed(() => false),
      isAdmin: computed(() => false),
      authReady: signal(true),
      currentUser: signal(null),
    } as unknown as AuthService;

    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: mockAuthService },
        { provide: Router, useValue: mockRouter },
      ],
    });

    createGuardResult();
    expect(mockRouter.createUrlTree).toHaveBeenCalledWith(['/login']);
  });
});
