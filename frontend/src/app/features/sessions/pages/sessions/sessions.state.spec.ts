import { describe, expect, it } from 'vitest';
import { AttendanceSession } from '../../../../models/session.model';
import { SessionsPageState } from './sessions.state';

function sampleSession(overrides: Partial<AttendanceSession> = {}): AttendanceSession {
  return {
    id: 'sess-edit-1',
    title: 'SE401 · Morning Lecture',
    locationId: 'LOC-002',
    locationName: 'Building B, Room 105',
    teacherId: 'u-teacher-1',
    teacherName: 'Teacher Kim',
    status: 'Open',
    dueAt: new Date(2026, 7, 20, 14, 30, 0, 0).toISOString(),
    createdAt: new Date(2026, 7, 20, 8, 0, 0, 0).toISOString(),
    openedAt: new Date(2026, 7, 20, 8, 0, 0, 0).toISOString(),
    closedAt: null,
    ...overrides,
  };
}

describe('SessionsPageState edit dialog', () => {
  it('prefills the form from the session and marks the dialog as edit', () => {
    const state = new SessionsPageState();
    const session = sampleSession();

    state.openEditDialog(session);

    expect(state.createDialogOpen()).toBe(true);
    expect(state.isEditDialog()).toBe(true);
    expect(state.editTarget()?.id).toBe('sess-edit-1');
    expect(state.title).toBe('SE401 · Morning Lecture');
    expect(state.locationId).toBe('LOC-002');
    expect(state.dueDate).toBe('');
    expect(state.dueTime).toBe('');
  });

  it('create dialog is not edit mode and resets the form', () => {
    const state = new SessionsPageState();
    state.title = 'Leftover';
    state.openDialog();

    expect(state.isEditDialog()).toBe(false);
    expect(state.editTarget()).toBeNull();
    expect(state.title).toBe('');
  });

  it('blocks dismiss while an edit save is in flight', () => {
    const state = new SessionsPageState();
    state.openEditDialog(sampleSession());
    state.beginEdit();

    state.closeDialog();

    expect(state.createDialogOpen()).toBe(true);
    expect(state.formBusy()).toBe(true);

    state.endEdit();
    state.editSucceeded('SE401 · Morning Lecture');
    expect(state.createDialogOpen()).toBe(false);
    expect(state.isEditDialog()).toBe(false);
    expect(state.success()).toContain('was updated');
  });
});
