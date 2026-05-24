const NOTE_NAMES_SHARP = [
  'C',
  'C#',
  'D',
  'D#',
  'E',
  'F',
  'F#',
  'G',
  'G#',
  'A',
  'A#',
  'B',
] as const;

const FLAT_TO_SHARP: Record<string, string> = {
  Db: 'C#',
  Eb: 'D#',
  Fb: 'E',
  Gb: 'F#',
  Ab: 'G#',
  Bb: 'A#',
  Cb: 'B',
};

/**
 * Convert a pitch string to the sharp-based format that Tone.Sampler expects.
 * Accepts both flats (e.g. "Eb4", "Bb3") and sharps (e.g. "D#4"). Cb/Fb wrap
 * across octaves are not handled here — we only see straightforward values
 * coming from MIDI conversion.
 */
export function normalizePitchForTone(pitch: string): string {
  const match = /^([A-Ga-g])([#b]?)(-?\d+)$/.exec(pitch.trim());
  if (!match) return pitch;

  const letter = match[1].toUpperCase();
  const accidental = match[2];
  const octave = match[3];

  if (accidental === 'b') {
    const sharp = FLAT_TO_SHARP[`${letter}b`];
    if (sharp) return `${sharp}${octave}`;
  }

  return `${letter}${accidental}${octave}`;
}

/**
 * Convert a MIDI pitch number to a sharp-based scientific pitch string
 * (e.g. 60 -> "C4", 61 -> "C#4").
 */
export function midiToPitch(midi: number): string {
  const name = NOTE_NAMES_SHARP[((midi % 12) + 12) % 12];
  const octave = Math.floor(midi / 12) - 1;
  return `${name}${octave}`;
}
