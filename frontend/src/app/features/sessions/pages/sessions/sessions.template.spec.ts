import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const template = readFileSync(join(__dirname, 'sessions.component.html'), 'utf8');
const flowSource = readFileSync(join(__dirname, 'sessions.flow.ts'), 'utf8');

describe('Sessions template', () => {
  it('hides Due on edit and keeps it on create', () => {
    expect(template).toContain('@if (!state.isEditDialog())');
    expect(template).toContain('id="session-due-label"');
    expect(template).toContain('name="dueDate"');
    expect(template).toContain('name="dueTime"');
    expect(template).toContain('Session title');
    expect(template).toContain('Campus location');
  });

  it('keeps QR attendance display without a Camera deep-link URL', () => {
    expect(template).toContain('Live QR');
    expect(template).toContain('Attendance session QR code');
    expect(template).toContain('Copy attendance code');
    expect(template).not.toContain('Scan link');
    expect(template).not.toContain('student/scan?payload');
    expect(flowSource).not.toContain('buildAttendanceScanUrl');
    expect(flowSource).not.toContain('ScanOriginService');
    expect(flowSource).toContain('QRCode.toDataURL(rawPayload');
  });
});
