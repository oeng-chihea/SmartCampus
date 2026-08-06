import { DatePipe } from '@angular/common';
import { Component, OnDestroy, OnInit, computed, inject } from '@angular/core';
import { AuthService } from '../../../../services/auth.service';
import { OpenLiveSessionCard } from '../../../../models/session.model';
import { StudentScanPageFlow } from './student-scan.flow';
import { StudentScanPageState } from './student-scan.state';

/**
 * Student attendance page.
 * Shows the same live open-session QR as the teacher, then Mark me present.
 */
@Component({
  selector: 'app-student-scan',
  imports: [DatePipe],
  templateUrl: './student-scan.component.html',
  styleUrl: './student-scan.component.scss',
  providers: [StudentScanPageState, StudentScanPageFlow],
})
export class StudentScanComponent implements OnInit, OnDestroy {
  readonly state = inject(StudentScanPageState);
  private readonly flow = inject(StudentScanPageFlow);
  private readonly auth = inject(AuthService);

  readonly user = computed(() => this.auth.user());

  async ngOnInit(): Promise<void> {
    await this.flow.init();
  }

  ngOnDestroy(): void {
    this.flow.destroy();
  }

  refresh(): Promise<void> {
    return this.flow.reload(true);
  }

  markPresent(session: OpenLiveSessionCard): Promise<void> {
    return this.flow.markPresent(session);
  }

  alreadyDone(sessionTitle: string): boolean {
    return this.state.hasSubmittedFor(sessionTitle);
  }

  logout(): void {
    this.flow.logout();
  }
}
