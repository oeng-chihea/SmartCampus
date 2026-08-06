import {
  Component,
  DestroyRef,
  HostListener,
  OnInit,
  inject,
  input,
  output,
} from '@angular/core';
import {
  CampusLocation,
  LocationDetail,
  LocationPersonPresence,
} from '../../../models/location.model';

@Component({
  selector: 'app-location-detail-dialog',
  templateUrl: './location-detail-dialog.component.html',
  styleUrl: './location-detail-dialog.component.scss',
})
export class LocationDetailDialogComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);

  readonly detail = input.required<LocationDetail>();
  readonly closed = output<void>();

  ngOnInit(): void {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    this.destroyRef.onDestroy(() => {
      document.body.style.overflow = previousOverflow;
    });
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.closed.emit();
  }

  close(): void {
    this.closed.emit();
  }

  onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.closed.emit();
    }
  }

  coordinatesLabel(location: CampusLocation): string {
    return `${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}`;
  }

  radiusLabel(meters: number): string {
    return `${meters} m`;
  }

  statusClass(status: string): string {
    return status.toLowerCase().replace(/\s+/g, '-');
  }

  initials(name: string): string {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) {
      return '?';
    }
    if (parts.length === 1) {
      return parts[0].slice(0, 2).toUpperCase();
    }
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  personProfileLine(person: LocationPersonPresence): string {
    const bits: string[] = [person.studentId];
    if (person.course) {
      bits.push(person.course);
    }
    if (person.year) {
      bits.push(person.year);
    }
    if (person.email) {
      bits.push(person.email);
    }
    return bits.join(' · ');
  }
}
