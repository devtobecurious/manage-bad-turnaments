import { TestBed } from '@angular/core/testing';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { signal } from '@angular/core';
import { Router } from '@angular/router';
import { LoginComponent } from './login.component';
import { AuthService } from '../../../core/services/auth.service';

describe('LoginComponent', () => {
  let component: LoginComponent;
  let mockAuthService: Partial<AuthService>;
  let mockRouter: Partial<Router>;

  beforeEach(() => {
    mockAuthService = {
      signInWithGoogle: vi.fn().mockResolvedValue(undefined),
      // currentUser must be a signal — LoginComponent uses toObservable(authService.currentUser)
      currentUser: signal({ uid: 'u1', email: 'test@test.com', displayName: 'Test', role: 'admin' }),
    };
    mockRouter = {
      navigate: vi.fn().mockResolvedValue(true),
    };

    TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [
        { provide: AuthService, useValue: mockAuthService },
        { provide: Router, useValue: mockRouter },
      ],
    });

    const fixture = TestBed.createComponent(LoginComponent);
    component = fixture.componentInstance;
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  it('should have isLoading signal as false initially', () => {
    expect(component.isLoading()).toBe(false);
  });

  it('should have errorMessage signal as null initially', () => {
    expect(component.errorMessage()).toBeNull();
  });

  it('should call authService.signInWithGoogle when signInWithGoogle is called', async () => {
    await component.signInWithGoogle();
    expect(mockAuthService.signInWithGoogle).toHaveBeenCalled();
  });

  it('should navigate to /admin on successful sign-in', async () => {
    await component.signInWithGoogle();
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/admin']);
  });

  it('should set errorMessage when sign-in fails', async () => {
    vi.mocked(mockAuthService.signInWithGoogle!).mockRejectedValueOnce(new Error('auth error'));
    await component.signInWithGoogle();
    expect(component.errorMessage()).toBeTruthy();
  });

  it('should reset isLoading to false after sign-in completes', async () => {
    await component.signInWithGoogle();
    expect(component.isLoading()).toBe(false);
  });

  it('should reset isLoading to false even when sign-in fails', async () => {
    vi.mocked(mockAuthService.signInWithGoogle!).mockRejectedValueOnce(new Error('auth error'));
    await component.signInWithGoogle();
    expect(component.isLoading()).toBe(false);
  });
});
