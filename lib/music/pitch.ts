const PITCH_PATTERN = /^([A-Ga-g])([#b]?)(\d)$/;

const LETTER_TO_SEMITONE: Record<string, number> = {
  c: 0,
  d: 2,
  e: 4,
  f: 5,
  g: 7,
  a: 9,
  b: 11,
};

export interface ParsedPitch {
  letter: string;
  accidental: "#" | "b" | "";
  octave: number;
}

export function parsePitch(pitch: string): ParsedPitch | null {
  const match = pitch.match(PITCH_PATTERN);
  if (!match) return null;
  const [, letter, accidental, octaveStr] = match;
  const acc =
    accidental === "#" ? "#" : accidental === "b" ? "b" : ("" as const);
  return {
    letter: letter.toLowerCase(),
    accidental: acc,
    octave: Number.parseInt(octaveStr, 10),
  };
}

export function pitchToSemitone(pitch: string): number | null {
  const parsed = parsePitch(pitch);
  if (!parsed) return null;
  let semitone = LETTER_TO_SEMITONE[parsed.letter];
  if (parsed.accidental === "#") semitone += 1;
  if (parsed.accidental === "b") semitone -= 1;
  return parsed.octave * 12 + semitone;
}

export function melodicIntervalSemitones(a: string, b: string): number | null {
  const sa = pitchToSemitone(a);
  const sb = pitchToSemitone(b);
  if (sa === null || sb === null) return null;
  return Math.abs(sb - sa);
}

/** Canonical pitch for Tone.Sampler (sharps only). */
export function normalizePitchForTone(pitch: string): string {
  const parsed = parsePitch(pitch);
  if (!parsed) {
    if (process.env.NODE_ENV === "development") {
      console.warn(`[pitch] Unrecognized pitch "${pitch}", using C4`);
    }
    return "C4";
  }

  let semitone = LETTER_TO_SEMITONE[parsed.letter];
  if (parsed.accidental === "#") semitone += 1;
  if (parsed.accidental === "b") semitone -= 1;

  const octave = parsed.octave;
  const midi = octave * 12 + semitone;
  const noteIndex = ((midi % 12) + 12) % 12;
  const outOctave = Math.floor(midi / 12);

  const names = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  return `${names[noteIndex]}${outOctave}`;
}

/** VexFlow key format e.g. c#/4 */
export function pitchToVexKey(pitch: string): string {
  const normalized = normalizePitchForTone(pitch);
  const parsed = parsePitch(normalized);
  if (!parsed) return "c/4";
  const acc = parsed.accidental === "#" ? "#" : "";
  return `${parsed.letter}${acc}/${parsed.octave}`;
}
