import { Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-admin-placeholder-page',
  templateUrl: './admin-placeholder-page.component.html',
  styleUrl: './admin-placeholder-page.component.scss',
})
export class AdminPlaceholderPageComponent {
  private readonly route = inject(ActivatedRoute);

  readonly title = this.route.snapshot.data['title'] as string;
}
