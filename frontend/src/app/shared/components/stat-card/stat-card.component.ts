import { Component, input } from '@angular/core';
import { StatCard } from './stat-card.model';

@Component({
  selector: 'app-stat-card',
  templateUrl: './stat-card.component.html',
  styleUrl: './stat-card.component.scss',
})
export class StatCardComponent {
  readonly card = input.required<StatCard>();
  readonly animationDelay = input(0);
}
