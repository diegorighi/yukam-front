import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

export interface Breadcrumb {
  label: string;
  icon?: string;
  active?: boolean;
}

@Component({
  selector: 'app-breadcrumbs',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './breadcrumbs.component.html',
  styleUrl: './breadcrumbs.component.css'
})
export class BreadcrumbsComponent {
  @Input() breadcrumbs: Breadcrumb[] = [];

  constructor(private sanitizer: DomSanitizer) {}

  getSafeIcon(icon: string | undefined): SafeHtml {
    return icon ? this.sanitizer.bypassSecurityTrustHtml(icon) : '';
  }
}
