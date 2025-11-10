import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { AuthService } from '../services/auth.service';

/**
 * Auth Guard
 * Protege rotas que requerem autenticação
 *
 * Uso:
 * { path: 'dashboard', component: DashboardComponent, canActivate: [authGuard] }
 *
 * Se usuário não estiver autenticado, redireciona para /login
 */
export const authGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isAuthenticated()) {
    return true;
  }

  // Salvar a URL original para redirecionar após login
  const returnUrl = state.url;
  router.navigate(['/login'], {
    queryParams: { returnUrl }
  });

  return false;
};
