import * as Tone from "tone";
import { normalizePitchForTone } from "@/lib/music/pitch";

const SALAMANDER_BASE_URL = "https://tonejs.github.io/audio/salamander/";

const SALAMANDER_URLS: Record<string, string> = {
  A0: "A0.mp3",
  C1: "C1.mp3",
  "D#1": "Ds1.mp3",
  "F#1": "Fs1.mp3",
  A1: "A1.mp3",
  C2: "C2.mp3",
  "D#2": "Ds2.mp3",
  "F#2": "Fs2.mp3",
  A2: "A2.mp3",
  C3: "C3.mp3",
  "D#3": "Ds3.mp3",
  "F#3": "Fs3.mp3",
  A3: "A3.mp3",
  C4: "C4.mp3",
  "D#4": "Ds4.mp3",
  "F#4": "Fs4.mp3",
  A4: "A4.mp3",
  C5: "C5.mp3",
  "D#5": "Ds5.mp3",
  "F#5": "Fs5.mp3",
  A5: "A5.mp3",
  C6: "C6.mp3",
  "D#6": "Ds6.mp3",
  "F#6": "Fs6.mp3",
  A6: "A6.mp3",
  C7: "C7.mp3",
  "D#7": "Ds7.mp3",
  "F#7": "Fs7.mp3",
  A7: "A7.mp3",
  C8: "C8.mp3",
};

export interface PartitionInstrument {
  triggerAttackRelease(
    pitch: string,
    duration: number,
    time?: number,
    velocity?: number,
  ): void;
  triggerAttack(pitch: string, time?: number, velocity?: number): void;
  triggerRelease(pitch: string, time?: number): void;
  releaseAll(): void;
  dispose(): void;
}

let instrumentPromise: Promise<PartitionInstrument> | null = null;
let cachedInstrument: PartitionInstrument | null = null;

type PitchCapableSynth = {
  triggerAttack: (
    pitch: string,
    time?: number,
    velocity?: number,
  ) => void;
  triggerRelease: (pitch: string, time?: number) => void;
  triggerAttackRelease: (
    pitch: string,
    duration: number,
    time?: number,
    velocity?: number,
  ) => void;
  releaseAll: () => void;
};

function wrapWithPitchNormalization(
  source: PitchCapableSynth,
): Pick<
  PartitionInstrument,
  "triggerAttack" | "triggerRelease" | "triggerAttackRelease" | "releaseAll"
> {
  return {
    triggerAttack(pitch, time, velocity) {
      source.triggerAttack(normalizePitchForTone(pitch), time, velocity);
    },
    triggerRelease(pitch, time) {
      source.triggerRelease(normalizePitchForTone(pitch), time);
    },
    triggerAttackRelease(pitch, duration, time, velocity) {
      source.triggerAttackRelease(
        normalizePitchForTone(pitch),
        duration,
        time,
        velocity,
      );
    },
    releaseAll() {
      source.releaseAll();
    },
  };
}

function createFallbackInstrument(): PartitionInstrument {
  const synth = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: "triangle" },
    envelope: { attack: 0.02, decay: 0.1, sustain: 0.3, release: 0.4 },
  }).toDestination();

  const wrapped = wrapWithPitchNormalization(synth);

  return {
    ...wrapped,
    dispose() {
      synth.dispose();
    },
  };
}

async function loadSamplerInstrument(): Promise<PartitionInstrument> {
  const reverb = new Tone.Reverb({ decay: 2, wet: 0.25 });
  await reverb.generate();

  const sampler = new Tone.Sampler({
    urls: SALAMANDER_URLS,
    baseUrl: SALAMANDER_BASE_URL,
    release: 1.2,
  });
  sampler.connect(reverb);
  reverb.toDestination();

  await Tone.loaded();

  const wrapped = wrapWithPitchNormalization(sampler);

  return {
    ...wrapped,
    dispose() {
      sampler.dispose();
      reverb.dispose();
    },
  };
}

export function getPianoInstrument(): Promise<PartitionInstrument> {
  if (cachedInstrument) {
    return Promise.resolve(cachedInstrument);
  }

  if (!instrumentPromise) {
    instrumentPromise = loadSamplerInstrument()
      .then((instrument) => {
        cachedInstrument = instrument;
        return instrument;
      })
      .catch(() => {
        const fallback = createFallbackInstrument();
        cachedInstrument = fallback;
        return fallback;
      });
  }

  return instrumentPromise;
}

export function disposePianoInstrument(): void {
  cachedInstrument?.dispose();
  cachedInstrument = null;
  instrumentPromise = null;
}
