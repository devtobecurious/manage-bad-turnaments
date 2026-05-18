import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { toObservable } from '@angular/core/rxjs-interop';
import { filter, map, take } from 'rxjs/operators';
import { AuthService } from '../services/auth.service';

const checkAccess = (authService: AuthService, router: Router) =>
  authService.isAuthenticated() && authService.isAdmin()
    ? true
    : router.createUrlTree(['/login']);

export const adminGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // Auth state already resolved (normal flow after login)
  if (authService.authReady()) {
    return checkAccess(authService, router);
  }

  // Auth state not yet resolved (e.g. page refresh — wait for onAuthStateChanged)
  return toObservable(authService.authReady).pipe(
    filter(ready => ready),
    take(1),
    map(() => checkAccess(authService, router)),
  );
};
