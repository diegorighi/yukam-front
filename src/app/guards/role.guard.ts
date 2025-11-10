import { inject } from '@angular/core';
import { Router, CanActivateFn, ActivatedRouteSnapshot } from '@angular/router';
import { AuthService } from '../services/auth.service';

/**
 * Role Guard Factory
 * Cria guards dinâmicos baseados em roles
 *
 * Uso:
 * { path: 'admin', component: AdminComponent, canActivate: [authGuard, roleGuard(['ROLE_ADMIN'])] }
 *
 * Verifica se o usuário possui PELO MENOS UMA das roles fornecidas
 * Se não tiver permissão, redireciona para /dashboard com mensagem de erro
 *
 * @param allowedRoles Array de roles permitidas
 * @returns CanActivateFn guard function
 */
export function roleGuard(allowedRoles: string[]): CanActivateFn {
  return (route: ActivatedRouteSnapshot) => {
    const authService = inject(AuthService);
    const router = inject(Router);

    // Primeiro verificar se está autenticado
    if (!authService.isAuthenticated()) {
      router.navigate(['/login']);
      return false;
    }

    // Verificar se tem pelo menos uma das roles permitidas
    if (authService.hasAnyRole(allowedRoles)) {
      return true;
    }

    // Não tem permissão - redirecionar para dashboard com mensagem
    console.warn(`Acesso negado: usuário não possui nenhuma das roles: ${allowedRoles.join(', ')}`);
    router.navigate(['/dashboard'], {
      queryParams: { error: 'forbidden' }
    });

    return false;
  };
}

/**
 * Admin Guard
 * Atalho para proteção de rotas administrativas
 * Requer ROLE_ADMIN
 */
export const adminGuard: CanActivateFn = roleGuard(['ROLE_ADMIN']);

/**
 * Staff Guard
 * Permite acesso para funcionários (ADMIN, ANALISTA, FUNCIONARIO)
 * Bloqueia ROLE_CLIENTE
 */
export const staffGuard: CanActivateFn = roleGuard(['ROLE_ADMIN', 'ROLE_ANALISTA', 'ROLE_FUNCIONARIO']);

/**
 * Analyst Guard
 * Permite acesso para ADMIN e ANALISTA (gráficos, relatórios)
 */
export const analystGuard: CanActivateFn = roleGuard(['ROLE_ADMIN', 'ROLE_ANALISTA']);
