import type { NotationKind } from '@/lib/music/instrument-registry';

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

export const SINGLE_STAVE_Y = TREBLE_STAVE_Y;
export const TAB_SECTION_GAP = 16;

export type SheetLayoutMode = 'grand-staff' | 'treble' | 'bass' | 'tab' | 'mixed';

export interface SheetLayout {
  mode: SheetLayoutMode;
  offsetY: number;
  height: number;
  hasGrandStaff: boolean;
  hasTab: boolean;
  tabTop: number;
}

export function resolveSheetLayout(notationKinds: NotationKind[]): SheetLayoutMode {
  const unique = [...new Set(notationKinds)];
  const hasTab = unique.includes('tab');
  const hasGrand = unique.includes('grand-staff');
  const hasTreble = unique.includes('treble');
  const hasBass = unique.includes('bass');

  if (unique.length === 1) {
    if (hasTab) return 'tab';
    if (hasTreble) return 'treble';
    if (hasBass) return 'bass';
    return 'grand-staff';
  }

  if (hasTab && unique.length === 1) return 'tab';
  if (hasGrand || (hasTreble && hasBass) || unique.length > 1) {
    return hasTab ? 'mixed' : 'grand-staff';
  }

  return 'grand-staff';
}

export function buildSheetLayout(
  items: { pitch: number; notationKind: NotationKind }[],
): SheetLayout {
  const notationKinds = items.map((i) => i.notationKind);
  const mode = resolveSheetLayout(notationKinds);
  const hasTab = notationKinds.includes('tab');
  const hasGrandStaff =
    mode === 'grand-staff' ||
    mode === 'mixed' ||
    (mode !== 'tab' && mode !== 'treble' && mode !== 'bass');

  let tabTop = TAB_TOP;
  let contentMin = Infinity;
  let contentMax = -Infinity;

  const noteYs: number[] = [];

  for (const { pitch, notationKind: kind } of items) {
    if (kind === 'tab') continue;
    const y = pitchToNoteY(pitch, kind, mode);
    noteYs.push(y);
  }

  if (mode === 'treble') {
    contentMin = SINGLE_STAVE_Y - 4;
    contentMax = SINGLE_STAVE_Y + 4 * LINE_SPACING + 4;
  } else if (mode === 'bass') {
    contentMin = SINGLE_STAVE_Y - 4;
    contentMax = SINGLE_STAVE_Y + 4 * LINE_SPACING + 4;
  } else if (mode === 'tab') {
    contentMin = TAB_TOP - 4;
    contentMax = TAB_TOP + 5 * LINE_SPACING + 4;
  } else {
    contentMin = TREBLE_STAVE_Y - 4;
    contentMax = BASS_STAVE_Y + 4 * LINE_SPACING + 4;
  }

  if (noteYs.length) {
    contentMin = Math.min(contentMin, ...noteYs.map((y) => y - NOTE_STEM_EXTENT));
    contentMax = Math.max(contentMax, ...noteYs.map((y) => y + NOTE_STEM_EXTENT));
  }

  let height: number;
  if (mode === 'tab') {
    height = TAB_HEIGHT;
    tabTop = TAB_TOP;
  } else if (hasTab && hasGrandStaff) {
    const grandHeight = contentMax - contentMin + GRAND_STAFF_VERTICAL_PADDING * 2;
    tabTop = contentMax + TAB_SECTION_GAP + GRAND_STAFF_VERTICAL_PADDING;
    const tabBottom = tabTop + 5 * LINE_SPACING + 24;
    height = Math.max(GRAND_STAFF_HEIGHT + TAB_HEIGHT, tabBottom + GRAND_STAFF_VERTICAL_PADDING);
  } else if (mode === 'treble' || mode === 'bass') {
    height = Math.max(
      SINGLE_STAVE_Y + 5 * LINE_SPACING + 24,
      contentMax - contentMin + GRAND_STAFF_VERTICAL_PADDING * 2,
    );
  } else {
    height = Math.max(
      GRAND_STAFF_HEIGHT,
      contentMax - contentMin + GRAND_STAFF_VERTICAL_PADDING * 2,
    );
  }

  const padding = GRAND_STAFF_VERTICAL_PADDING;
  const offsetY = contentMin < padding ? padding - contentMin : 0;

  if (hasTab && hasGrandStaff) {
    tabTop = contentMax + TAB_SECTION_GAP + padding;
  }

  return {
    mode,
    offsetY,
    height,
    hasGrandStaff,
    hasTab,
    tabTop,
  };
}

export function pitchToNoteY(
  pitch: number,
  notationKind: NotationKind,
  layoutMode: SheetLayoutMode,
): number {
  if (notationKind === 'tab') {
    return TAB_TOP;
  }

  if (layoutMode === 'treble') {
    return midiToY(pitch, SINGLE_STAVE_Y, 'treble');
  }

  if (layoutMode === 'bass') {
    return midiToY(pitch, SINGLE_STAVE_Y, 'bass');
  }

  if (notationKind === 'bass') {
    return midiToY(pitch, BASS_STAVE_Y, 'bass');
  }

  if (notationKind === 'treble') {
    return midiToY(pitch, TREBLE_STAVE_Y, 'treble');
  }

  return pitchToGrandStaffY(pitch);
}

export function clefForNote(
  pitch: number,
  notationKind: NotationKind,
  layoutMode: SheetLayoutMode,
): ClefKind {
  if (notationKind === 'treble' || layoutMode === 'treble') return 'treble';
  if (notationKind === 'bass' || layoutMode === 'bass') return 'bass';
  return splitNoteForPiano(pitch);
}

export function yToNotePitch(
  y: number,
  layout: SheetLayout,
  notationKind?: NotationKind,
  pitchMin = PIANO_PITCH_MIN,
  pitchMax = PIANO_PITCH_MAX,
): number {
  if (layout.mode === 'tab' || notationKind === 'tab') {
    return pitchMin;
  }

  if (layout.mode === 'treble') {
    return yToMidiPitch(y, SINGLE_STAVE_Y, 'treble', pitchMin, pitchMax);
  }

  if (layout.mode === 'bass') {
    return yToMidiPitch(y, SINGLE_STAVE_Y, 'bass', pitchMin, pitchMax);
  }

  if (notationKind === 'bass') {
    return yToMidiPitch(y, BASS_STAVE_Y, 'bass', pitchMin, pitchMax);
  }

  if (notationKind === 'treble') {
    return yToMidiPitch(y, TREBLE_STAVE_Y, 'treble', pitchMin, pitchMax);
  }

  return yToGrandStaffPitch(y, pitchMin, pitchMax);
}
