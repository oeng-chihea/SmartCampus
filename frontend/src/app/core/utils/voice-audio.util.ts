const INPUT_SAMPLE_RATE = 16000;

export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = '';
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return btoa(binary);
}

export function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(String(base64 || ''));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

export function resampleFloat32(
  input: Float32Array,
  inputRate: number,
  outputRate: number,
): Float32Array {
  if (!input.length || !inputRate || !outputRate || inputRate === outputRate) {
    return input;
  }

  const outputLength = Math.max(
    1,
    Math.round((input.length * outputRate) / inputRate),
  );
  const output = new Float32Array(outputLength);

  if (inputRate > outputRate) {
    const ratio = inputRate / outputRate;
    let inputOffset = 0;
    for (let index = 0; index < outputLength; index += 1) {
      const nextInputOffset = Math.min(
        input.length,
        Math.round((index + 1) * ratio),
      );
      let sum = 0;
      let count = 0;
      for (
        let sampleIndex = inputOffset;
        sampleIndex < nextInputOffset;
        sampleIndex += 1
      ) {
        sum += input[sampleIndex];
        count += 1;
      }
      output[index] = count
        ? sum / count
        : input[Math.min(inputOffset, input.length - 1)] || 0;
      inputOffset = nextInputOffset;
    }
    return output;
  }

  const ratio = inputRate / outputRate;
  for (let index = 0; index < outputLength; index += 1) {
    const position = index * ratio;
    const leftIndex = Math.floor(position);
    const rightIndex = Math.min(leftIndex + 1, input.length - 1);
    const blend = position - leftIndex;
    output[index] =
      input[leftIndex] + (input[rightIndex] - input[leftIndex]) * blend;
  }
  return output;
}

export function float32ToPcm16Base64(
  samples: Float32Array,
  inputRate: number,
  outputRate = INPUT_SAMPLE_RATE,
): string {
  const resampled = resampleFloat32(samples, inputRate, outputRate);
  if (!resampled.length) {
    return '';
  }

  const pcmBuffer = new ArrayBuffer(resampled.length * 2);
  const view = new DataView(pcmBuffer);
  for (let index = 0; index < resampled.length; index += 1) {
    const clamped = Math.max(-1, Math.min(1, resampled[index]));
    view.setInt16(index * 2, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
  }
  return arrayBufferToBase64(pcmBuffer);
}

export function pcm16Base64ToAudioBuffer(
  context: AudioContext,
  base64: string,
  sampleRate: number,
): AudioBuffer {
  const bytes = base64ToUint8Array(base64);
  const sampleCount = Math.floor(bytes.byteLength / 2);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const buffer = context.createBuffer(1, Math.max(1, sampleCount), sampleRate);
  const channel = buffer.getChannelData(0);
  for (let index = 0; index < sampleCount; index += 1) {
    channel[index] = view.getInt16(index * 2, true) / 0x8000;
  }
  return buffer;
}

/** 0–1 mouth openness from a Web Audio time-domain byte snapshot. */
export function speechLevelFromTimeDomain(samples: Uint8Array): number {
  if (!samples.length) {
    return 0;
  }
  let sum = 0;
  for (let index = 0; index < samples.length; index += 1) {
    const centered = (samples[index] - 128) / 128;
    sum += centered * centered;
  }
  const rms = Math.sqrt(sum / samples.length);
  return Math.min(1, Math.max(0, (rms - 0.018) / 0.22));
}

export function voiceCaptureWorkletSource(): string {
  return `
class VoiceCaptureProcessor extends AudioWorkletProcessor {
  process(inputs) {
    const input = inputs[0];
    const channel = input && input[0];
    if (channel && channel.length) {
      const copy = new Float32Array(channel.length);
      copy.set(channel);
      this.port.postMessage(copy, [copy.buffer]);
    }
    return true;
  }
}
registerProcessor('voice-capture-processor', VoiceCaptureProcessor);
`.trim();
}
