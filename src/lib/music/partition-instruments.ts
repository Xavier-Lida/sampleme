import * as Tone from "tone";
import { normalizePitchForTone } from "@/lib/music/pitch";

export type PlaybackInstrumentId = "piano" | "guitar-acoustic";

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

const GUITAR_ACOUSTIC_BASE_URL =
  "https://nbrosowsky.github.io/tonejs-instruments/samples/guitar-acoustic/";

const GUITAR_ACOUSTIC_URLS: Record<string, string> = {
  E2: "E2.mp3",
  "F#2": "Fs2.mp3",
  A2: "A2.mp3",
  B2: "B2.mp3",
  C3: "C3.mp3",
  "D#3": "Ds3.mp3",
  D3: "D3.mp3",
  E3: "E3.mp3",
  "F#3": "Fs3.mp3",
  G3: "G3.mp3",
  "A#3": "As3.mp3",
  B3: "B3.mp3",
  C4: "C4.mp3",
  "D#4": "Ds4.mp3",
  E4: "E4.mp3",
  "F#4": "Fs4.mp3",
  G4: "G4.mp3",
  A4: "A4.mp3",
  C5: "C5.mp3",
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

const INSTRUMENT_LABELS: Record<PlaybackInstrumentId, string> = {
  piano: "piano",
  "guitar-acoustic": "guitare",
};

export function getInstrumentLabel(id: PlaybackInstrumentId): string {
  return INSTRUMENT_LABELS[id];
}

const cachedInstruments = new Map<PlaybackInstrumentId, PartitionInstrument>();
const instrumentPromises = new Map<
  PlaybackInstrumentId,
  Promise<PartitionInstrument>
>();

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

function createPianoFallback(): PartitionInstrument {
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

function createGuitarFallback(): PartitionInstrument {
  const synth = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: "triangle" },
    envelope: { attack: 0.001, decay: 0.35, sustain: 0.05, release: 0.6 },
  }).toDestination();

  const wrapped = wrapWithPitchNormalization(synth);

  return {
    ...wrapped,
    dispose() {
      synth.dispose();
    },
  };
}

async function loadSamplerWithReverb(
  urls: Record<string, string>,
  baseUrl: string,
  reverbOptions: { decay: number; wet: number },
  release: number,
): Promise<PartitionInstrument> {
  const reverb = new Tone.Reverb(reverbOptions);
  await reverb.generate();

  const sampler = new Tone.Sampler({
    urls,
    baseUrl,
    release,
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

async function loadPianoInstrument(): Promise<PartitionInstrument> {
  return loadSamplerWithReverb(
    SALAMANDER_URLS,
    SALAMANDER_BASE_URL,
    { decay: 2, wet: 0.25 },
    1.2,
  );
}

async function loadGuitarAcousticInstrument(): Promise<PartitionInstrument> {
  return loadSamplerWithReverb(
    GUITAR_ACOUSTIC_URLS,
    GUITAR_ACOUSTIC_BASE_URL,
    { decay: 1.5, wet: 0.15 },
    0.8,
  );
}

function getFallbackFor(id: PlaybackInstrumentId): PartitionInstrument {
  return id === "guitar-acoustic"
    ? createGuitarFallback()
    : createPianoFallback();
}

function loadInstrument(id: PlaybackInstrumentId): Promise<PartitionInstrument> {
  const cached = cachedInstruments.get(id);
  if (cached) {
    return Promise.resolve(cached);
  }

  const pending = instrumentPromises.get(id);
  if (pending) {
    return pending;
  }

  const loader =
    id === "guitar-acoustic" ? loadGuitarAcousticInstrument : loadPianoInstrument;

  const promise = loader()
    .then((instrument) => {
      cachedInstruments.set(id, instrument);
      return instrument;
    })
    .catch(() => {
      const fallback = getFallbackFor(id);
      cachedInstruments.set(id, fallback);
      return fallback;
    });

  instrumentPromises.set(id, promise);
  return promise;
}

export function getPartitionInstrument(
  id: PlaybackInstrumentId,
): Promise<PartitionInstrument> {
  return loadInstrument(id);
}

export function disposePartitionInstrument(id?: PlaybackInstrumentId): void {
  if (id) {
    cachedInstruments.get(id)?.dispose();
    cachedInstruments.delete(id);
    instrumentPromises.delete(id);
    return;
  }

  for (const instrument of cachedInstruments.values()) {
    instrument.dispose();
  }
  cachedInstruments.clear();
  instrumentPromises.clear();
}

/** @deprecated Use getPartitionInstrument("piano") */
export function getPianoInstrument(): Promise<PartitionInstrument> {
  return getPartitionInstrument("piano");
}

/** @deprecated Use disposePartitionInstrument */
export function disposePianoInstrument(): void {
  disposePartitionInstrument("piano");
}
