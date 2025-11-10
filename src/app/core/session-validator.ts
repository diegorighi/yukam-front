import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';

/**
 * Session Validator
 * Valida automaticamente a sessão do usuário na inicialização da aplicação
 *
 * Uso: Configure como APP_INITIALIZER no app.config.ts
 *
 * Funcionalidades:
 * - Valida integridade dos dados de sessão
 * - Detecta sessões corrompidas ou inválidas
 * - Limpa automaticamente dados incompatíveis
 * - Previne erros de autenticação no bootstrap da aplicação
 */
export function validateSessionOnStartup() {
  return () => {
    const authService = inject(AuthService);

    console.log('[Session Validator] Validando sessão ao iniciar aplicação...');

    try {
      const user = authService.getCurrentUser();

      // Se há usuário, validar integridade dos dados
      if (user) {
        // Validação crítica: usuário DEVE ter roles válidas
        if (!user.roles || !Array.isArray(user.roles) || user.roles.length === 0) {
          console.error(
            '[Session Validator] Sessão inválida detectada: usuário sem roles. ' +
            'Limpando automaticamente...'
          );
          authService.clearAuthState();
          return Promise.resolve();
        }

        // Validação de campos obrigatórios
        if (!user.publicId || !user.login) {
          console.error(
            '[Session Validator] Sessão inválida detectada: campos obrigatórios ausentes. ' +
            'Limpando automaticamente...'
          );
          authService.clearAuthState();
          return Promise.resolve();
        }

        console.log(`[Session Validator] Sessão válida: ${user.login} (${user.roles.join(', ')})`);
      } else {
        console.log('[Session Validator] Nenhuma sessão ativa encontrada');
      }

      return Promise.resolve();
    } catch (error) {
      console.error('[Session Validator] Erro ao validar sessão:', error);
      // Em caso de erro, limpar estado para evitar problemas
      authService.clearAuthState();
      return Promise.resolve();
    }
  };
}
