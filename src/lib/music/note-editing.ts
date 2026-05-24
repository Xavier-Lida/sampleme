import type { Note } from '@/types/transcription';
import { SIXTEENTH_SECONDS } from '@/types/transcription';

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

/** Approximate treble-clef MIDI pitch from a click Y coordinate on the SVG. */
export function yToMidiPitch(y: number, staveTop = 40): number {
  const lineSpacing = 10;
  const middleLineY = staveTop + lineSpacing * 2;
  const halfStepsFromMiddle = (middleLineY - y) / (lineSpacing / 2);
  const midi = Math.round(71 + halfStepsFromMiddle);
  return Math.max(48, Math.min(84, midi));
}
