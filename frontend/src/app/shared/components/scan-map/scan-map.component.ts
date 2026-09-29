import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  effect,
  input,
  viewChild,
} from '@angular/core';
import * as L from 'leaflet';
import { DeviceCoordinates } from '../../../core/utils/geolocation.util';
import { GeoZone } from '../../../core/utils/geofence.util';

const DEFAULT_CENTER: L.LatLngExpression = [11.5479313, 104.9405941];

/**
 * Leaflet + OSM map for the student scan card.
 * Draws the session geofence circle and the live device pin. No HTTP.
 */
@Component({
  selector: 'app-scan-map',
  templateUrl: './scan-map.component.html',
  styleUrl: './scan-map.component.scss',
})
export class ScanMapComponent implements AfterViewInit, OnDestroy {
  readonly zone = input<GeoZone | null>(null);
  readonly device = input<DeviceCoordinates | null>(null);

  private readonly host = viewChild<ElementRef<HTMLDivElement>>('mapHost');

  private map: L.Map | null = null;
  private zoneCircle: L.Circle | null = null;
  private accuracyCircle: L.Circle | null = null;
  private deviceMarker: L.CircleMarker | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private lastFitKey: string | null = null;

  constructor() {
    effect(() => {
      this.zone();
      this.device();
      this.redraw();
    });
  }

  ngAfterViewInit(): void {
    const element = this.host()?.nativeElement;
    if (!element) {
      return;
    }

    this.map = L.map(element, {
      preferCanvas: true,
      zoomControl: true,
      attributionControl: true,
    }).setView(DEFAULT_CENTER, 16);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(this.map);

    this.redraw();
    queueMicrotask(() => this.map?.invalidateSize());

    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => this.map?.invalidateSize());
      this.resizeObserver.observe(element);
    }
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.map?.remove();
    this.map = null;
    this.lastFitKey = null;
  }

  mapAriaLabel(): string {
    return this.zone()
      ? 'Map of the recorded scan position and the class zone'
      : 'Map of the recorded scan position';
  }

  private redraw(): void {
    const map = this.map;
    if (!map) {
      return;
    }

    const zone = this.zone();
    const device = this.device();

    if (zone) {
      const center: L.LatLngExpression = [zone.latitude, zone.longitude];
      if (this.zoneCircle) {
        this.zoneCircle.setLatLng(center);
        this.zoneCircle.setRadius(zone.radiusMeters);
      } else {
        this.zoneCircle = L.circle(center, {
          radius: zone.radiusMeters,
          color: '#15803d',
          weight: 2,
          fillColor: '#22c55e',
          fillOpacity: 0.18,
        }).addTo(map);
      }
    } else if (this.zoneCircle) {
      this.zoneCircle.remove();
      this.zoneCircle = null;
    }

    if (device) {
      const here: L.LatLngExpression = [device.latitude, device.longitude];
      if (this.deviceMarker) {
        this.deviceMarker.setLatLng(here);
      } else {
        this.deviceMarker = L.circleMarker(here, {
          radius: 8,
          color: '#1d4ed8',
          weight: 2,
          fillColor: '#3b82f6',
          fillOpacity: 1,
        }).addTo(map);
      }

      if (device.accuracyMeters != null && device.accuracyMeters > 0) {
        if (this.accuracyCircle) {
          this.accuracyCircle.setLatLng(here);
          this.accuracyCircle.setRadius(device.accuracyMeters);
        } else {
          this.accuracyCircle = L.circle(here, {
            radius: device.accuracyMeters,
            color: '#2563eb',
            weight: 1,
            fillColor: '#60a5fa',
            fillOpacity: 0.12,
          }).addTo(map);
        }
      } else if (this.accuracyCircle) {
        this.accuracyCircle.remove();
        this.accuracyCircle = null;
      }
    } else {
      this.deviceMarker?.remove();
      this.deviceMarker = null;
      this.accuracyCircle?.remove();
      this.accuracyCircle = null;
    }

    const fitKey = this.scanMapFitKey(zone, device);
    if (fitKey !== this.lastFitKey) {
      this.fit(map, zone, device);
      this.lastFitKey = fitKey;
    }
  }

  /**
   * Changes only when the map's bounds need to be recalculated. Device movement
   * updates the marker but does not repeatedly move the user's viewport.
   */
  private scanMapFitKey(
    zone: GeoZone | null,
    device: DeviceCoordinates | null,
  ): string {
    const deviceState = device ? 'device' : 'no-device';
    if (!zone) {
      return `no-zone:${deviceState}`;
    }
    return `zone:${zone.latitude}:${zone.longitude}:${zone.radiusMeters}:${deviceState}`;
  }

  private fit(map: L.Map, zone: GeoZone | null, device: DeviceCoordinates | null): void {
    const bounds = L.latLngBounds([]);
    if (zone) {
      bounds.extend([zone.latitude, zone.longitude]);
      if (this.zoneCircle) {
        bounds.extend(this.zoneCircle.getBounds());
      }
    }
    if (device) {
      bounds.extend([device.latitude, device.longitude]);
    }
    if (bounds.isValid()) {
      map.fitBounds(bounds.pad(0.35), { maxZoom: 17, animate: false });
      return;
    }
    map.setView(DEFAULT_CENTER, 16);
  }
}
