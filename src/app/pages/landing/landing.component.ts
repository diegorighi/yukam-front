import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { NavbarComponent } from '../../components/navbar/navbar.component';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [NavbarComponent],
  templateUrl: './landing.component.html',
  styleUrl: './landing.component.css'
})
export class LandingComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private authService = inject(AuthService);

  ngOnInit(): void {
    // VERIFICAÇÃO 1: Detectar sessões corrompidas ao carregar landing page
    this.validateExistingSession();

    // VERIFICAÇÃO 2: Detectar se chegou aqui por erro de permissão via query params
    this.route.queryParams.subscribe(params => {
      if (params['error'] === 'forbidden') {
        console.error('[Landing] ERRO CRÍTICO: Acesso negado detectado');
        console.error('[Landing] Isso indica problema de autenticação/autorização');

        // Limpar qualquer estado de autenticação corrompido
        console.log('[Landing] Limpando localStorage e estado de autenticação...');
        this.authService.logout();

        // Mostrar mensagem para o usuário
        alert('Sua sessão expirou ou há um problema de permissões. Por favor, faça login novamente.');
      }
    });
  }

  /**
   * Valida se há uma sessão existente e se ela está íntegra
   * Sessões corrompidas são automaticamente limpas
   */
  private validateExistingSession(): void {
    if (this.authService.isAuthenticated()) {
      const user = this.authService.getCurrentUser();
      const roles = this.authService.getUserRoles();

      // Validação crítica: verificar se roles estão válidas
      if (!roles || roles.length === 0) {
        console.error('[Landing] Sessão corrompida detectada: usuário sem roles válidas');
        console.warn('[Landing] Executando auto-logout para limpar sessão...');

        this.authService.logout();

        // Feedback ao usuário
        alert(
          'Sua sessão anterior estava inválida ou expirou.\n' +
          'Por favor, faça login novamente.'
        );
        return;
      }

      // Validação adicional: verificar campos obrigatórios
      if (!user || !user.publicId || !user.login) {
        console.error('[Landing] Sessão corrompida detectada: campos obrigatórios ausentes');
        console.warn('[Landing] Executando auto-logout para limpar sessão...');

        this.authService.logout();

        alert(
          'Sua sessão anterior estava corrompida.\n' +
          'Por favor, faça login novamente.'
        );
        return;
      }

      // Sessão válida - apenas log informativo
      console.log(`[Landing] Sessão válida detectada: ${user.login} (${roles.join(', ')})`);
    } else {
      console.log('[Landing] Nenhuma sessão ativa detectada');
    }
  }
}
