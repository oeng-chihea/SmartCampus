import { describe, expect, it } from 'vitest';
import { float32ToPcm16Base64, resampleFloat32 } from './voice-audio.util';

describe('voice audio utils', () => {
  it('keeps samples unchanged when rates match', () => {
    const input = new Float32Array([0, 0.5, -0.5]);
    expect(resampleFloat32(input, 16000, 16000)).toBe(input);
  });

  it('encodes PCM16 as base64', () => {
    const encoded = float32ToPcm16Base64(new Float32Array([0, 1, -1]), 16000, 16000);
    expect(encoded.length).toBeGreaterThan(0);
    expect(() => atob(encoded)).not.toThrow();
  });
});
