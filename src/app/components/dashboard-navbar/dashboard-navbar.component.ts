import { Component, signal, Output, EventEmitter, ViewEncapsulation, Input, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TipoPessoa } from '../../models/cliente.model';
import { ThemeToggleComponent } from '../theme-toggle/theme-toggle.component';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-dashboard-navbar',
  standalone: true,
  imports: [CommonModule, ThemeToggleComponent],
  templateUrl: './dashboard-navbar.component.html',
  styleUrl: './dashboard-navbar.component.css',
  encapsulation: ViewEncapsulation.None
})
export class DashboardNavbarComponent {
  private authService = inject(AuthService);

  tipoPessoa = signal<TipoPessoa>('PF');
  showUserMenu = signal<boolean>(false);

  @Output() tipoPessoaChange = new EventEmitter<TipoPessoa>();
  @Input() disableTipoPessoa = false;

  // Computed para obter usuário atual
  currentUser = computed(() => this.authService.currentUser());

  // Computed para obter primeira role do usuário (para exibir badge)
  userRole = computed(() => {
    const user = this.currentUser();
    if (!user || !user.roles || user.roles.length === 0) return null;

    // Mapear role para label amigável
    const roleMap: { [key: string]: string } = {
      'ROLE_ADMIN': 'Admin',
      'ROLE_ANALISTA': 'Analista',
      'ROLE_FUNCIONARIO': 'Funcionário',
      'ROLE_CLIENTE': 'Cliente'
    };

    return roleMap[user.roles[0]] || user.roles[0];
  });

  setTipoPessoa(tipo: TipoPessoa) {
    if (this.disableTipoPessoa) {
      return;
    }
    this.tipoPessoa.set(tipo);
    this.tipoPessoaChange.emit(tipo);
  }

  getTipoPessoa(): TipoPessoa {
    return this.tipoPessoa();
  }

  toggleUserMenu() {
    this.showUserMenu.set(!this.showUserMenu());
  }

  logout() {
    this.authService.logout();
  }
}
