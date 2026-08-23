import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const template = readFileSync(
  join(__dirname, 'voice-assistant.component.html'),
  'utf8',
);

describe('Voice assistant template', () => {
  it('exposes start/stop mic control and live transcripts', () => {
    expect(template).toContain('voice.toggle()');
    expect(template).toContain('voice.userTranscript()');
    expect(template).toContain('voice.assistantTranscript()');
    expect(template).toContain('role="alert"');
  });
});
