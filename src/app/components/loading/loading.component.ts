import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-loading',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './loading.component.html',
  styleUrl: './loading.component.css'
})
export class LoadingComponent {
  @Input() message: string = 'Carregando...';
  @Input() size: 'small' | 'medium' | 'large' = 'medium';
  @Input() type: 'dots' | 'progress-bar' = 'dots';
}
