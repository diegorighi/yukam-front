import { Component, signal, Output, EventEmitter, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TipoPessoa } from '../../models/cliente.model';
import { ThemeToggleComponent } from '../theme-toggle/theme-toggle.component';

@Component({
  selector: 'app-dashboard-navbar',
  standalone: true,
  imports: [CommonModule, ThemeToggleComponent],
  templateUrl: './dashboard-navbar.component.html',
  styleUrl: './dashboard-navbar.component.css',
  encapsulation: ViewEncapsulation.None
})
export class DashboardNavbarComponent {
  tipoPessoa = signal<TipoPessoa>('PF');

  @Output() tipoPessoaChange = new EventEmitter<TipoPessoa>();

  setTipoPessoa(tipo: TipoPessoa) {
    this.tipoPessoa.set(tipo);
    this.tipoPessoaChange.emit(tipo);
  }

  getTipoPessoa(): TipoPessoa {
    return this.tipoPessoa();
  }
}
