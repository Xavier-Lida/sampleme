export const LINE_SPACING = 10;
export const STAVE_LEFT = 10;
export const CLEF_AREA_WIDTH = 72;
export const NOTE_AREA_LEFT = STAVE_LEFT + CLEF_AREA_WIDTH;
export const PIXELS_PER_SECOND = 80;
export const RIGHT_MARGIN = 40;

export const TREBLE_STAVE_Y = 40;
export const GRAND_STAFF_GAP = 10;
export const BASS_STAVE_Y = TREBLE_STAVE_Y + 5 * LINE_SPACING + GRAND_STAFF_GAP;
export const GRAND_STAFF_HEIGHT = BASS_STAVE_Y + 5 * LINE_SPACING + 24;

export const TAB_TOP = 40;
export const TAB_HEIGHT = 160;

export const PIANO_PITCH_MIN = 36;
export const PIANO_PITCH_MAX = 84;

export const MIDDLE_C_MIDI = 60;
export const GRAND_STAFF_VERTICAL_PADDING = 24;
export const NOTE_STEM_EXTENT = 28;

export type ClefKind = 'treble' | 'bass';

const CLEF_MIDDLE_MIDI: Record<ClefKind, number> = {
  treble: 71, // B4
  bass: 50, // D3
};

/** @deprecated Use TREBLE_STAVE_Y */
export const STAVE_Y = TREBLE_STAVE_Y;

export function splitNoteForPiano(pitch: number): ClefKind {
  return pitch >= MIDDLE_C_MIDI ? 'treble' : 'bass';
}

const MIDI_TO_DIATONIC_STEP = [0, 0, 1, 1, 2, 3, 3, 4, 4, 5, 5, 6]; // C C# D D# E F F# G G# A A# B
const DIATONIC_TO_MIDI_STEP = [0, 2, 4, 5, 7, 9, 11]; // C D E F G A B

export function midiToDiatonic(midi: number): number {
  const octave = Math.floor(midi / 12) - 1;
  const noteInOctave = ((midi % 12) + 12) % 12;
  const step = MIDI_TO_DIATONIC_STEP[noteInOctave];
  return octave * 7 + step;
}

export function diatonicToMidi(diatonic: number, min = PIANO_PITCH_MIN, max = PIANO_PITCH_MAX): number {
  const octave = Math.floor(diatonic / 7);
  const step = ((diatonic % 7) + 7) % 7;
  const midi = (octave + 1) * 12 + DIATONIC_TO_MIDI_STEP[step];
  return Math.max(min, Math.min(max, midi));
}

export function midiToY(midi: number, staveTop: number, clef: ClefKind): number {
  const middleLineY = staveTop + LINE_SPACING * 2;
  const diatonicDiff = midiToDiatonic(midi) - midiToDiatonic(CLEF_MIDDLE_MIDI[clef]);
  return middleLineY - diatonicDiff * (LINE_SPACING / 2);
}

export function pitchToGrandStaffY(pitch: number): number {
  const clef = splitNoteForPiano(pitch);
  const staveTop = clef === 'treble' ? TREBLE_STAVE_Y : BASS_STAVE_Y;
  return midiToY(pitch, staveTop, clef);
}

export function yToMidiPitch(
  y: number,
  staveTop: number,
  clef: ClefKind = 'treble',
  min = PIANO_PITCH_MIN,
  max = PIANO_PITCH_MAX,
): number {
  const middleLineY = staveTop + LINE_SPACING * 2;
  const diatonicDiff = Math.round((middleLineY - y) / (LINE_SPACING / 2));
  const targetDiatonic = midiToDiatonic(CLEF_MIDDLE_MIDI[clef]) + diatonicDiff;
  return diatonicToMidi(targetDiatonic, min, max);
}

export function yToGrandStaffPitch(
  y: number,
  min = PIANO_PITCH_MIN,
  max = PIANO_PITCH_MAX,
): number {
  const treblePitch = yToMidiPitch(y, TREBLE_STAVE_Y, 'treble', min, max);
  const bassPitch = yToMidiPitch(y, BASS_STAVE_Y, 'bass', min, max);
  const trebleBottom = TREBLE_STAVE_Y + 4 * LINE_SPACING;
  const splitY = trebleBottom + GRAND_STAFF_GAP / 2;

  if (y <= splitY) {
    return treblePitch;
  }
  if (y >= BASS_STAVE_Y + LINE_SPACING) {
    return bassPitch;
  }

  const trebleY = midiToY(treblePitch, TREBLE_STAVE_Y, 'treble');
  const bassY = midiToY(bassPitch, BASS_STAVE_Y, 'bass');
  const useTreble = Math.abs(y - trebleY) <= Math.abs(y - bassY);
  const pitch = useTreble ? treblePitch : bassPitch;

  if (Math.abs(pitch - MIDDLE_C_MIDI) <= 2) {
    return useTreble && treblePitch >= MIDDLE_C_MIDI ? treblePitch : bassPitch;
  }
  return pitch;
}

export interface GrandStaffLayout {
  offsetY: number;
  height: number;
}

export function computeGrandStaffLayout(
  pitches: number[],
  padding = GRAND_STAFF_VERTICAL_PADDING,
): GrandStaffLayout {
  const staffMinY = TREBLE_STAVE_Y - 4;
  const staffMaxY = BASS_STAVE_Y + 4 * LINE_SPACING + 4;

  const noteYs = pitches.map((pitch) => pitchToGrandStaffY(pitch));
  let contentMin = noteYs.length
    ? Math.min(...noteYs) - NOTE_STEM_EXTENT
    : staffMinY;
  let contentMax = noteYs.length
    ? Math.max(...noteYs) + NOTE_STEM_EXTENT
    : staffMaxY;

  contentMin = Math.min(contentMin, staffMinY);
  contentMax = Math.max(contentMax, staffMaxY);

  const offsetY = contentMin < padding ? padding - contentMin : 0;
  const height = Math.max(
    GRAND_STAFF_HEIGHT,
    contentMax - contentMin + padding * 2,
  );

  return {
    offsetY,
    height,
  };
}

export function timeToX(start: number): number {
  return NOTE_AREA_LEFT + start * PIXELS_PER_SECOND;
}

export function xToTime(x: number, timelineDuration: number): number {
  const noteX = x - NOTE_AREA_LEFT;
  return Math.max(0, Math.min(timelineDuration, noteX / PIXELS_PER_SECOND));
}

export function computeSheetWidth(containerWidth: number, timelineDuration: number): number {
  const contentWidth = NOTE_AREA_LEFT + timelineDuration * PIXELS_PER_SECOND + RIGHT_MARGIN;
  return Math.max(containerWidth, contentWidth);
}

export function staffLineYs(staveTop: number): number[] {
  return Array.from({ length: 5 }, (_, i) => staveTop + i * LINE_SPACING);
}

export function needsSharp(midi: number): boolean {
  const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  return names[((midi % 12) + 12) % 12].includes('#');
}

export function stemUp(midi: number, clef: ClefKind): boolean {
  if (clef === 'treble') return midi >= 71;
  return midi >= 50;
}
