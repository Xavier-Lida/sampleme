import type { Note } from '@/types/transcription';
import { FIXED_BPM, SIXTEENTH_SECONDS } from '@/types/transcription';

export const STAVE_LEFT = 10;
export const STAVE_Y = 40;

export function quantizeToSixteenth(seconds: number): number {
  return Math.round(seconds / SIXTEENTH_SECONDS) * SIXTEENTH_SECONDS;
}

export function sortNotesByStart(notes: Note[]): Note[] {
  return [...notes].sort((a, b) => a.start - b.start || a.pitch - b.pitch);
}

export function removeNoteAt(
  notes: Note[],
  index: number,
): { notes: Note[]; selectedIndex: number | null } {
  if (index < 0 || index >= notes.length) {
    return { notes, selectedIndex: null };
  }
  const next = notes.filter((_, i) => i !== index);
  return { notes: sortNotesByStart(next), selectedIndex: null };
}

export type AddNoteParams = {
  pitch: number;
  start: number;
  duration?: number;
  velocity?: number;
};

export function addNote(
  notes: Note[],
  params: AddNoteParams,
): { notes: Note[]; selectedIndex: number } {
  const start = quantizeToSixteenth(params.start);
  const duration = quantizeToSixteenth(params.duration ?? SIXTEENTH_SECONDS);
  const newNote: Note = {
    pitch: params.pitch,
    start,
    end: start + Math.max(duration, SIXTEENTH_SECONDS),
    velocity: params.velocity ?? 80,
    tied_to_next: false,
  };
  const sorted = sortNotesByStart([...notes, newNote]);
  const selectedIndex = sorted.indexOf(newNote);
  return { notes: sorted, selectedIndex };
}

/** Next 16th-grid start time after the last note ends (for staff-click append). */
export function getNextAppendStart(notes: Note[]): number {
  if (notes.length === 0) return 0;
  const lastEnd = Math.max(...notes.map((n) => n.end));
  return quantizeToSixteenth(lastEnd);
}

export function sixteenthSlotToSeconds(slot: number): number {
  return slot * SIXTEENTH_SECONDS;
}

export function secondsToSixteenthSlot(seconds: number): number {
  return Math.round(seconds / SIXTEENTH_SECONDS);
}

export const DURATION_OPTIONS = [
  { label: '16th', seconds: SIXTEENTH_SECONDS },
  { label: '8th', seconds: SIXTEENTH_SECONDS * 2 },
  { label: 'Quarter', seconds: SIXTEENTH_SECONDS * 4 },
] as const;

/** Minimum timeline length: 4 measures at the fixed BPM. */
export function computeTimelineSpan(audioDuration: number, notes: Note[]): number {
  const fourMeasures = ((60 / FIXED_BPM) * 4) * 4;
  const lastEnd = notes.length > 0 ? Math.max(...notes.map((n) => n.end)) : 0;
  return Math.max(audioDuration, lastEnd, fourMeasures);
}

export function staffClickToStart(
  xOnStave: number,
  staveWidth: number,
  timelineSpan: number,
): number {
  const ratio = Math.max(0, Math.min(1, xOnStave / staveWidth));
  return quantizeToSixteenth(ratio * timelineSpan);
}

export function findNoteAtSlot(
  notes: Note[],
  start: number,
  pitch: number,
): number | null {
  const halfSlot = SIXTEENTH_SECONDS / 2;
  const index = notes.findIndex(
    (n) => n.pitch === pitch && Math.abs(n.start - start) < halfSlot,
  );
  return index >= 0 ? index : null;
}

/** Approximate treble-clef MIDI pitch from a click Y coordinate on the SVG. */
export function yToMidiPitch(y: number, staveTop = STAVE_Y): number {
  const lineSpacing = 10;
  const middleLineY = staveTop + lineSpacing * 2;
  const halfStepsFromMiddle = (middleLineY - y) / (lineSpacing / 2);
  const midi = Math.round(71 + halfStepsFromMiddle);
  return Math.max(48, Math.min(84, midi));
}
