import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const template = readFileSync(
  join(__dirname, 'voice-assistant.component.html'),
  'utf8',
);
const styles = readFileSync(
  join(__dirname, 'voice-assistant.component.scss'),
  'utf8',
);

describe('Voice assistant template', () => {
  it('exposes a code-drawn talking person driven by live speech, with no media or transcripts', () => {
    expect(template).toContain('voice.toggle()');
    expect(template).toContain('voice-assistant__human');
    expect(template).toContain('voice-assistant__head');
    expect(template).toContain('voice-assistant__talk');
    expect(template).toContain('voice-assistant__lips');
    expect(template).toContain('voice.speechLevel()');
    expect(template).toContain('onDragPointerDown');
    expect(template).toContain('voice-assistant__backdrop');
    expect(template).toContain('voice-assistant__close');
    expect(template).toContain('Say stop or tap X to close');
    expect(template).not.toContain('rx="16"');
    expect(template).not.toContain('ry="13"');
    expect(template).toContain('role="alert"');
    expect(template).toContain('statusLabel()');
    expect(template).not.toContain('cv-bg');
    expect(template).not.toContain('voice-assistant__ring');
    expect(template).not.toContain('<img');
    expect(template).not.toContain('<video');
    expect(template).not.toContain('portrait');
    expect(template).not.toContain('userTranscript');
    expect(template).not.toContain('assistantTranscript');
    expect(template).not.toContain('voice-assistant__panel');
    expect(template).not.toContain('idleClip');
    expect(template).not.toContain('speakClip');
  });

  it('uses a smaller character footprint on phone widths', () => {
    expect(styles).toContain('@media (max-width: 720px)');
    expect(styles).toContain('height: 96px;');
    expect(styles).toContain('width: 82px;');
    expect(styles).toContain('height: 144px;');
    expect(styles).toContain('width: 122px;');
  });
});
