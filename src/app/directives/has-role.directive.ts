import { Directive, Input, TemplateRef, ViewContainerRef, inject, effect } from '@angular/core';
import { AuthService } from '../services/auth.service';

/**
 * Structural Directive para renderização condicional baseada em roles
 *
 * Uso no template:
 * <div *appHasRole="'ROLE_ADMIN'">Conteúdo visível apenas para ADMIN</div>
 * <div *appHasRole="['ROLE_ADMIN', 'ROLE_ANALISTA']">Conteúdo para ADMIN ou ANALISTA</div>
 *
 * Também suporta negação:
 * <div *appHasRole="'ROLE_CLIENTE'; negate: true">Conteúdo para todos exceto CLIENTE</div>
 */
@Directive({
  selector: '[appHasRole]',
  standalone: true
})
export class HasRoleDirective {
  private authService = inject(AuthService);
  private templateRef = inject(TemplateRef<any>);
  private viewContainer = inject(ViewContainerRef);

  private hasView = false;

  @Input() set appHasRole(roles: string | string[]) {
    this.updateView(roles, false);
  }

  @Input() set appHasRoleNegate(negate: boolean) {
    // Será tratado na lógica do updateView
  }

  constructor() {
    // Usar effect para reagir a mudanças no usuário autenticado
    effect(() => {
      // Trigger re-render quando o usuário mudar
      this.authService.currentUser();
      // A view será atualizada pelo próximo set do appHasRole
    });
  }

  private updateView(roles: string | string[], negate: boolean = false): void {
    const rolesArray = Array.isArray(roles) ? roles : [roles];
    const hasRole = this.authService.hasAnyRole(rolesArray);
    const shouldShow = negate ? !hasRole : hasRole;

    if (shouldShow && !this.hasView) {
      this.viewContainer.createEmbeddedView(this.templateRef);
      this.hasView = true;
    } else if (!shouldShow && this.hasView) {
      this.viewContainer.clear();
      this.hasView = false;
    }
  }
}
