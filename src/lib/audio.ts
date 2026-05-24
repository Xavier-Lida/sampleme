/**
 * Convert a browser MediaRecorder Blob (typically WebM/Opus) into a 16-bit
 * PCM mono WAV. This keeps the backend ffmpeg-free — librosa/soundfile only
 * need to handle WAV.
 */
export async function blobToWav(blob: Blob, targetSampleRate = 22050): Promise<Blob> {
  const arrayBuffer = await blob.arrayBuffer();

  // Decode using a temporary AudioContext (browser handles the codec).
  const decodeCtx = new AudioContext();
  let decoded: AudioBuffer;
  try {
    decoded = await decodeCtx.decodeAudioData(arrayBuffer.slice(0));
  } finally {
    decodeCtx.close().catch(() => undefined);
  }

  // Resample + downmix to mono via OfflineAudioContext.
  const lengthAtTarget = Math.ceil(decoded.duration * targetSampleRate);
  const offline = new OfflineAudioContext(1, lengthAtTarget, targetSampleRate);
  const src = offline.createBufferSource();
  src.buffer = decoded;
  src.connect(offline.destination);
  src.start(0);
  const rendered = await offline.startRendering();

  return encodeWav(rendered.getChannelData(0), targetSampleRate);
}

function encodeWav(samples: Float32Array, sampleRate: number): Blob {
  const numChannels = 1;
  const bytesPerSample = 2;
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = samples.length * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // PCM chunk size
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bytesPerSample * 8, true);
  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

function writeString(view: DataView, offset: number, str: string): void {
  for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
}

import * as Tone from 'tone';
import {
  getPartitionInstrument,
  type PlaybackInstrumentId,
} from '@/lib/music/partition-instruments';
import { midiToPitch } from '@/lib/music/pitch';

interface PlayableNote {
  pitch: number;
  start: number;
  end: number;
  velocity?: number;
}

/**
 * Play a sequence of notes through the selected instrument. The instrument is
 * loaded lazily on first use and cached for subsequent calls, so switching
 * back and forth between piano and guitar only pays the network cost once per
 * instrument.
 */
export async function playMelody(
  notes: PlayableNote[],
  instrumentId: PlaybackInstrumentId = 'piano',
): Promise<void> {
  if (notes.length === 0) return;

  // Web Audio policies require a user gesture before starting; the click that
  // triggers playMelody satisfies that, but we still need to call start().
  await Tone.start();
  const instrument = await getPartitionInstrument(instrumentId);

  const lastEnd = notes[notes.length - 1].end;
  const startAt = Tone.now() + 0.1;

  for (const note of notes) {
    const duration = Math.max(0.08, note.end - note.start);
    const velocity =
      typeof note.velocity === 'number' ? note.velocity / 127 : undefined;
    instrument.triggerAttackRelease(
      midiToPitch(note.pitch),
      duration,
      startAt + note.start,
      velocity,
    );
  }

  await new Promise<void>((resolve) => {
    setTimeout(resolve, (lastEnd + 0.6) * 1000);
  });
}
